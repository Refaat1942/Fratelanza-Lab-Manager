from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.v1.endpoints._date_filters import date_range_bounds
from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.expenses import ExpenseCreate, ExpenseResponse, ExpenseUpdate
from app.services.expense_service import ExpenseService

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("/summary")
async def expense_summary(
    db: DbSession, tenant: CurrentTenant,
    user: CurrentUser = require_permission("billing.read"),
    date_from: date | None = None,
    date_to: date | None = None,
):
    start, end = date_range_bounds(date_from, date_to)
    return await ExpenseService(db).get_summary(tenant.id, start, end)


@router.get("")
async def list_expenses(
    db: DbSession, tenant: CurrentTenant,
    user: CurrentUser = require_permission("billing.read"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    date_from: date | None = None,
    date_to: date | None = None,
):
    start, end = date_range_bounds(date_from, date_to)
    result = await ExpenseService(db).list_expenses(tenant.id, PaginationParams(page=page, page_size=page_size), start, end)
    return {"items": [ExpenseResponse.model_validate(i) for i in result.items], "total": result.total, "page": result.page, "page_size": result.page_size, "pages": result.pages}


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(data: ExpenseCreate, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("billing.create")):
    return ExpenseResponse.model_validate(await ExpenseService(db).create_expense(tenant.id, data, user.id))


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(expense_id: UUID, data: ExpenseUpdate, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("billing.create")):
    expense = await ExpenseService(db).update_expense(tenant.id, expense_id, data)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return ExpenseResponse.model_validate(expense)


@router.delete("/{expense_id}", response_model=MessageResponse)
async def delete_expense(expense_id: UUID, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("billing.create")):
    if not await ExpenseService(db).delete_expense(tenant.id, expense_id):
        raise HTTPException(status_code=404, detail="Expense not found")
    return MessageResponse(message="Expense deleted", message_ar="تم حذف المصروف")
