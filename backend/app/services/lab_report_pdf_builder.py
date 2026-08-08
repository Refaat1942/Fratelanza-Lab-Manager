"""Professional A4 laboratory result report (reference-lab style)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from uuid import UUID
from zoneinfo import ZoneInfo

from reportlab.lib import colors
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
from app.models.orders import LabOrder, LabResult, LabResultValue, ResultStatus
from app.models.patients import Patient
from app.models.tenant_config import Branch, TenantBranding
from app.models.tests import Test, TestReferenceRange, TestResultTemplate
from app.schemas.patients import parse_age_from_notes
from app.services.pdf_fonts import FONT_BOLD, FONT_REGULAR, ensure_lab_pdf_fonts, shape_for_pdf


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

    def __init__(self, db: AsyncSession):
        self.db = db
        self.font_reg, self.font_bold = ensure_lab_pdf_fonts()

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
            leftMargin=14 * mm,
            rightMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=18 * mm,
            title=f"{test.name} Report",
        )

        footer_lines = [lab_name_en]
        if lab_phone:
            footer_lines.append(f"Tel: {lab_phone}")
        if footer_note:
            footer_lines.append(footer_note.replace("\n", " | ")[:120])

        def draw_footer(canvas, document):
            canvas.saveState()
            canvas.setStrokeColor(self.LINE_GRAY)
            canvas.line(14 * mm, 14 * mm, 196 * mm, 14 * mm)
            canvas.setFont(self.font_reg, 7.5)
            canvas.setFillColor(colors.HexColor("#555555"))
            canvas.drawString(14 * mm, 9 * mm, shape_for_pdf(footer_lines[0][:80]))
            if len(footer_lines) > 1:
                canvas.drawString(14 * mm, 5 * mm, footer_lines[1][:90])
            canvas.drawRightString(196 * mm, 9 * mm, str(canvas.getPageNumber()))
            canvas.restoreState()

        story = []
        story.extend(self._header_block(branding, lab_name_en, lab_name_ar, patient, order, age, gender, sample_dt, report_dt, doctor_name))
        story.append(Spacer(1, 4 * mm))
        story.append(self._test_title_bar(test))
        story.append(Spacer(1, 3 * mm))
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

        def ref_text(param: str, unit: str | None, fallback: str = "") -> str:
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
        logo_cell = ""
        if branding and branding.logo_url:
            logo_path = self._resolve_logo_path(branding.logo_url)
            if logo_path and logo_path.exists():
                try:
                    logo_cell = Image(str(logo_path), width=28 * mm, height=12 * mm)
                except Exception:
                    logo_cell = ""

        header_lines = []
        if branding and branding.report_header_html:
            for line in branding.report_header_html.splitlines()[:4]:
                if line.strip():
                    header_lines.append(shape_for_pdf(line.strip()))
        else:
            header_lines.append(shape_for_pdf(lab_name_ar))
            header_lines.append(lab_name_en)

        left_rows = [[logo_cell]] if logo_cell else []
        for line in header_lines:
            left_rows.append([Paragraph(f"<font name='{self.font_bold}' size='10'>{line}</font>", self._p(10, bold=True))])

        patient_name = shape_for_pdf(patient.full_name_ar or patient.full_name)
        right_data = [
            [f"Name: {patient_name}", f"Age: {age if age is not None else '—'}", f"Sex: {gender}"],
            [f"Patient ID: {patient.patient_code}", f"Sample: {sample_dt}", ""],
            [f"Order: {order.order_number}", f"Report: {report_dt}", ""],
        ]
        if doctor_name:
            right_data.append([f"Referring Dr: {shape_for_pdf(doctor_name)}", "", ""])

        right_table = Table(right_data, colWidths=[42 * mm, 32 * mm, 18 * mm])
        right_table.setStyle(
            TableStyle(
                [
                    ("FONT", (0, 0), (-1, -1), self.font_reg, 8),
                    ("TEXTCOLOR", (0, 0), (-1, -1), self.TEXT),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ]
            )
        )

        left_table = Table(left_rows, colWidths=[75 * mm])
        left_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))

        header = Table([[left_table, right_table]], colWidths=[78 * mm, 98 * mm])
        header.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.75, self.LINE_GRAY),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        return [header]

    def _test_title_bar(self, test: Test) -> Table:
        title = test.name
        if test.name_ar and test.name_ar != test.name:
            title = f"{test.name}"
        bar = Table([[Paragraph(f"<font name='{self.font_bold}' size='11'>{title}</font>", self._p(11, bold=True))]])
        bar.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), self.SECTION_GRAY),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        return bar

    def _results_table(self, rows: list[ReportRow]) -> Table:
        data = [["Test", "Result", "Unit", "Reference Range"]]
        for row in rows:
            result_display = row.value
            if row.abnormal and row.value != "—":
                result_display = f"↑ {row.value}"
            data.append([row.name, result_display, row.unit, row.reference])

        table = Table(data, colWidths=[72 * mm, 28 * mm, 22 * mm, 54 * mm], repeatRows=1)
        style = TableStyle(
            [
                ("FONT", (0, 0), (-1, 0), self.font_bold, 9),
                ("FONT", (0, 1), (-1, -1), self.font_reg, 9),
                ("BACKGROUND", (0, 0), (-1, 0), self.SECTION_GRAY),
                ("TEXTCOLOR", (0, 0), (-1, -1), self.TEXT),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("ALIGN", (2, 0), (2, -1), "CENTER"),
                ("ALIGN", (3, 0), (3, -1), "CENTER"),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, self.LINE_GRAY),
                ("LINEBELOW", (0, 1), (-1, -1), 0.25, self.LINE_GRAY),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
        for i, row in enumerate(rows, start=1):
            if row.abnormal:
                style.add("TEXTCOLOR", (1, i), (1, i), self.ABNORMAL_RED)
                style.add("FONT", (1, i), (1, i), self.font_bold, 9)
        table.setStyle(style)
        return table

    def _section_bar(self, title: str) -> Table:
        bar = Table([[Paragraph(f"<font name='{self.font_bold}' size='9'>{title}</font>", self._p(9, bold=True))]])
        bar.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), self.SECTION_GRAY),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        return bar

    def _results_sections(self, rows: list[ReportRow]) -> list:
        main_rows = [r for r in rows if r.section != "differential"]
        diff_rows = [r for r in rows if r.section == "differential"]
        parts: list = [self._results_table(main_rows)]
        if diff_rows:
            parts.append(Spacer(1, 4 * mm))
            parts.append(self._section_bar("Differential Count"))
            parts.append(Spacer(1, 2 * mm))
            parts.append(self._results_table(diff_rows))
        return parts

    def _comment_block(self, notes: str) -> KeepTogether:
        title = Paragraph(f"<font name='{self.font_bold}' size='9'>Comment:</font>", self._p(9, bold=True))
        body = Paragraph(shape_for_pdf(notes.replace("\n", "<br/>")), self._p(9))
        block = Table([[title], [body]], colWidths=[176 * mm])
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
        sig = Table(
            [
                ["", ""],
                [
                    Paragraph(
                        f"<font name='{self.font_bold}' size='9'>Lab Director</font><br/>"
                        f"<font name='{self.font_reg}' size='8'>Authorized Signatory</font>",
                        self._p(9),
                    ),
                    Paragraph(
                        f"<font name='{self.font_reg}' size='8'>Date: {report_dt.split(' ')[0] if report_dt else '—'}</font>",
                        self._p(8),
                    ),
                ],
            ],
            colWidths=[90 * mm, 86 * mm],
        )
        sig.setStyle(
            TableStyle(
                [
                    ("LINEABOVE", (0, 0), (0, 0), 0.75, colors.black),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (1, 1), (1, 1), "RIGHT"),
                ]
            )
        )
        return sig

    def _p(self, size: float, bold: bool = False) -> ParagraphStyle:
        return ParagraphStyle(
            name=f"P{size}{'B' if bold else ''}",
            fontName=self.font_bold if bold else self.font_reg,
            fontSize=size,
            leading=size + 2,
            textColor=self.TEXT,
        )

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
