from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.billing import Invoice, InvoiceItem, InvoiceStatus, Payment
from app.models.patients import Patient
from app.models.tenant_config import Branch
from app.schemas.billing import InvoiceCreate, PaymentCreate
from app.schemas.common import PaginatedResponse, PaginationParams
from app.utils.date_filter import apply_date_range


class BillingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_invoices(
        self,
        tenant_id: UUID,
        params: PaginationParams,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> PaginatedResponse:
        query = (
            select(Invoice, Patient)
            .join(Patient, Invoice.patient_id == Patient.id)
            .where(Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None))
        )
        date_col = func.coalesce(Invoice.issued_at, Invoice.created_at)
        for clause in apply_date_range(date_col, date_from, date_to):
            query = query.where(clause)
        query = query.order_by(Invoice.created_at.desc())
        count_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar() or 0
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        result = await self.db.execute(query)
        items = []
        for inv, patient in result.all():
            total = float(inv.total)
            paid = float(inv.paid_amount)
            items.append({
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "patient_id": inv.patient_id,
                "patient_name": patient.full_name,
                "status": inv.status,
                "subtotal": float(inv.subtotal),
                "discount": float(inv.discount),
                "total": total,
                "paid_amount": paid,
                "balance": max(total - paid, 0),
                "issued_at": inv.issued_at,
                "created_at": inv.created_at,
            })
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def create_invoice(self, tenant_id: UUID, data: InvoiceCreate, user_id: UUID) -> Invoice:
        patient = await self.db.get(Patient, data.patient_id)
        if not patient or patient.tenant_id != tenant_id:
            raise ValueError("Patient not found")

        branch_id = data.branch_id or patient.branch_id
        if not branch_id:
            branch_result = await self.db.execute(
                select(Branch.id).where(Branch.tenant_id == tenant_id, Branch.deleted_at.is_(None)).limit(1)
            )
            branch_id = branch_result.scalar_one_or_none()
        if not branch_id:
            raise ValueError("No branch available")

        count_result = await self.db.execute(
            select(func.count()).where(Invoice.tenant_id == tenant_id)
        )
        num = (count_result.scalar() or 0) + 1
        invoice_number = f"INV-{num:05d}"

        subtotal = sum(i.unit_price * i.quantity for i in data.items)
        total = subtotal - data.discount
        now = datetime.now(timezone.utc)

        invoice = Invoice(
            tenant_id=tenant_id,
            branch_id=branch_id,
            patient_id=data.patient_id,
            visit_id=data.visit_id,
            order_id=data.order_id,
            invoice_number=invoice_number,
            status=InvoiceStatus.ISSUED,
            subtotal=subtotal,
            discount=data.discount,
            total=total,
            issued_at=now,
            notes=data.notes,
        )
        self.db.add(invoice)
        await self.db.flush()

        for item in data.items:
            line_total = item.unit_price * item.quantity
            self.db.add(
                InvoiceItem(
                    tenant_id=tenant_id,
                    invoice_id=invoice.id,
                    test_id=item.test_id,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    total=line_total,
                )
            )
        await self.db.flush()
        return invoice

    async def add_payment(self, tenant_id: UUID, invoice_id: UUID, data: PaymentCreate, user_id: UUID) -> Invoice:
        result = await self.db.execute(
            select(Invoice).where(
                Invoice.id == invoice_id, Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None)
            )
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise ValueError("Invoice not found")

        balance = max(float(invoice.total) - float(invoice.paid_amount or 0), 0)
        amount = min(float(data.amount), balance)
        if amount <= 0:
            raise ValueError("Invoice is already fully paid")

        self.db.add(
            Payment(
                tenant_id=tenant_id,
                invoice_id=invoice.id,
                branch_id=invoice.branch_id,
                amount=amount,
                method=data.method,
                reference=data.reference,
                paid_at=datetime.now(timezone.utc),
                received_by=user_id,
                notes=data.notes,
            )
        )
        invoice.paid_amount = float(invoice.paid_amount or 0) + amount
        if invoice.paid_amount >= float(invoice.total):
            invoice.status = InvoiceStatus.PAID
        elif invoice.paid_amount > 0:
            invoice.status = InvoiceStatus.PARTIALLY_PAID
        await self.db.flush()
        return invoice

    async def delete_invoice(self, tenant_id: UUID, invoice_id: UUID) -> bool:
        result = await self.db.execute(
            select(Invoice).where(
                Invoice.id == invoice_id, Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None)
            )
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            return False
        invoice.deleted_at = func.now()
        invoice.status = InvoiceStatus.CANCELLED
        await self.db.flush()
        return True

    async def get_invoice_detail(self, tenant_id: UUID, invoice_id: UUID) -> dict | None:
        result = await self.db.execute(
            select(Invoice, Patient)
            .join(Patient, Invoice.patient_id == Patient.id)
            .where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None))
        )
        row = result.first()
        if not row:
            return None
        inv, patient = row
        items_result = await self.db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id))
        items = items_result.scalars().all()
        payments_result = await self.db.execute(
            select(Payment).where(Payment.invoice_id == invoice_id).order_by(Payment.paid_at.desc())
        )
        payments = payments_result.scalars().all()
        return {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "patient_id": inv.patient_id,
            "patient_name": patient.full_name,
            "status": inv.status.value,
            "subtotal": float(inv.subtotal),
            "discount": float(inv.discount),
            "tax": float(inv.tax),
            "total": float(inv.total),
            "paid_amount": float(inv.paid_amount),
            "balance": float(inv.total) - float(inv.paid_amount),
            "issued_at": inv.issued_at,
            "notes": inv.notes,
            "items": [
                {"description": i.description, "quantity": float(i.quantity), "unit_price": float(i.unit_price), "total": float(i.total)}
                for i in items
            ],
            "payments": [
                {"amount": float(p.amount), "method": p.method.value, "paid_at": p.paid_at, "reference": p.reference}
                for p in payments
            ],
        }

    async def get_financial_summary(
        self,
        tenant_id: UUID,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> dict:
        inv_q = select(
            func.coalesce(func.sum(Invoice.total), 0),
            func.coalesce(func.sum(Invoice.paid_amount), 0),
            func.count(Invoice.id),
        ).where(Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None))
        date_col = func.coalesce(Invoice.issued_at, Invoice.created_at)
        for clause in apply_date_range(date_col, date_from, date_to):
            inv_q = inv_q.where(clause)
        inv_result = await self.db.execute(inv_q)
        total, paid, count = inv_result.one()
        return {
            "total_invoiced": float(total),
            "total_collected": float(paid),
            "outstanding": float(total) - float(paid),
            "invoice_count": count,
        }
