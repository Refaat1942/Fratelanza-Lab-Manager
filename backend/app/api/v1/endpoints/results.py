from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.results import LabOrderCreate, LabOrderListItem, ResultEntryCreate, ResultListItem
from app.services.results_service import ResultsService

router = APIRouter(prefix="/results", tags=["Results"])


@router.get("")
async def list_results(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.read"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    params = PaginationParams(page=page, page_size=page_size)
    result = await ResultsService(db).list_results(tenant.id, params)
    return {
        "items": [ResultListItem.model_validate(i) for i in result.items],
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "pages": result.pages,
    }


@router.get("/orders")
async def list_orders(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.read"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    params = PaginationParams(page=page, page_size=page_size)
    result = await ResultsService(db).list_orders(tenant.id, params)
    return {
        "items": [LabOrderListItem.model_validate(i) for i in result.items],
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "pages": result.pages,
    }


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(
    data: LabOrderCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.create"),
):
    try:
        order = await ResultsService(db).create_order(tenant.id, data, user.id)
        return {"id": str(order.id), "order_number": order.order_number}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{result_id}/enter")
async def enter_result(
    result_id: UUID,
    data: ResultEntryCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.create"),
):
    try:
        await ResultsService(db).enter_result(tenant.id, result_id, data, user.id)
        return MessageResponse(message="Result entered", message_ar="تم إدخال النتيجة")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{result_id}/release")
async def release_result(
    result_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.verify"),
):
    try:
        await ResultsService(db).release_result(tenant.id, result_id)
        return MessageResponse(message="Result released", message_ar="تم إصدار النتيجة")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
