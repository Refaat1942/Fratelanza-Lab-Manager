from io import BytesIO
from pathlib import Path
from uuid import UUID
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.billing import Invoice
from app.models.doctors import Doctor
from app.models.orders import LabOrder, LabResult, LabResultValue, ResultStatus
from app.models.patients import Patient
from app.models.tenant_config import TenantBranding
from app.schemas.patients import parse_age_from_notes


def _register_arabic_font() -> str:
    """Register Noto Arabic if available; return font name for Paragraph styles."""
    font_name = "Helvetica"
    for path in (
        "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansArabic-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
    ):
        if Path(path).exists():
            try:
                pdfmetrics.registerFont(TTFont("LabArabic", path))
                return "LabArabic"
            except Exception:
                pass
    return font_name


class PdfService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def invoice_receipt_pdf(self, tenant_id: UUID, invoice_id: UUID) -> bytes:
        from reportlab.platypus import Image
        result = await self.db.execute(
            select(Invoice)
            .options(selectinload(Invoice.items), selectinload(Invoice.payments))
            .where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None))
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise ValueError("Invoice not found")

        patient = await self.db.get(Patient, invoice.patient_id)
        branding_result = await self.db.execute(
            select(TenantBranding).where(TenantBranding.tenant_id == tenant_id)
        )
        branding = branding_result.scalar_one_or_none()
        company = branding.company_name if branding else "Laboratory"
        header_html = branding.report_header_html if branding and branding.report_header_html else company
        footer_html = branding.report_footer_html if branding and branding.report_footer_html else "Thank you for your visit"

        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=(80 * mm, 200 * mm), rightMargin=5 * mm, leftMargin=5 * mm, topMargin=8 * mm, bottomMargin=8 * mm)
        styles = getSampleStyleSheet()
        center = ParagraphStyle("Center", parent=styles["Normal"], alignment=1, fontSize=9)
        bold_center = ParagraphStyle("BoldCenter", parent=center, fontSize=11, fontName="Helvetica-Bold")

        elements = []

        if branding and branding.logo_url:
            logo_path = self._resolve_logo_path(branding.logo_url)
            if logo_path and logo_path.exists():
                try:
                    elements.append(Image(str(logo_path), width=30 * mm, height=15 * mm))
                    elements.append(Spacer(1, 4))
                except Exception:
                    pass

        elements.append(Paragraph(header_html.replace("\n", "<br/>"), bold_center))
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"Invoice: {invoice.invoice_number}", center))
        elements.append(Paragraph(f"Patient: {patient.full_name if patient else '—'}", center))
        if invoice.issued_at:
            elements.append(Paragraph(invoice.issued_at.strftime("%Y-%m-%d %H:%M"), center))
        elements.append(Spacer(1, 8))

        line_data = [["Item", "Qty", "Price", "Total"]]
        for item in invoice.items:
            line_data.append([
                item.description[:20],
                str(item.quantity),
                f"{float(item.unit_price):.2f}",
                f"{float(item.total):.2f}",
            ])
        table = Table(line_data, colWidths=[35 * mm, 10 * mm, 15 * mm, 15 * mm])
        table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
            ("PADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 8))

        summary = [
            ["Subtotal", f"EGP {float(invoice.subtotal):.2f}"],
            ["Discount", f"EGP {float(invoice.discount):.2f}"],
            ["Total", f"EGP {float(invoice.total):.2f}"],
            ["Paid", f"EGP {float(invoice.paid_amount):.2f}"],
            ["Balance", f"EGP {float(invoice.total - invoice.paid_amount):.2f}"],
        ]
        sum_table = Table(summary, colWidths=[40 * mm, 35 * mm])
        sum_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("FONTNAME", (0, -3), (-1, -1), "Helvetica-Bold"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ]))
        elements.append(sum_table)
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(footer_html.replace("\n", "<br/>"), center))

        doc.build(elements)
        return buf.getvalue()

    async def lab_result_report_pdf(self, tenant_id: UUID, result_id: UUID) -> bytes:
        from reportlab.platypus import Image

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

        ctx = await self.db.execute(
            select(LabResult, Patient, LabOrder, Doctor)
            .join(LabOrder, LabResult.order_id == LabOrder.id)
            .join(Patient, LabOrder.patient_id == Patient.id)
            .outerjoin(Doctor, LabOrder.referring_doctor_id == Doctor.id)
            .where(LabResult.id == result_id)
        )
        row = ctx.first()
        if not row:
            raise ValueError("Result not found")
        _lr, patient, order, doctor = row

        from app.models.tests import Test

        test = await self.db.get(Test, lab_result.test_id)
        if not test:
            raise ValueError("Test not found")

        branding_result = await self.db.execute(
            select(TenantBranding).where(TenantBranding.tenant_id == tenant_id)
        )
        branding = branding_result.scalar_one_or_none()
        lab_name = (branding.company_name_ar or branding.company_name if branding else None) or "Laboratory"
        lab_name_en = (branding.company_name if branding else None) or "Laboratory"
        footer_html = branding.report_footer_html if branding and branding.report_footer_html else ""

        body_font = _register_arabic_font()
        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=12 * mm,
            bottomMargin=15 * mm,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Heading1"],
            fontName=body_font,
            fontSize=16,
            alignment=1,
            spaceAfter=6,
        )
        sub_style = ParagraphStyle(
            "ReportSub",
            parent=styles["Normal"],
            fontName=body_font,
            fontSize=10,
            alignment=1,
            textColor=colors.grey,
        )
        label_style = ParagraphStyle(
            "Label",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
        )
        value_style = ParagraphStyle(
            "Value",
            parent=styles["Normal"],
            fontName=body_font,
            fontSize=10,
        )

        elements = []

        if branding and branding.logo_url:
            logo_path = self._resolve_logo_path(branding.logo_url)
            if logo_path and logo_path.exists():
                try:
                    elements.append(Image(str(logo_path), width=45 * mm, height=18 * mm, hAlign="CENTER"))
                    elements.append(Spacer(1, 4))
                except Exception:
                    pass

        elements.append(Paragraph(lab_name.replace("\n", "<br/>"), title_style))
        elements.append(Paragraph(lab_name_en, sub_style))
        elements.append(Spacer(1, 8))
        elements.append(
            Paragraph(
                "<b>LABORATORY REPORT</b> &nbsp;|&nbsp; <b>تقرير نتائج التحاليل</b>",
                ParagraphStyle("Hdr", parent=sub_style, fontSize=11, textColor=colors.HexColor("#1565C0")),
            )
        )
        elements.append(Spacer(1, 10))

        released = lab_result.released_at or lab_result.verified_at
        if released and released.tzinfo:
            released_local = released.astimezone(ZoneInfo("Africa/Cairo"))
        else:
            released_local = released
        report_date = released_local.strftime("%d/%m/%Y %H:%M") if released_local else "—"

        collected = order.collected_at or order.ordered_at
        if collected and collected.tzinfo:
            collected_local = collected.astimezone(ZoneInfo("Africa/Cairo"))
        else:
            collected_local = collected
        collection_date = collected_local.strftime("%d/%m/%Y") if collected_local else "—"

        age = parse_age_from_notes(patient.notes)
        patient_display = patient.full_name_ar or patient.full_name
        doctor_name = ""
        if doctor:
            doctor_name = doctor.full_name_ar or doctor.full_name

        info_rows = [
            ["Patient / المريض", patient_display, "Order / رقم الطلب", order.order_number],
            ["Patient ID / كود", patient.patient_code, "Sample date / تاريخ العينة", collection_date],
            ["Age / العمر", str(age) if age is not None else "—", "Report date / تاريخ التقرير", report_date],
            ["Phone / الهاتف", patient.phone or "—", "Referring Dr / الطبيب", doctor_name or "—"],
        ]
        info_table = Table(info_rows, colWidths=[35 * mm, 55 * mm, 38 * mm, 52 * mm])
        info_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                    ("FONTNAME", (1, 0), (1, -1), body_font),
                    ("FONTNAME", (3, 0), (3, -1), body_font),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F9FF")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#90CAF9")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#BBDEFB")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        elements.append(info_table)
        elements.append(Spacer(1, 12))

        test_title = Paragraph(
            f"<b>{test.name}</b>" + (f" — {test.code}" if test.code else ""),
            ParagraphStyle("TestTitle", parent=value_style, fontSize=12, spaceAfter=6),
        )
        elements.append(test_title)

        values = sorted(lab_result.values, key=lambda v: v.parameter_name)
        if not values:
            elements.append(Paragraph("No result values recorded.", value_style))
        else:
            table_data = [["Parameter / البند", "Result / النتيجة", "Unit", "Reference / المعدل الطبيعي"]]
            for v in values:
                table_data.append([
                    v.parameter_name,
                    v.value or "—",
                    v.unit or "",
                    v.reference_range or "—",
                ])
            res_table = Table(table_data, colWidths=[55 * mm, 40 * mm, 25 * mm, 50 * mm])
            res_table.setStyle(
                TableStyle(
                    [
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1565C0")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            elements.append(res_table)

        elements.append(Spacer(1, 16))
        elements.append(
            Paragraph(
                "This report is for medical use only. / هذا التقرير للاستخدام الطبي فقط.",
                ParagraphStyle("Disclaimer", parent=sub_style, fontSize=8),
            )
        )
        if footer_html:
            elements.append(Spacer(1, 6))
            elements.append(Paragraph(footer_html.replace("\n", "<br/>"), sub_style))

        elements.append(Spacer(1, 20))
        sig_data = [["Lab Director / مدير المختبر", "", "Date / التاريخ", report_date.split(" ")[0] if report_date != "—" else ""]]
        sig_table = Table(sig_data, colWidths=[50 * mm, 60 * mm, 35 * mm, 35 * mm])
        sig_table.setStyle(
            TableStyle(
                [
                    ("LINEABOVE", (1, 0), (1, 0), 0.5, colors.black),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ]
            )
        )
        elements.append(sig_table)

        doc.build(elements)
        return buf.getvalue()

    def _resolve_logo_path(self, logo_url: str) -> Path | None:
        from app.services.branding_service import BrandingService
        return BrandingService.resolve_logo_path(logo_url)
