from datetime import date
from io import BytesIO
from uuid import UUID

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.billing import Invoice
from app.models.patients import Patient
from app.models.tenant_config import TenantBranding
from app.services.reports_service import ReportsService
from pathlib import Path


class PdfService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def daily_operations_pdf(
        self, tenant_id: UUID, date_from: date, date_to: date, company_name: str
    ) -> bytes:
        data = await ReportsService(self.db).get_daily_operations_data(tenant_id, date_from, date_to)
        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm, topMargin=20 * mm, bottomMargin=20 * mm)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=16, spaceAfter=12)
        elements = [
            Paragraph(company_name, title_style),
            Paragraph(f"Daily Operations Report — {date_from.isoformat()} to {date_to.isoformat()}", styles["Heading2"]),
            Spacer(1, 12),
        ]
        table_data = [data["headers"]] + data["rows"]
        table = Table(table_data, colWidths=[80 * mm, 80 * mm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F766E")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0fdfa")]),
            ("PADDING", (0, 0), (-1, -1), 8),
        ]))
        elements.append(table)
        doc.build(elements)
        return buf.getvalue()

    async def invoice_receipt_pdf(self, tenant_id: UUID, invoice_id: UUID) -> bytes:
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

    def _resolve_logo_path(self, logo_url: str) -> Path | None:
        from app.services.branding_service import BrandingService
        return BrandingService.resolve_logo_path(logo_url)
