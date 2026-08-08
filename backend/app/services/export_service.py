from datetime import date
from io import BytesIO
from uuid import UUID

from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Invoice, Payment
from app.models.doctors import Doctor
from app.models.expenses import Expense
from app.models.inventory import InventoryBatch, InventoryItem
from app.models.orders import LabOrder
from app.models.patients import Patient
from app.models.tests import Test
from app.models.tenant_config import Branch
from app.utils.date_filter import apply_date_range


EXPORT_MODULES = {
    "patients", "doctors", "tests", "results", "billing",
    "expenses", "inventory", "branches", "users",
}


class ExportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def export_excel(
        self,
        tenant_id: UUID,
        module: str,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> tuple[bytes, str]:
        if module not in EXPORT_MODULES:
            raise ValueError(f"Unknown export module: {module}")

        handlers = {
            "patients": self._export_patients,
            "doctors": self._export_doctors,
            "tests": self._export_tests,
            "results": self._export_results,
            "billing": self._export_billing,
            "expenses": self._export_expenses,
            "inventory": self._export_inventory,
            "branches": self._export_branches,
            "users": self._export_users,
        }

        headers, rows = await handlers[module](tenant_id, date_from, date_to)
        return self._to_xlsx(headers, rows), f"{module}_export.xlsx"

    def _to_xlsx(self, headers: list[str], rows: list[list]) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = "Export"
        bold = Font(bold=True)
        ws.append(headers)
        for cell in ws[1]:
            cell.font = bold
        for row in rows:
            ws.append(row)
        for col in ws.columns:
            max_len = max(len(str(c.value or "")) for c in col)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)
        buf = BytesIO()
        wb.save(buf)
        return buf.getvalue()

    async def _export_patients(self, tenant_id: UUID, date_from, date_to):
        q = select(Patient).where(Patient.tenant_id == tenant_id, Patient.deleted_at.is_(None))
        for clause in apply_date_range(Patient.created_at, date_from, date_to):
            q = q.where(clause)
        q = q.order_by(Patient.created_at.desc())
        result = await self.db.execute(q)
        headers = ["Code", "Name", "Name AR", "Phone", "National ID", "City", "Gender", "Created"]
        rows = [
            [p.patient_code, p.full_name, p.full_name_ar or "", p.phone or "", p.national_id or "",
             p.city or "", p.gender or "", p.created_at.strftime("%Y-%m-%d") if p.created_at else ""]
            for p in result.scalars().all()
        ]
        return headers, rows

    async def _export_doctors(self, tenant_id: UUID, date_from, date_to):
        q = select(Doctor).where(Doctor.tenant_id == tenant_id, Doctor.deleted_at.is_(None))
        for clause in apply_date_range(Doctor.created_at, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(Doctor.full_name))
        headers = ["Name", "Specialty", "Phone", "Email", "Commission %", "Created"]
        rows = [
            [d.full_name, d.specialty or "", d.phone or "", d.email or "",
             float(d.commission_rate or 0), d.created_at.strftime("%Y-%m-%d") if d.created_at else ""]
            for d in result.scalars().all()
        ]
        return headers, rows

    async def _export_tests(self, tenant_id: UUID, date_from, date_to):
        q = select(Test).where(Test.tenant_id == tenant_id, Test.deleted_at.is_(None))
        for clause in apply_date_range(Test.created_at, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(Test.name))
        headers = ["Code", "Name", "Price", "Active", "Created"]
        rows = [
            [t.code, t.name, float(t.price), "Yes" if t.is_active else "No",
             t.created_at.strftime("%Y-%m-%d") if t.created_at else ""]
            for t in result.scalars().all()
        ]
        return headers, rows

    async def _export_results(self, tenant_id: UUID, date_from, date_to):
        q = select(LabOrder).where(LabOrder.tenant_id == tenant_id, LabOrder.deleted_at.is_(None))
        for clause in apply_date_range(LabOrder.ordered_at, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(LabOrder.ordered_at.desc()))
        headers = ["Order #", "Patient", "Status", "Ordered At"]
        rows = [
            [o.order_number, str(o.patient_id), o.status.value if o.status else "",
             o.ordered_at.strftime("%Y-%m-%d %H:%M") if o.ordered_at else ""]
            for o in result.scalars().all()
        ]
        return headers, rows

    async def _export_billing(self, tenant_id: UUID, date_from, date_to):
        q = (
            select(Invoice, Patient)
            .join(Patient, Invoice.patient_id == Patient.id)
            .where(Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None))
        )
        col = func.coalesce(Invoice.issued_at, Invoice.created_at)
        for clause in apply_date_range(col, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(Invoice.created_at.desc()))
        headers = ["Invoice #", "Patient", "Subtotal", "Discount", "Total", "Paid", "Remaining", "Status", "Issued"]
        rows = [
            [inv.invoice_number, patient.full_name, float(inv.subtotal), float(inv.discount),
             float(inv.total), float(inv.paid_amount), max(float(inv.total) - float(inv.paid_amount), 0),
             inv.status.value,
             (inv.issued_at or inv.created_at).strftime("%Y-%m-%d") if (inv.issued_at or inv.created_at) else ""]
            for inv, patient in result.all()
        ]
        return headers, rows

    async def _export_expenses(self, tenant_id: UUID, date_from, date_to):
        q = select(Expense).where(Expense.tenant_id == tenant_id, Expense.deleted_at.is_(None))
        for clause in apply_date_range(Expense.expense_date, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(Expense.expense_date.desc()))
        headers = ["Date", "Description", "Amount", "Payment Method", "Vendor"]
        rows = [
            [e.expense_date.strftime("%Y-%m-%d") if e.expense_date else "",
             e.description or "", float(e.amount), e.payment_method or "", e.vendor or ""]
            for e in result.scalars().all()
        ]
        return headers, rows

    async def _export_inventory(self, tenant_id: UUID, date_from, date_to):
        q = select(InventoryItem).where(InventoryItem.tenant_id == tenant_id, InventoryItem.deleted_at.is_(None))
        for clause in apply_date_range(InventoryItem.created_at, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(InventoryItem.name))
        headers = ["SKU", "Name", "Unit", "Reorder Level", "Quantity", "Created"]
        rows = []
        for item in result.scalars().all():
            qty = await self.db.scalar(
                select(func.coalesce(func.sum(InventoryBatch.quantity), 0)).where(InventoryBatch.item_id == item.id)
            )
            rows.append([
                item.sku, item.name, item.unit or "", float(item.reorder_level), float(qty or 0),
                item.created_at.strftime("%Y-%m-%d") if item.created_at else "",
            ])
        return headers, rows

    async def _export_branches(self, tenant_id: UUID, date_from, date_to):
        q = select(Branch).where(Branch.tenant_id == tenant_id, Branch.deleted_at.is_(None))
        for clause in apply_date_range(Branch.created_at, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(Branch.name))
        headers = ["Code", "Name", "City", "Phone", "HQ", "Active"]
        rows = [
            [b.code, b.name, b.city or "", b.phone or "",
             "Yes" if b.is_headquarters else "No", "Yes" if b.is_active else "No"]
            for b in result.scalars().all()
        ]
        return headers, rows

    async def _export_users(self, tenant_id: UUID, date_from, date_to):
        from app.models.auth import User
        q = select(User).where(
            User.tenant_id == tenant_id, User.deleted_at.is_(None), User.is_system.is_(False)
        )
        for clause in apply_date_range(User.created_at, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(User.full_name))
        headers = ["Name", "Username", "Email", "Active", "Created"]
        rows = [
            [u.full_name, u.username, u.email or "", "Yes" if u.is_active else "No",
             u.created_at.strftime("%Y-%m-%d") if u.created_at else ""]
            for u in result.scalars().all()
        ]
        return headers, rows
