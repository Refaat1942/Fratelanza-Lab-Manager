"""Professional A4 laboratory result report (reference-lab style)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
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
from app.models.patients import Patient
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
    abnormal: bool = False
    section: str = "main"


class LabReportPdfBuilder:
    SECTION_GRAY = colors.HexColor("#E8E8E8")
    LINE_GRAY = colors.HexColor("#CCCCCC")
    ABNORMAL_RED = colors.HexColor("#CC0000")
    TEXT = colors.HexColor("#111111")
    PAGE_W, PAGE_H = A4
    MARGIN_X = 14 * mm
    MARGIN_TOP = 12 * mm
    MARGIN_BOTTOM = 18 * mm
    CONTENT_W = PAGE_W - 2 * MARGIN_X

    def __init__(self, db: AsyncSession):
        self.db = db
        self.font_reg, self.font_bold = ensure_lab_pdf_fonts()
        self._styles: dict[str, ParagraphStyle] = {}

    async def build(self, tenant_id: UUID, result_id: UUID) -> bytes:
        lab_result = await self._load_result(tenant_id, result_id)
        ctx = await self.db.execute(
            select(LabResult, Patient, LabOrder, Doctor, Test, Branch)
            .join(LabOrder, LabResult.order_id == LabOrder.id)
            .join(Patient, LabOrder.patient_id == Patient.id)
            .join(Test, LabResult.test_id == Test.id)
            .join(Branch, LabOrder.branch_id == Branch.id)
            .outerjoin(Doctor, LabOrder.referring_doctor_id == Doctor.id)
            .where(LabResult.id == result_id, LabResult.tenant_id == tenant_id)
        )
        row = ctx.first()
        if not row:
            raise ValueError("Result not found")
        lr, patient, order, doctor, test, branch = row

        branding = await self.db.scalar(
            select(TenantBranding).where(TenantBranding.tenant_id == tenant_id)
        )

        rows = await self._build_result_rows(tenant_id, test, lab_result)
        footer_note = (branding.report_footer_html if branding and branding.report_footer_html else "").strip()
        lab_phone = branch.phone or ""
        lab_name_en = (branding.company_name if branding else None) or branch.name or "Laboratory"
        lab_name_ar = (branding.company_name_ar if branding else None) or branch.name_ar or lab_name_en

        released = lab_result.released_at or lab_result.verified_at
        report_dt = self._cairo_dt(released)
        sample_dt = self._cairo_dt(order.collected_at or order.ordered_at)
        age = parse_age_from_notes(patient.notes)
        gender = patient.gender.value if patient.gender else "—"
        doctor_name = ""
        if doctor:
            doctor_name = doctor.full_name_ar or doctor.full_name

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

        footer_lines = [lab_name_en]
        if lab_phone:
            footer_lines.append(f"Tel: {lab_phone}")
        if footer_note:
            footer_lines.append(footer_note.replace("\n", " | ")[:120])

        def draw_footer(canvas, _document):
            canvas.saveState()
            canvas.setStrokeColor(self.LINE_GRAY)
            y = self.MARGIN_BOTTOM - 4 * mm
            canvas.line(self.MARGIN_X, y, self.PAGE_W - self.MARGIN_X, y)
            canvas.setFont(self.font_reg, 7.5)
            canvas.setFillColor(colors.HexColor("#555555"))
            canvas.drawString(self.MARGIN_X, y - 5 * mm, footer_lines[0][:90])
            if len(footer_lines) > 1:
                canvas.drawString(self.MARGIN_X, y - 9 * mm, footer_lines[1][:100])
            canvas.drawRightString(self.PAGE_W - self.MARGIN_X, y - 5 * mm, str(canvas.getPageNumber()))
            canvas.restoreState()

        story: list = []
        story.extend(
            self._header_block(
                branding, lab_name_en, lab_name_ar, patient, order, age, gender, sample_dt, report_dt, doctor_name
            )
        )
        story.append(Spacer(1, 5 * mm))
        story.append(self._gray_title_bar(test.name or "Laboratory Test"))
        story.append(Spacer(1, 3 * mm))
        story.extend(self._results_sections(rows))
        if lab_result.notes:
            story.append(Spacer(1, 6 * mm))
            story.append(self._comment_block(lab_result.notes))
        story.append(Spacer(1, 10 * mm))
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
                    value=display_val,
                    unit=(val.unit if val and val.unit else tpl.unit) or "",
                    reference=ref_text(tpl.parameter_name, tpl.unit, fallback_ref),
                    abnormal=bool(val.is_abnormal) if val else False,
                )
            )
        return rows

    def _style(self, name: str, size: float, *, bold: bool = False, align=TA_LEFT) -> ParagraphStyle:
        key = f"{name}_{size}_{bold}_{align}"
        if key not in self._styles:
            self._styles[key] = ParagraphStyle(
                key,
                fontName=self.font_bold if bold else self.font_reg,
                fontSize=size,
                leading=size + 3,
                textColor=self.TEXT,
                alignment=align,
            )
        return self._styles[key]

    def _para(self, text: str, size: float = 9, *, bold: bool = False, align=TA_LEFT) -> Paragraph:
        if align == TA_LEFT and contains_arabic(text):
            align = TA_RIGHT
        return Paragraph(pdf_text(text), self._style("p", size, bold=bold, align=align))

    def _label_value_row(self, label: str, value: str) -> list:
        lbl = self._para(label, 8, bold=True)
        val = self._para(value, 8)
        return [lbl, val]

    def _header_block(
        self,
        branding,
        lab_name_en: str,
        lab_name_ar: str,
        patient: Patient,
        order: LabOrder,
        age,
        gender,
        sample_dt: str,
        report_dt: str,
        doctor_name: str,
    ) -> list:
        w = self.CONTENT_W
        lab_col = 58 * mm
        info_w = w - lab_col

        logo_cell: list = []
        if branding and branding.logo_url:
            logo_path = self._resolve_logo_path(branding.logo_url)
            if logo_path and logo_path.exists():
                try:
                    logo_cell = [Image(str(logo_path), width=28 * mm, height=14 * mm)]
                except Exception:
                    logo_cell = []

        title_lines: list[str] = []
        if branding and branding.report_header_html:
            title_lines = [ln.strip() for ln in branding.report_header_html.splitlines() if ln.strip()][:3]
        else:
            if lab_name_ar:
                title_lines.append(lab_name_ar)
            if lab_name_en:
                title_lines.append(lab_name_en)

        lab_block_rows = []
        if logo_cell:
            lab_block_rows.append(logo_cell)
        for line in title_lines:
            lab_block_rows.append([self._para(line, 11, bold=True)])

        if not lab_block_rows:
            lab_block_rows.append([self._para(lab_name_en, 11, bold=True)])

        lab_table = Table(lab_block_rows, colWidths=[lab_col])
        lab_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))

        patient_name = patient.full_name_ar or patient.full_name
        col_w = info_w / 4
        info_data = [
            self._label_value_row("Patient Name", patient_name)
            + self._label_value_row("Age", str(age) if age is not None else "—"),
            self._label_value_row("Patient ID", patient.patient_code)
            + self._label_value_row("Sex", gender),
            self._label_value_row("Order No.", order.order_number)
            + self._label_value_row("Sample Date", sample_dt.split(" ")[0] if sample_dt else "—"),
            self._label_value_row("Report Date", report_dt)
            + self._label_value_row("Phone", patient.phone or "—"),
        ]
        if doctor_name:
            info_data.append(
                self._label_value_row("Referring Doctor", doctor_name) + [Paragraph("", self._style("e", 8)), Paragraph("", self._style("e", 8))]
            )

        info_table = Table(info_data, colWidths=[col_w, col_w, col_w, col_w])
        info_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )

        header = Table([[lab_table, info_table]], colWidths=[lab_col, info_w])
        header.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.75, self.LINE_GRAY),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return [header]

    def _gray_title_bar(self, title: str) -> Table:
        bar = Table(
            [[self._para(title, 11, bold=True, align=TA_CENTER)]],
            colWidths=[self.CONTENT_W],
        )
        bar.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), self.SECTION_GRAY),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                    ("BOX", (0, 0), (-1, -1), 0.25, self.LINE_GRAY),
                ]
            )
        )
        return bar

    def _results_table(self, rows: list[ReportRow]) -> Table:
        col_test = self.CONTENT_W * 0.42
        col_result = self.CONTENT_W * 0.16
        col_unit = self.CONTENT_W * 0.14
        col_ref = self.CONTENT_W - col_test - col_result - col_unit

        header = [
            self._para("Test", 9, bold=True),
            self._para("Result", 9, bold=True, align=TA_CENTER),
            self._para("Unit", 9, bold=True, align=TA_CENTER),
            self._para("Reference Range", 9, bold=True, align=TA_CENTER),
        ]
        data = [header]
        for row in rows:
            result_display = row.value
            if row.abnormal and row.value != "—":
                result_display = f"↑ {row.value}"
            data.append(
                [
                    self._para(row.name, 9),
                    self._para(result_display, 9, bold=row.abnormal, align=TA_CENTER),
                    self._para(row.unit, 9, align=TA_CENTER),
                    self._para(row.reference, 9, align=TA_CENTER),
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
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, self.LINE_GRAY),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, self.LINE_GRAY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
        for i, row in enumerate(rows, start=1):
            if row.abnormal:
                style.add("TEXTCOLOR", (1, i), (1, i), self.ABNORMAL_RED)
        table.setStyle(style)
        return table

    def _section_bar(self, title: str) -> Table:
        bar = Table(
            [[self._para(title, 9, bold=True)]],
            colWidths=[self.CONTENT_W],
        )
        bar.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), self.SECTION_GRAY),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        return bar

    def _results_sections(self, rows: list[ReportRow]) -> list:
        main_rows = [r for r in rows if r.section != "differential"]
        diff_rows = [r for r in rows if r.section == "differential"]
        parts: list = [self._results_table(main_rows)]
        if diff_rows:
            parts.extend([Spacer(1, 4 * mm), self._section_bar("Differential Count"), Spacer(1, 2 * mm), self._results_table(diff_rows)])
        return parts

    def _comment_block(self, notes: str) -> KeepTogether:
        safe = pdf_escape(reshape_arabic(notes)).replace("\n", "<br/>")
        block = Table(
            [
                [self._para("Comment:", 9, bold=True)],
                [Paragraph(safe, self._style("c", 9))],
            ],
            colWidths=[self.CONTENT_W],
        )
        block.setStyle(
            TableStyle(
                [
                    ("LINEABOVE", (0, 0), (-1, 0), 0.5, self.LINE_GRAY),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        return KeepTogether([block])

    def _signature_block(self, report_dt: str) -> Table:
        date_str = report_dt.split(" ")[0] if report_dt and report_dt != "—" else "—"
        sig = Table(
            [
                [
                    self._para("Lab Director", 9, bold=True),
                    self._para(f"Date: {date_str}", 9, align=TA_RIGHT),
                ],
                [
                    self._para("Authorized Signatory", 8),
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

    @staticmethod
    def _cairo_dt(dt: datetime | None) -> str:
        if not dt:
            return "—"
        if dt.tzinfo is None:
            from datetime import timezone

            dt = dt.replace(tzinfo=timezone.utc)
        local = dt.astimezone(ZoneInfo("Africa/Cairo"))
        return local.strftime("%d/%m/%Y %H:%M")

    def _resolve_logo_path(self, logo_url: str):
        from app.services.branding_service import BrandingService

        return BrandingService.resolve_logo_path(logo_url)
