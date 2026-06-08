from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Invoice, InvoiceStatus
from app.models.doctors import Doctor
from app.models.expenses import Expense
from app.models.inventory import InventoryBatch, InventoryItem
from app.models.orders import LabOrder, OrderStatus
from app.models.patients import Patient
from app.models.tests import Test
from app.services.billing_service import BillingService
from app.services.expense_service import ExpenseService


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _date_filters(column, start_date: date | None = None, end_date: date | None = None):
        filters = []
        if start_date:
            filters.append(column >= datetime.combine(start_date, time.min, tzinfo=timezone.utc))
        if end_date:
            filters.append(column <= datetime.combine(end_date, time.max, tzinfo=timezone.utc))
        return filters

    async def get_stats(
        self,
        tenant_id: UUID,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        patients = await self._count(Patient, tenant_id, start_date, end_date)
        doctors = await self._count(Doctor, tenant_id, start_date, end_date)
        tests = await self._count(Test, tenant_id, start_date, end_date)
        inventory_items = await self._count(InventoryItem, tenant_id, start_date, end_date)
        low_stock = await self._count_low_stock(tenant_id)
        return {
            "patients": patients,
            "doctors": doctors,
            "tests": tests,
            "inventory_items": inventory_items,
            "low_stock_items": low_stock,
        }

    async def get_insights(
        self,
        tenant_id: UUID,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        stats = await self.get_stats(tenant_id, start_date, end_date)
        financial = await BillingService(self.db).get_financial_summary(tenant_id, start_date, end_date)
        expenses = await ExpenseService(self.db).get_summary(tenant_id, start_date, end_date)

        pending = await self._order_count(tenant_id, OrderStatus.PENDING, start_date, end_date)
        in_lab = await self._order_count(tenant_id, OrderStatus.IN_LAB, start_date, end_date)
        completed = await self._order_count(tenant_id, OrderStatus.COMPLETED, start_date, end_date)

        recent_patients = await self._recent_patients(tenant_id, start_date, end_date)
        recent_invoices = await self._recent_invoices(tenant_id, start_date, end_date)
        low_stock = await self._low_stock_items(tenant_id)

        net_profit = float(financial["total_collected"]) - float(expenses["total_expenses"])

        return {
            "stats": stats,
            "financial": financial,
            "expenses": expenses,
            "orders": {
                "pending_orders": pending,
                "in_lab_orders": in_lab,
                "completed_orders": completed,
            },
            "recent_patients": recent_patients,
            "recent_invoices": recent_invoices,
            "low_stock": low_stock,
            "net_profit": net_profit,
        }

    async def _count(
        self,
        model,
        tenant_id: UUID,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> int:
        date_column = getattr(model, "created_at", None)
        filters = [model.tenant_id == tenant_id, model.deleted_at.is_(None)]
        if date_column is not None:
            filters.extend(self._date_filters(date_column, start_date, end_date))
        return await self.db.scalar(
            select(func.count()).select_from(model).where(
                *filters
            )
        ) or 0

    async def _count_low_stock(self, tenant_id: UUID) -> int:
        items = await self.db.execute(
            select(InventoryItem).where(
                InventoryItem.tenant_id == tenant_id, InventoryItem.deleted_at.is_(None)
            )
        )
        count = 0
        for item in items.scalars().all():
            qty = await self.db.scalar(
                select(func.coalesce(func.sum(InventoryBatch.quantity), 0)).where(
                    InventoryBatch.item_id == item.id
                )
            )
            if float(qty or 0) <= float(item.reorder_level):
                count += 1
        return count

    async def _order_count(
        self,
        tenant_id: UUID,
        status: OrderStatus,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> int:
        return await self.db.scalar(
            select(func.count()).select_from(LabOrder).where(
                LabOrder.tenant_id == tenant_id,
                LabOrder.deleted_at.is_(None),
                LabOrder.status == status,
                *self._date_filters(LabOrder.ordered_at, start_date, end_date),
            )
        ) or 0

    async def _recent_patients(
        self,
        tenant_id: UUID,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 5,
    ) -> list[dict]:
        result = await self.db.execute(
            select(Patient)
            .where(Patient.tenant_id == tenant_id, Patient.deleted_at.is_(None))
            .where(*self._date_filters(Patient.created_at, start_date, end_date))
            .order_by(Patient.created_at.desc())
            .limit(limit)
        )
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
        self,
        tenant_id: UUID,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 5,
    ) -> list[dict]:
        result = await self.db.execute(
            select(Invoice, Patient)
            .join(Patient, Invoice.patient_id == Patient.id)
            .where(Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None))
            .where(*self._date_filters(Invoice.issued_at, start_date, end_date))
            .order_by(Invoice.created_at.desc())
            .limit(limit)
        )
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
        items = await self.db.execute(
            select(InventoryItem).where(
                InventoryItem.tenant_id == tenant_id, InventoryItem.deleted_at.is_(None)
            ).limit(50)
        )
        low = []
        for item in items.scalars().all():
            qty = await self.db.scalar(
                select(func.coalesce(func.sum(InventoryBatch.quantity), 0)).where(
                    InventoryBatch.item_id == item.id
                )
            )
            total = float(qty or 0)
            if total <= float(item.reorder_level):
                low.append({
                    "id": str(item.id),
                    "sku": item.sku,
                    "name": item.name,
                    "total_quantity": total,
                    "reorder_level": float(item.reorder_level),
                })
        low.sort(key=lambda x: x["total_quantity"])
        return low[:limit]
