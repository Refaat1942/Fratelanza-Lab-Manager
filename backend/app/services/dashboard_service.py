from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Invoice
from app.models.doctors import Doctor
from app.models.inventory import InventoryBatch, InventoryItem
from app.models.orders import LabOrder, LabOrderItem, OrderStatus
from app.models.patients import Patient
from app.models.tests import Test
from app.services.billing_service import BillingService
from app.services.expense_service import ExpenseService
from app.utils.date_filter import apply_date_range


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(
        self, tenant_id: UUID, date_from: date | None = None, date_to: date | None = None
    ) -> dict:
        # New patients in the period; catalogue sizes are totals (not "created in the period").
        patients = await self._count(Patient, tenant_id, date_from, date_to)
        doctors = await self._count(Doctor, tenant_id)
        tests = await self._count(Test, tenant_id)
        inventory_items = await self._count(InventoryItem, tenant_id)
        low_stock = await self._count_low_stock(tenant_id)
        return {
            "patients": patients,
            "doctors": doctors,
            "tests": tests,
            "inventory_items": inventory_items,
            "low_stock_items": low_stock,
        }

    async def get_insights(
        self, tenant_id: UUID, date_from: date | None = None, date_to: date | None = None
    ) -> dict:
        stats = await self.get_stats(tenant_id, date_from, date_to)
        financial = await BillingService(self.db).get_financial_summary(tenant_id, date_from, date_to)
        expenses = await ExpenseService(self.db).get_summary(tenant_id, date_from, date_to)

        pending = await self._order_count(tenant_id, OrderStatus.PENDING, date_from, date_to)
        collected = await self._order_count(tenant_id, OrderStatus.COLLECTED, date_from, date_to)
        in_lab = await self._order_count(tenant_id, OrderStatus.IN_LAB, date_from, date_to)
        completed = await self._order_count(tenant_id, OrderStatus.COMPLETED, date_from, date_to)
        completed += await self._order_count(tenant_id, OrderStatus.DELIVERED, date_from, date_to)

        recent_patients = await self._recent_patients(tenant_id, date_from=date_from, date_to=date_to)
        recent_invoices = await self._recent_invoices(tenant_id, date_from=date_from, date_to=date_to)
        low_stock = await self._low_stock_items(tenant_id)

        net_profit = float(financial["total_collected"]) - float(expenses["total_expenses"])
        laboratory = await self._laboratory_totals(tenant_id, date_from, date_to)

        return {
            "stats": stats,
            "financial": financial,
            "expenses": expenses,
            "orders": {
                "pending_orders": pending,
                "collected_orders": collected,
                "in_lab_orders": in_lab,
                "completed_orders": completed,
            },
            "laboratory": laboratory,
            "recent_patients": recent_patients,
            "recent_invoices": recent_invoices,
            "low_stock": low_stock,
            "net_profit": net_profit,
        }

    async def _laboratory_totals(
        self, tenant_id: UUID, date_from: date | None = None, date_to: date | None = None
    ) -> dict:
        q = (
            select(
                func.coalesce(func.sum(LabOrderItem.price), 0),
                func.coalesce(func.sum(LabOrderItem.cost), 0),
                func.count(LabOrderItem.id),
            )
            .select_from(LabOrderItem)
            .join(LabOrder, LabOrderItem.order_id == LabOrder.id)
            .where(
                LabOrder.tenant_id == tenant_id,
                LabOrder.deleted_at.is_(None),
                LabOrderItem.status != OrderStatus.CANCELLED,
            )
        )
        for clause in apply_date_range(LabOrder.ordered_at, date_from, date_to):
            q = q.where(clause)
        sales, cost, test_count = (await self.db.execute(q)).one()

        # Discounts given on these orders' invoices — margin must be after discount.
        disc_q = (
            select(func.coalesce(func.sum(Invoice.discount), 0))
            .join(LabOrder, Invoice.order_id == LabOrder.id)
            .where(
                Invoice.tenant_id == tenant_id,
                Invoice.deleted_at.is_(None),
                LabOrder.deleted_at.is_(None),
            )
        )
        for clause in apply_date_range(LabOrder.ordered_at, date_from, date_to):
            disc_q = disc_q.where(clause)
        discount = float(await self.db.scalar(disc_q) or 0)

        sales_f = float(sales or 0)
        cost_f = float(cost or 0)
        return {
            "tests_ordered": int(test_count or 0),
            "sales_total": sales_f,
            "discount_total": discount,
            "cost_total": cost_f,
            "margin": round(sales_f - discount - cost_f, 2),
        }

    async def _count(self, model, tenant_id: UUID, date_from: date | None = None, date_to: date | None = None) -> int:
        q = select(func.count()).select_from(model).where(
            model.tenant_id == tenant_id, model.deleted_at.is_(None)
        )
        if hasattr(model, "created_at"):
            for clause in apply_date_range(model.created_at, date_from, date_to):
                q = q.where(clause)
        return await self.db.scalar(q) or 0

    def _stock_query(self, tenant_id: UUID):
        qty = func.coalesce(func.sum(InventoryBatch.quantity), 0)
        return (
            select(InventoryItem, qty.label("qty"))
            .outerjoin(InventoryBatch, InventoryBatch.item_id == InventoryItem.id)
            .where(InventoryItem.tenant_id == tenant_id, InventoryItem.deleted_at.is_(None))
            .group_by(InventoryItem.id)
            .having(qty <= InventoryItem.reorder_level)
        )

    async def _count_low_stock(self, tenant_id: UUID) -> int:
        return await self.db.scalar(select(func.count()).select_from(self._stock_query(tenant_id).subquery())) or 0

    async def _order_count(
        self, tenant_id: UUID, status: OrderStatus, date_from: date | None = None, date_to: date | None = None
    ) -> int:
        q = select(func.count()).select_from(LabOrder).where(
            LabOrder.tenant_id == tenant_id,
            LabOrder.deleted_at.is_(None),
            LabOrder.status == status,
        )
        for clause in apply_date_range(LabOrder.ordered_at, date_from, date_to):
            q = q.where(clause)
        return await self.db.scalar(q) or 0

    async def _recent_patients(
        self, tenant_id: UUID, limit: int = 5, date_from: date | None = None, date_to: date | None = None
    ) -> list[dict]:
        q = select(Patient).where(Patient.tenant_id == tenant_id, Patient.deleted_at.is_(None))
        for clause in apply_date_range(Patient.created_at, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(Patient.created_at.desc()).limit(limit))
        return [
            {
                "id": str(p.id),
                "full_name": p.full_name,
                "patient_code": p.patient_code,
                "created_at": p.created_at.isoformat(),
            }
            for p in result.scalars().all()
        ]

    async def _recent_invoices(
        self, tenant_id: UUID, limit: int = 5, date_from: date | None = None, date_to: date | None = None
    ) -> list[dict]:
        q = (
            select(Invoice, Patient)
            .join(Patient, Invoice.patient_id == Patient.id)
            .where(Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None))
        )
        date_col = func.coalesce(Invoice.issued_at, Invoice.created_at)
        for clause in apply_date_range(date_col, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(Invoice.created_at.desc()).limit(limit))
        return [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "patient_name": patient.full_name,
                "total": float(inv.total),
                "status": inv.status.value,
                "issued_at": inv.issued_at.isoformat() if inv.issued_at else None,
            }
            for inv, patient in result.all()
        ]

    async def _low_stock_items(self, tenant_id: UUID, limit: int = 5) -> list[dict]:
        rows = await self.db.execute(self._stock_query(tenant_id).order_by("qty").limit(limit))
        return [
            {
                "id": str(item.id),
                "sku": item.sku,
                "name": item.name,
                "total_quantity": float(qty or 0),
                "reorder_level": float(item.reorder_level),
            }
            for item, qty in rows.all()
        ]
