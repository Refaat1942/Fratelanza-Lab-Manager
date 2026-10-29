from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expenses import Expense, ExpenseCategory
from app.models.tenant_config import Branch
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.expenses import ExpenseCreate, ExpenseUpdate
from app.utils.date_filter import apply_date_range


class ExpenseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_expenses(
        self,
        tenant_id: UUID,
        params: PaginationParams,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> PaginatedResponse:
        query = select(Expense).where(Expense.tenant_id == tenant_id, Expense.deleted_at.is_(None))
        for clause in apply_date_range(Expense.expense_date, date_from, date_to):
            query = query.where(clause)
        count = await self.db.scalar(select(func.count()).select_from(query.subquery()))
        query = query.order_by(Expense.expense_date.desc()).offset((params.page - 1) * params.page_size).limit(params.page_size)
        items = await self.with_category_names(list((await self.db.execute(query)).scalars().all()))
        total = count or 0
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def create_expense(self, tenant_id: UUID, data: ExpenseCreate, user_id: UUID) -> Expense:
        branch_id = data.branch_id
        if not branch_id:
            branch_id = await self.db.scalar(
                select(Branch.id).where(Branch.tenant_id == tenant_id, Branch.deleted_at.is_(None)).limit(1)
            )
        num = (await self.db.scalar(select(func.count()).where(Expense.tenant_id == tenant_id)) or 0) + 1
        category_id = await self._category_id(tenant_id, data.category_name)
        expense = Expense(
            tenant_id=tenant_id,
            branch_id=branch_id,
            category_id=category_id,
            expense_number=f"EXP-{num:05d}",
            description=data.description,
            amount=data.amount,
            expense_date=data.expense_date or datetime.now(timezone.utc),
            payment_method=data.payment_method,
            vendor=data.vendor,
            reference=data.reference,
            notes=data.notes,
            created_by=user_id,
        )
        self.db.add(expense)
        await self.db.flush()
        return expense

    async def update_expense(self, tenant_id: UUID, expense_id: UUID, data: ExpenseUpdate) -> Expense | None:
        expense = await self.db.scalar(
            select(Expense).where(Expense.id == expense_id, Expense.tenant_id == tenant_id, Expense.deleted_at.is_(None))
        )
        if not expense:
            return None
        values = data.model_dump(exclude_unset=True)
        if "category_name" in values:
            expense.category_id = await self._category_id(tenant_id, values.pop("category_name"))
        for k, v in values.items():
            setattr(expense, k, v)
        await self.db.flush()
        return expense

    async def with_category_names(self, expenses: list[Expense]) -> list[Expense]:
        """Attach category_name (read by ExpenseResponse) in one query."""
        ids = {e.category_id for e in expenses if e.category_id}
        names = {}
        if ids:
            rows = await self.db.execute(select(ExpenseCategory.id, ExpenseCategory.name).where(ExpenseCategory.id.in_(ids)))
            names = dict(rows.all())
        for e in expenses:
            e.category_name = names.get(e.category_id)
        return expenses

    async def _category_id(self, tenant_id: UUID, name: str | None) -> UUID | None:
        name = (name or "").strip()
        if not name:
            return None
        cat = await self.db.scalar(
            select(ExpenseCategory).where(ExpenseCategory.tenant_id == tenant_id, ExpenseCategory.name == name)
        )
        if not cat:
            cat = ExpenseCategory(tenant_id=tenant_id, name=name)
            self.db.add(cat)
            await self.db.flush()
        return cat.id

    async def get_summary(
        self,
        tenant_id: UUID,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> dict:
        exp_q = select(
            func.coalesce(func.sum(Expense.amount), 0),
            func.count(Expense.id),
        ).where(Expense.tenant_id == tenant_id, Expense.deleted_at.is_(None))
        for clause in apply_date_range(Expense.expense_date, date_from, date_to):
            exp_q = exp_q.where(clause)
        result = await self.db.execute(exp_q)
        total, count = result.one()
        return {"total_expenses": float(total), "expense_count": count}

    async def delete_expense(self, tenant_id: UUID, expense_id: UUID) -> bool:
        expense = await self.db.scalar(
            select(Expense).where(Expense.id == expense_id, Expense.tenant_id == tenant_id, Expense.deleted_at.is_(None))
        )
        if not expense:
            return False
        expense.deleted_at = func.now()
        await self.db.flush()
        return True
