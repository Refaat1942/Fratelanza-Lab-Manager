from datetime import date, datetime, timezone
from io import BytesIO
from uuid import UUID

from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Invoice, InvoiceStatus, Payment
from app.models.doctors import Doctor, Referral
from app.models.expenses import Expense, ExpenseCategory
from app.models.inventory import InventoryBatch, InventoryItem
from app.models.orders import LabOrder, LabOrderItem, OrderStatus
from app.models.patients import Patient
from app.models.tests import Test
from app.models.tenant_config import Branch
from app.services.billing_service import BillingService
from app.services.daily_operations_labels import DAILY_OPERATIONS_LABELS_AR
from app.services.expense_service import ExpenseService
from app.utils.date_filter import apply_date_range, date_end, date_start


REPORT_TYPES = {"daily", "monthly", "profitability", "inventory", "referrals", "patients", "branches", "labs_done"}


class ReportsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def export_report(
        self,
        tenant_id: UUID,
        report_type: str,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> tuple[bytes, str]:
        if report_type not in REPORT_TYPES:
            raise ValueError(f"Unknown report type: {report_type}")

        filename = f"{report_type}_report.xlsx"
        if report_type == "daily":
            headers, rows = await self._daily_report(tenant_id, date_from, date_to)
            filename = "daily_operations_ar.xlsx"
        elif report_type == "monthly":
            headers, rows = await self._monthly_report(tenant_id, date_from, date_to)
            filename = "monthly_operations_ar.xlsx"
        elif report_type == "profitability":
            headers, rows = await self._profitability_report(tenant_id, date_from, date_to)
        elif report_type == "inventory":
            headers, rows = await self._inventory_report(tenant_id)
        elif report_type == "referrals":
            headers, rows = await self._referrals_report(tenant_id, date_from, date_to)
        elif report_type == "patients":
            headers, rows = await self._patients_report(tenant_id, date_from, date_to)
        elif report_type == "labs_done":
            headers, rows = await self._labs_done_report(tenant_id, date_from, date_to)
        else:
            headers, rows = await self._branches_report(tenant_id, date_from, date_to)

        return self._to_xlsx(headers, rows), filename

    def _to_xlsx(self, headers: list[str], rows: list[list]) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = "Report"
        bold = Font(bold=True)
        ws.append(headers)
        for cell in ws[1]:
            cell.font = bold
        for row in rows:
            ws.append(row)
        buf = BytesIO()
        wb.save(buf)
        return buf.getvalue()

    async def _daily_operations_metrics(
        self, tenant_id: UUID, date_from: date | None, date_to: date | None
    ) -> dict:
        today = datetime.now(timezone.utc).date()
        d_from = date_from or today
        d_to = date_to or today
        date_col = func.coalesce(Invoice.issued_at, Invoice.created_at)

        inv_q = select(
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total), 0),
            func.coalesce(func.sum(Invoice.paid_amount), 0),
        ).where(Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None))
        for clause in apply_date_range(date_col, d_from, d_to):
            inv_q = inv_q.where(clause)
        inv_count, inv_gross, inv_paid_on_invoices = (await self.db.execute(inv_q)).one()

        pay_q = select(func.coalesce(func.sum(Payment.amount), 0)).join(
            Invoice, Payment.invoice_id == Invoice.id
        ).where(Invoice.tenant_id == tenant_id, Invoice.deleted_at.is_(None))
        for clause in apply_date_range(Payment.paid_at, d_from, d_to):
            pay_q = pay_q.where(clause)
        collected = (await self.db.execute(pay_q)).scalar() or 0

        exp_q = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.tenant_id == tenant_id, Expense.deleted_at.is_(None)
        )
        for clause in apply_date_range(Expense.expense_date, d_from, d_to):
            exp_q = exp_q.where(clause)
        expenses = (await self.db.execute(exp_q)).scalar() or 0

        pat_q = select(func.count()).select_from(Patient).where(
            Patient.tenant_id == tenant_id, Patient.deleted_at.is_(None)
        )
        for clause in apply_date_range(Patient.created_at, d_from, d_to):
            pat_q = pat_q.where(clause)
        new_patients = (await self.db.execute(pat_q)).scalar() or 0

        ord_q = select(func.count()).select_from(LabOrder).where(
            LabOrder.tenant_id == tenant_id, LabOrder.deleted_at.is_(None)
        )
        for clause in apply_date_range(LabOrder.ordered_at, d_from, d_to):
            ord_q = ord_q.where(clause)
        orders = (await self.db.execute(ord_q)).scalar() or 0

        gross = float(inv_gross or 0)
        paid_on_invoices = float(inv_paid_on_invoices or 0)
        remaining = max(gross - paid_on_invoices, 0)
        collected_f = float(collected)
        expenses_f = float(expenses)

        return {
            "period_from": d_from.isoformat(),
            "period_to": d_to.isoformat(),
            "invoice_count": int(inv_count or 0),
            "gross_amount": gross,
            "collected": collected_f,
            "remaining": remaining,
            "expenses": expenses_f,
            "net": collected_f - expenses_f,
            "new_patients": int(new_patients or 0),
            "lab_orders": int(orders or 0),
        }

    def _daily_report_rows_ar(self, metrics: dict) -> tuple[list[str], list[list]]:
        labels = DAILY_OPERATIONS_LABELS_AR
        headers = ["البند", "القيمة"]
        rows = [
            [labels["period_from"], metrics["period_from"]],
            [labels["period_to"], metrics["period_to"]],
            [labels["invoice_count"], metrics["invoice_count"]],
            [labels["gross_amount"], metrics["gross_amount"]],
            [labels["collected"], metrics["collected"]],
            [labels["remaining"], metrics["remaining"]],
            [labels["expenses"], metrics["expenses"]],
            [labels["net"], metrics["net"]],
            [labels["new_patients"], metrics["new_patients"]],
            [labels["lab_orders"], metrics["lab_orders"]],
        ]
        return headers, rows

    async def _daily_report(self, tenant_id: UUID, date_from, date_to):
        metrics = await self._daily_operations_metrics(tenant_id, date_from, date_to)
        return self._daily_report_rows_ar(metrics)

    async def _monthly_report(self, tenant_id: UUID, date_from, date_to):
        return await self._daily_report(tenant_id, date_from, date_to)

    async def _profitability_report(self, tenant_id: UUID, date_from, date_to):
        financial = await BillingService(self.db).get_financial_summary(
            tenant_id, date_from=date_from, date_to=date_to
        )
        expenses = await ExpenseService(self.db).get_summary(
            tenant_id, date_from=date_from, date_to=date_to
        )
        invoiced = float(financial["total_invoiced"])
        collected = float(financial["total_collected"])
        outstanding = float(financial["outstanding"])
        total_exp = float(expenses["total_expenses"])
        net = collected - total_exp
        inv_count = int(financial["invoice_count"] or 0)
        avg_invoice = invoiced / inv_count if inv_count else 0
        collection_rate = (collected / invoiced * 100) if invoiced else 0
        margin = (net / collected * 100) if collected else 0

        exp_cat_q = (
            select(ExpenseCategory.name, func.coalesce(func.sum(Expense.amount), 0))
            .join(Expense, Expense.category_id == ExpenseCategory.id)
            .where(Expense.tenant_id == tenant_id, Expense.deleted_at.is_(None))
        )
        for clause in apply_date_range(Expense.expense_date, date_from, date_to):
            exp_cat_q = exp_cat_q.where(clause)
        exp_by_cat = await self.db.execute(exp_cat_q.group_by(ExpenseCategory.name))
        cat_rows = list(exp_by_cat.all())

        headers = ["Metric", "Value"]
        rows = [
            ["Period From", date_from.isoformat() if date_from else "All"],
            ["Period To", date_to.isoformat() if date_to else "All"],
            ["Total Invoiced (EGP)", invoiced],
            ["Total Collected (EGP)", collected],
            ["Outstanding (EGP)", outstanding],
            ["Collection Rate (%)", round(collection_rate, 2)],
            ["Average Invoice (EGP)", round(avg_invoice, 2)],
            ["Total Expenses (EGP)", total_exp],
            ["Net Profit (EGP)", net],
            ["Profit Margin (%)", round(margin, 2)],
            ["Invoice Count", inv_count],
            ["Expense Count", expenses["expense_count"]],
            ["", ""],
            ["Expense Category", "Amount (EGP)"],
        ]
        for cat_name, cat_total in cat_rows:
            rows.append([cat_name or "Uncategorized", float(cat_total or 0)])
        return headers, rows

    async def _labs_done_report(self, tenant_id: UUID, date_from, date_to):
        q = (
            select(LabOrder, Patient, Doctor)
            .join(Patient, LabOrder.patient_id == Patient.id)
            .outerjoin(Doctor, LabOrder.referring_doctor_id == Doctor.id)
            .where(
                LabOrder.tenant_id == tenant_id,
                LabOrder.deleted_at.is_(None),
                LabOrder.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED]),
            )
        )
        date_col = func.coalesce(LabOrder.completed_at, LabOrder.ordered_at)
        for clause in apply_date_range(date_col, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(LabOrder.ordered_at.desc()))

        headers = [
            "رقم الطلب", "المريض", "الهاتف", "الطبيب", "التحاليل", "الحالة",
            "تاريخ الطلب", "تاريخ الإنجاز", "رقم الفاتورة", "الإجمالي (جنيه)",
            "المحصّل (جنيه)", "المتبقي (جنيه)",
        ]
        rows = []
        for order, patient, doctor in result.all():
            items_result = await self.db.execute(
                select(Test.name)
                .join(LabOrderItem, LabOrderItem.test_id == Test.id)
                .where(LabOrderItem.order_id == order.id)
            )
            test_names = ", ".join(t[0] for t in items_result.all())

            inv_result = await self.db.execute(
                select(Invoice.invoice_number, Invoice.total, Invoice.paid_amount)
                .where(Invoice.order_id == order.id, Invoice.deleted_at.is_(None))
                .limit(1)
            )
            inv_row = inv_result.first()
            inv_total = float(inv_row[1]) if inv_row else 0
            inv_paid = float(inv_row[2]) if inv_row else 0

            rows.append([
                order.order_number,
                patient.full_name,
                patient.phone or "",
                doctor.full_name if doctor else "",
                test_names,
                order.status.value if order.status else "",
                order.ordered_at.strftime("%Y-%m-%d %H:%M") if order.ordered_at else "",
                order.completed_at.strftime("%Y-%m-%d %H:%M") if order.completed_at else "",
                inv_row[0] if inv_row else "",
                inv_total,
                inv_paid,
                max(inv_total - inv_paid, 0),
            ])
        return headers, rows

    async def _inventory_report(self, tenant_id: UUID):
        items = await self.db.execute(
            select(InventoryItem).where(InventoryItem.tenant_id == tenant_id, InventoryItem.deleted_at.is_(None))
        )
        headers = ["SKU", "Name", "Quantity", "Unit Cost", "Value (EGP)", "Reorder Level"]
        rows = []
        total_value = 0.0
        for item in items.scalars().all():
            batch_result = await self.db.execute(
                select(func.coalesce(func.sum(InventoryBatch.quantity), 0),
                       func.coalesce(func.avg(InventoryBatch.unit_cost), 0))
                .where(InventoryBatch.item_id == item.id)
            )
            qty, avg_cost = batch_result.one()
            qty = float(qty or 0)
            avg_cost = float(avg_cost or 0)
            value = qty * avg_cost
            total_value += value
            rows.append([item.sku, item.name, qty, avg_cost, value, float(item.reorder_level)])
        rows.append(["", "TOTAL", "", "", total_value, ""])
        return headers, rows

    async def _referrals_report(self, tenant_id: UUID, date_from, date_to):
        q = (
            select(Referral, Doctor, Patient)
            .join(Doctor, Referral.doctor_id == Doctor.id)
            .join(Patient, Referral.patient_id == Patient.id)
            .where(Referral.tenant_id == tenant_id)
        )
        for clause in apply_date_range(Referral.referral_date, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(Referral.referral_date.desc()))
        headers = ["Date", "Doctor", "Patient", "Notes"]
        rows = [
            [r.referral_date.strftime("%Y-%m-%d") if r.referral_date else "", doc.full_name, pat.full_name, r.notes or ""]
            for r, doc, pat in result.all()
        ]
        return headers, rows

    async def _patients_report(self, tenant_id: UUID, date_from, date_to):
        q = select(Patient).where(Patient.tenant_id == tenant_id, Patient.deleted_at.is_(None))
        for clause in apply_date_range(Patient.created_at, date_from, date_to):
            q = q.where(clause)
        result = await self.db.execute(q.order_by(Patient.created_at.desc()))
        headers = ["Code", "Name", "Phone", "City", "Gender", "Registered"]
        rows = [
            [p.patient_code, p.full_name, p.phone or "", p.city or "", p.gender or "",
             p.created_at.strftime("%Y-%m-%d") if p.created_at else ""]
            for p in result.scalars().all()
        ]
        return headers, rows

    async def _branches_report(self, tenant_id: UUID, date_from, date_to):
        branches = await self.db.execute(
            select(Branch).where(Branch.tenant_id == tenant_id, Branch.deleted_at.is_(None))
        )
        headers = ["Branch", "Invoices", "Revenue (EGP)", "Patients"]
        rows = []
        for branch in branches.scalars().all():
            inv_q = select(func.count(), func.coalesce(func.sum(Invoice.total), 0)).where(
                Invoice.tenant_id == tenant_id, Invoice.branch_id == branch.id, Invoice.deleted_at.is_(None)
            )
            for clause in apply_date_range(func.coalesce(Invoice.issued_at, Invoice.created_at), date_from, date_to):
                inv_q = inv_q.where(clause)
            inv_count, revenue = (await self.db.execute(inv_q)).one()

            pat_q = select(func.count()).select_from(Patient).where(
                Patient.tenant_id == tenant_id, Patient.branch_id == branch.id, Patient.deleted_at.is_(None)
            )
            for clause in apply_date_range(Patient.created_at, date_from, date_to):
                pat_q = pat_q.where(clause)
            pat_count = (await self.db.execute(pat_q)).scalar() or 0

            rows.append([branch.name, int(inv_count or 0), float(revenue or 0), int(pat_count)])
        return headers, rows

    async def get_daily_operations_data(self, tenant_id: UUID, date_from: date, date_to: date) -> dict:
        metrics = await self._daily_operations_metrics(tenant_id, date_from, date_to)
        headers, rows = self._daily_report_rows_ar(metrics)
        return {
            "title": DAILY_OPERATIONS_LABELS_AR["title"],
            "metrics": metrics,
            "headers": headers,
            "rows": [[str(c) for c in row] for row in rows],
        }
