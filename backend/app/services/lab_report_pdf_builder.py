"""Professional A4 laboratory result report — Egyptian reference-lab layout."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from io import BytesIO
from uuid import UUID
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.constants.standard_result_templates import fields_for_test_code, is_generic_result_template
from app.models.doctors import Doctor
from app.models.orders import LabOrder, LabResult, ResultStatus
from app.models.patients import Gender, Patient, PatientVisit
from app.models.tenant_config import Branch, TenantBranding
from app.models.tests import Test, TestReferenceRange, TestResultTemplate
from app.schemas.patients import parse_age_from_notes
from app.services.pdf_fonts import contains_arabic, ensure_lab_pdf_fonts, pdf_escape, pdf_text, reshape_arabic


@dataclass
class ReportRow:
    name: str
    value: str
    unit: str
    reference: str
    name_ar: str = ""
    abnormal: bool = False
    section: str = "main"


@dataclass
class _FooterCtx:
    lab_name: str
    address: str
    phone: str
    footer_note: str


class LabReportPdfBuilder:
    SECTION_GRAY = colors.HexColor("#E8E8E8")
    LINE_GRAY = colors.HexColor("#CCCCCC")
    ABNORMAL_RED = colors.HexColor("#CC0000")
    TEXT = colors.HexColor("#111111")
    MUTED = colors.HexColor("#444444")
    PAGE_W, PAGE_H = A4
    MARGIN_X = 12 * mm
    MARGIN_TOP = 10 * mm
    MARGIN_BOTTOM = 22 * mm
    CONTENT_W = PAGE_W - 2 * MARGIN_X

    def __init__(self, db: AsyncSession):
        self.db = db
        self.font_reg, self.font_bold = ensure_lab_pdf_fonts()
        self._styles: dict[str, ParagraphStyle] = {}
        self._accent = colors.HexColor("#0F766E")

    async def build(self, tenant_id: UUID, result_id: UUID) -> bytes:
        lab_result = await self._load_result(tenant_id, result_id)
        ctx = await self.db.execute(
            select(LabResult, Patient, LabOrder, Doctor, Test, Branch, PatientVisit)
            .join(LabOrder, LabResult.order_id == LabOrder.id)
            .join(Patient, LabOrder.patient_id == Patient.id)
            .join(Test, LabResult.test_id == Test.id)
            .join(Branch, LabOrder.branch_id == Branch.id)
            .outerjoin(Doctor, LabOrder.referring_doctor_id == Doctor.id)
            .outerjoin(PatientVisit, LabOrder.visit_id == PatientVisit.id)
            .where(LabResult.id == result_id, LabResult.tenant_id == tenant_id)
        )
        row = ctx.first()
        if not row:
            raise ValueError("Result not found")
        lr, patient, order, doctor, test, branch, visit = row

        branding = await self.db.scalar(
            select(TenantBranding).where(TenantBranding.tenant_id == tenant_id)
        )
        if branding and branding.primary_color:
            self._accent = self._hex_color(branding.primary_color, "#0F766E")

        rows = await self._build_result_rows(tenant_id, test, lab_result)
        footer_note = (branding.report_footer_html if branding and branding.report_footer_html else "").strip()
        lab_name_en = (branding.company_name if branding else None) or branch.name or "Laboratory"
        lab_name_ar = (branding.company_name_ar if branding else None) or branch.name_ar or lab_name_en
        lab_phone = branch.phone or ""
        lab_address = self._format_address(branch)

        released = lab_result.released_at or lab_result.verified_at
        report_dt = self._cairo_dt(released)
        sample_dt = self._cairo_dt(order.collected_at or order.ordered_at)
        age = self._patient_age(patient)
        gender_en, gender_ar = self._gender_labels(patient.gender)
        doctor_name = ""
        if doctor:
            doctor_name = doctor.full_name_ar or doctor.full_name

        test_title = self._test_title(test)
        footer_ctx = _FooterCtx(
            lab_name=lab_name_ar or lab_name_en,
            address=lab_address,
            phone=lab_phone,
            footer_note=footer_note,
        )

        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=self.MARGIN_X,
            rightMargin=self.MARGIN_X,
            topMargin=self.MARGIN_TOP,
            bottomMargin=self.MARGIN_BOTTOM,
            title=f"{test.name} Report",
        )

        def draw_footer(canvas, _document):
            self._draw_page_footer(canvas, footer_ctx)

        story: list = []
        story.extend(
            self._lab_header(branding, branch, lab_name_en, lab_name_ar, lab_phone, lab_address)
        )
        story.append(Spacer(1, 4 * mm))
        story.append(
            self._patient_panel(
                patient=patient,
                order=order,
                visit=visit,
                age=age,
                gender_en=gender_en,
                gender_ar=gender_ar,
                sample_dt=sample_dt,
                report_dt=report_dt,
                doctor_name=doctor_name,
            )
        )
        story.append(Spacer(1, 5 * mm))
        story.append(self._title_bar(test_title))
        story.append(Spacer(1, 2 * mm))
        story.extend(self._results_sections(rows))
        if lab_result.notes:
            story.append(Spacer(1, 5 * mm))
            story.append(self._comment_block(lab_result.notes))
        story.append(Spacer(1, 8 * mm))
        story.append(self._signature_block(report_dt))

        doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
        return buf.getvalue()

    async def _load_result(self, tenant_id: UUID, result_id: UUID) -> LabResult:
        result = await self.db.execute(
            select(LabResult)
            .options(selectinload(LabResult.values))
            .where(LabResult.id == result_id, LabResult.tenant_id == tenant_id, LabResult.deleted_at.is_(None))
        )
        lab_result = result.scalar_one_or_none()
        if not lab_result:
            raise ValueError("Result not found")
        if lab_result.status not in (ResultStatus.RELEASED, ResultStatus.VERIFIED):
            raise ValueError("Result is not released yet")
        return lab_result

    async def _build_result_rows(self, tenant_id: UUID, test: Test, lab_result: LabResult) -> list[ReportRow]:
        templates = list(
            (
                await self.db.execute(
                    select(TestResultTemplate)
                    .where(TestResultTemplate.test_id == test.id, TestResultTemplate.tenant_id == tenant_id)
                    .order_by(TestResultTemplate.sort_order)
                )
            ).scalars()
        )
        refs = list(
            (
                await self.db.execute(
                    select(TestReferenceRange).where(
                        TestReferenceRange.test_id == test.id, TestReferenceRange.tenant_id == tenant_id
                    )
                )
            ).scalars()
        )
        ref_by_param = {r.parameter_name.lower(): r for r in refs}
        value_by_param = {v.parameter_name.lower(): v for v in lab_result.values}

        std_fields = fields_for_test_code(test.code)
        rows: list[ReportRow] = []

        def ref_text(param: str, _unit: str | None, fallback: str = "") -> str:
            v = value_by_param.get(param.lower())
            if v and v.reference_range:
                return v.reference_range
            r = ref_by_param.get(param.lower())
            if r:
                if r.normal_text:
                    return r.normal_text
                if r.min_value is not None and r.max_value is not None:
                    return f"{float(r.min_value)} - {float(r.max_value)}"
            return fallback

        if std_fields and (not templates or is_generic_result_template(templates)):
            for field in std_fields:
                val = value_by_param.get(field.parameter_name.lower())
                display_val = val.value if val and val.value else "—"
                rows.append(
                    ReportRow(
                        name=field.parameter_name,
                        name_ar=field.parameter_name_ar,
                        value=display_val,
                        unit=field.unit or (val.unit if val else ""),
                        reference=ref_text(field.parameter_name, field.unit, field.reference),
                        abnormal=bool(val.is_abnormal) if val else False,
                        section=field.section,
                    )
                )
            return rows

        for tpl in templates:
            val = value_by_param.get(tpl.parameter_name.lower())
            display_val = val.value if val and val.value else "—"
            fallback_ref = ""
            if tpl.options and isinstance(tpl.options, dict):
                fallback_ref = str(tpl.options.get("reference") or "")
            rows.append(
                ReportRow(
                    name=tpl.parameter_name,
                    name_ar=tpl.parameter_name_ar or "",
                    value=display_val,
                    unit=(val.unit if val and val.unit else tpl.unit) or "",
                    reference=ref_text(tpl.parameter_name, tpl.unit, fallback_ref),
                    abnormal=bool(val.is_abnormal) if val else False,
                )
            )
        return rows

    @staticmethod
    def _hex_color(value: str, fallback: str) -> colors.HexColor:
        try:
            return colors.HexColor(value if value.startswith("#") else f"#{value}")
        except Exception:
            return colors.HexColor(fallback)

    @staticmethod
    def _format_address(branch: Branch) -> str:
        parts = [p for p in (branch.address, branch.city, branch.governorate) if p]
        return " — ".join(parts)

    @staticmethod
    def _patient_age(patient: Patient) -> str:
        if patient.date_of_birth:
            today = date.today()
            years = today.year - patient.date_of_birth.year
            if (today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day):
                years -= 1
            return str(years)
        parsed = parse_age_from_notes(patient.notes)
        return str(parsed) if parsed is not None else "—"

    @staticmethod
    def _gender_labels(gender: Gender | None) -> tuple[str, str]:
        if gender == Gender.MALE:
            return "Male", "ذكر"
        if gender == Gender.FEMALE:
            return "Female", "أنثى"
        return "—", "—"

    @staticmethod
    def _test_title(test: Test) -> str:
        if test.name_ar and test.name_ar.strip() != test.name.strip():
            return f"{test.name_ar.strip()} — {test.name.strip()}"
        return test.name or "Laboratory Test"

    def _style(self, name: str, size: float, *, bold: bool = False, align=TA_LEFT, color=None) -> ParagraphStyle:
        key = f"{name}_{size}_{bold}_{align}_{color}"
        if key not in self._styles:
            self._styles[key] = ParagraphStyle(
                key,
                fontName=self.font_bold if bold else self.font_reg,
                fontSize=size,
                leading=size + 3,
                textColor=color or self.TEXT,
                alignment=align,
            )
        return self._styles[key]

    def _para(self, text: str, size: float = 9, *, bold: bool = False, align=TA_LEFT, color=None) -> Paragraph:
        if align == TA_LEFT and contains_arabic(text):
            align = TA_RIGHT
        return Paragraph(pdf_text(text), self._style("p", size, bold=bold, align=align, color=color))

    def _bilingual_para(self, ar: str, en: str, size: float = 9, *, bold: bool = False, align=TA_LEFT) -> Paragraph:
        ar_part = pdf_text(ar) if ar else ""
        en_part = pdf_escape(en) if en else ""
        if ar_part and en_part and ar.strip() != en.strip():
            body = f"<b>{ar_part}</b><br/><font size='{max(size - 1.5, 7)}' color='#555555'>{en_part}</font>"
        elif ar_part:
            body = f"<b>{ar_part}</b>" if bold else ar_part
        else:
            body = en_part
        align = TA_RIGHT if contains_arabic(ar or en) else align
        return Paragraph(body, self._style("bi", size, bold=bold, align=align))

    def _lab_header(
        self,
        branding,
        branch: Branch,
        lab_name_en: str,
        lab_name_ar: str,
        lab_phone: str,
        lab_address: str,
    ) -> list:
        w = self.CONTENT_W
        banner_h = 3 * mm
        banner = Table([[""]], colWidths=[w], rowHeights=[banner_h])
        banner.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), self._accent)]))

        logo_w = 22 * mm
        logo_cell: list = [Spacer(1, 2 * mm)]
        if branding and branding.logo_url:
            logo_path = self._resolve_logo_path(branding.logo_url)
            if logo_path and logo_path.exists():
                try:
                    logo_cell = [Image(str(logo_path), width=logo_w, height=11 * mm)]
                except Exception:
                    pass

        header_lines: list[str] = []
        if branding and branding.report_header_html:
            header_lines = [ln.strip() for ln in branding.report_header_html.splitlines() if ln.strip()]
        if not header_lines:
            if lab_name_ar:
                header_lines.append(lab_name_ar)
            if lab_name_en and lab_name_en != lab_name_ar:
                header_lines.append(lab_name_en)
            if lab_address:
                header_lines.append(lab_address)
            if lab_phone:
                header_lines.append(f"Tel: {lab_phone}")

        title_rows = [[self._para(header_lines[0], 13, bold=True, align=TA_CENTER)]] if header_lines else []
        for line in header_lines[1:]:
            title_rows.append([self._para(line, 9, align=TA_CENTER, color=self.MUTED)])

        if not title_rows:
            title_rows.append([self._para(lab_name_en, 13, bold=True, align=TA_CENTER)])

        title_block = Table(title_rows, colWidths=[w - logo_w - 4 * mm])
        title_block.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 1),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ]
            )
        )

        header_row = Table([[logo_cell, title_block]], colWidths=[logo_w + 4 * mm, w - logo_w - 4 * mm])
        header_row.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )

        subtitle = self._para(
            "Medical Laboratory Report — تقرير تحليل طبي",
            8,
            align=TA_CENTER,
            color=self.MUTED,
        )
        wrap = Table([[banner], [header_row], [subtitle]], colWidths=[w])
        wrap.setStyle(
            TableStyle(
                [
                    ("LINEBELOW", (0, -1), (-1, -1), 1, self._accent),
                    ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
                ]
            )
        )
        return [wrap]

    def _info_cell(self, label_ar: str, label_en: str, value: str) -> Paragraph:
        label = f"{label_ar} / {label_en}"
        safe_val = pdf_text(value) if value else "—"
        return Paragraph(
            f"<font size='7' color='#666666'>{pdf_escape(label)}</font><br/>"
            f"<font size='9'><b>{safe_val}</b></font>",
            self._style("ic", 9, align=TA_RIGHT if contains_arabic(value) else TA_LEFT),
        )

    def _patient_panel(
        self,
        *,
        patient: Patient,
        order: LabOrder,
        visit: PatientVisit | None,
        age: str,
        gender_en: str,
        gender_ar: str,
        sample_dt: str,
        report_dt: str,
        doctor_name: str,
    ) -> Table:
        w = self.CONTENT_W
        col = w / 3
        patient_name = patient.full_name_ar or patient.full_name
        gender_display = f"{gender_ar} / {gender_en}" if gender_ar != "—" else gender_en
        visit_no = visit.visit_number if visit else "—"
        sample_date = sample_dt.split(" ")[0] if sample_dt and sample_dt != "—" else "—"
        sample_time = sample_dt.split(" ")[1] if sample_dt and " " in sample_dt else ""

        row1 = [
            self._info_cell("اسم المريض", "Patient Name", patient_name),
            self._info_cell("العمر", "Age", age),
            self._info_cell("النوع", "Sex", gender_display),
        ]
        row2 = [
            self._info_cell("رقم الملف", "Patient ID", patient.patient_code),
            self._info_cell("رقم الطلب", "Order No.", order.order_number),
            self._info_cell("رقم الزيارة", "Visit No.", visit_no),
        ]
        row3 = [
            self._info_cell("تاريخ السحب", "Sample Date", f"{sample_date} {sample_time}".strip()),
            self._info_cell("تاريخ التقرير", "Report Date", report_dt),
            self._info_cell("الهاتف", "Phone", patient.phone or "—"),
        ]
        data = [row1, row2, row3]
        if doctor_name:
            doc_row = [
                self._info_cell("الطبيب المحول", "Referring Doctor", doctor_name),
                Paragraph("", self._style("e", 8)),
                Paragraph("", self._style("e", 8)),
            ]
            data.append(doc_row)

        panel = Table(data, colWidths=[col, col, col])
        panel.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.75, self._accent),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, self.LINE_GRAY),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFAFA")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return panel

    def _title_bar(self, title: str) -> Table:
        bar = Table(
            [[Paragraph(pdf_text(title), self._style("tb", 11, bold=True, align=TA_CENTER, color=colors.white))]],
            colWidths=[self.CONTENT_W],
        )
        bar.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), self._accent),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return bar

    def _param_cell(self, row: ReportRow) -> Paragraph:
        if row.name_ar and row.name_ar.strip() != row.name.strip():
            return self._bilingual_para(row.name_ar, row.name, 9)
        return self._para(row.name, 9)

    def _results_table(self, rows: list[ReportRow]) -> Table:
        col_test = self.CONTENT_W * 0.40
        col_result = self.CONTENT_W * 0.16
        col_unit = self.CONTENT_W * 0.12
        col_ref = self.CONTENT_W - col_test - col_result - col_unit

        header = [
            self._para("التحليل / Test", 8, bold=True, align=TA_CENTER),
            self._para("النتيجة / Result", 8, bold=True, align=TA_CENTER),
            self._para("الوحدة / Unit", 8, bold=True, align=TA_CENTER),
            self._para("المعدل / Reference", 8, bold=True, align=TA_CENTER),
        ]
        data = [header]
        for row in rows:
            result_display = row.value
            if row.abnormal and row.value != "—":
                result_display = f"↑ {row.value}"
            data.append(
                [
                    self._param_cell(row),
                    self._para(result_display, 9, bold=row.abnormal, align=TA_CENTER, color=self.ABNORMAL_RED if row.abnormal else None),
                    self._para(row.unit, 9, align=TA_CENTER),
                    self._para(row.reference, 8, align=TA_CENTER),
                ]
            )

        if len(data) == 1:
            data.append(
                [
                    self._para("—", 9),
                    self._para("—", 9, align=TA_CENTER),
                    self._para("", 9),
                    self._para("", 9),
                ]
            )

        table = Table(data, colWidths=[col_test, col_result, col_unit, col_ref], repeatRows=1)
        style = TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), self.SECTION_GRAY),
                ("BOX", (0, 0), (-1, -1), 0.5, self.LINE_GRAY),
                ("LINEBELOW", (0, 0), (-1, 0), 0.75, self._accent),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, self.LINE_GRAY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
        table.setStyle(style)
        return table

    def _section_bar(self, title: str) -> Table:
        bar = Table(
            [[self._para(title, 9, bold=True, align=TA_CENTER)]],
            colWidths=[self.CONTENT_W],
        )
        bar.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), self.SECTION_GRAY),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        return bar

    def _results_sections(self, rows: list[ReportRow]) -> list:
        main_rows = [r for r in rows if r.section != "differential"]
        diff_rows = [r for r in rows if r.section == "differential"]
        parts: list = [self._results_table(main_rows)]
        if diff_rows:
            parts.extend(
                [
                    Spacer(1, 3 * mm),
                    self._section_bar("Differential Count — عدد نووي"),
                    Spacer(1, 2 * mm),
                    self._results_table(diff_rows),
                ]
            )
        return parts

    def _comment_block(self, notes: str) -> KeepTogether:
        safe = pdf_escape(reshape_arabic(notes)).replace("\n", "<br/>")
        block = Table(
            [
                [self._para("ملاحظات / Comment:", 9, bold=True)],
                [Paragraph(safe, self._style("c", 9))],
            ],
            colWidths=[self.CONTENT_W],
        )
        block.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.5, self.LINE_GRAY),
                    ("BACKGROUND", (0, 0), (-1, 0), self.SECTION_GRAY),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return KeepTogether([block])

    def _signature_block(self, report_dt: str) -> Table:
        date_str = report_dt.split(" ")[0] if report_dt and report_dt != "—" else "—"
        sig = Table(
            [
                [
                    self._para("مدير المختبر / Lab Director", 9, bold=True),
                    self._para(f"التاريخ / Date: {date_str}", 9, align=TA_RIGHT),
                ],
                [
                    self._para("التوقيع المعتمد / Authorized Signatory", 8, color=self.MUTED),
                    Paragraph("", self._style("s", 8)),
                ],
            ],
            colWidths=[self.CONTENT_W * 0.55, self.CONTENT_W * 0.45],
        )
        sig.setStyle(
            TableStyle(
                [
                    ("LINEABOVE", (0, 0), (0, 0), 0.75, colors.black),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        return sig

    def _draw_page_footer(self, canvas, ctx: _FooterCtx) -> None:
        canvas.saveState()
        y = self.MARGIN_BOTTOM - 6 * mm
        canvas.setStrokeColor(self._accent)
        canvas.setLineWidth(0.75)
        canvas.line(self.MARGIN_X, y, self.PAGE_W - self.MARGIN_X, y)

        canvas.setFont(self.font_reg, 7)
        canvas.setFillColor(self.MUTED)
        line1_parts = [ctx.lab_name]
        if ctx.address:
            line1_parts.append(ctx.address)
        if ctx.phone:
            line1_parts.append(f"Tel: {ctx.phone}")
        line1 = "  |  ".join(line1_parts)[:130]
        canvas.drawCentredString(self.PAGE_W / 2, y - 4 * mm, line1)

        if ctx.footer_note:
            note = ctx.footer_note.replace("\n", " ")[:120]
            canvas.drawCentredString(self.PAGE_W / 2, y - 8 * mm, note)

        canvas.drawRightString(self.PAGE_W - self.MARGIN_X, y - 4 * mm, str(canvas.getPageNumber()))
        canvas.restoreState()

    @staticmethod
    def _cairo_dt(dt: datetime | None) -> str:
        if not dt:
            return "—"
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        local = dt.astimezone(ZoneInfo("Africa/Cairo"))
        return local.strftime("%d/%m/%Y %H:%M")

    def _resolve_logo_path(self, logo_url: str):
        from app.services.branding_service import BrandingService

        return BrandingService.resolve_logo_path(logo_url)

    # Backward-compatible aliases for unit tests
    def _gray_title_bar(self, title: str) -> Table:
        return self._title_bar(title)
