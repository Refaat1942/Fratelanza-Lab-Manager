from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.results import LabOrderCreate, LabOrderListItem, ResultEntryCreate, ResultListItem
from app.services.label_service import build_kit_labels_pdf
from app.services.results_service import ResultsService
from app.utils.date_filter import parse_date_param

router = APIRouter(prefix="/results", tags=["Results"])


@router.get("")
async def list_results(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.read"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    params = PaginationParams(page=page, page_size=page_size)
    result = await ResultsService(db).list_results(
        tenant.id, params, parse_date_param(date_from), parse_date_param(date_to)
    )
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
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    params = PaginationParams(page=page, page_size=page_size)
    result = await ResultsService(db).list_orders(
        tenant.id, params, parse_date_param(date_from), parse_date_param(date_to)
    )
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


@router.post("/orders/{order_id}/collect")
async def collect_order(
    order_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.create"),
):
    try:
        order = await ResultsService(db).collect_order(tenant.id, order_id)
        return {
            "id": str(order.id),
            "order_number": order.order_number,
            "status": order.status.value,
            "collected_at": order.collected_at.isoformat() if order.collected_at else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/orders/{order_id}", response_model=MessageResponse)
async def delete_order(
    order_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.create"),
):
    try:
        count = await ResultsService(db).delete_order(tenant.id, order_id)
        return MessageResponse(
            message=f"Order deleted ({count} test(s) removed)",
            message_ar=f"تم حذف الطلب ({count} تحليل)",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{result_id}", response_model=MessageResponse)
async def delete_result(
    result_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.create"),
):
    deleted = await ResultsService(db).delete_result(tenant.id, result_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Result not found")
    return MessageResponse(message="Result deleted", message_ar="تم حذف النتيجة")


@router.get("/orders/{order_id}/labels")
async def order_kit_labels(
    order_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.read"),
    layout: str = Query("single", description="single = one label per row, double = two labels per row (76mm)"),
):
    try:
        labels = await ResultsService(db).get_order_kit_labels(tenant.id, order_id)
        content = build_kit_labels_pdf(labels, layout=layout)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    filename = f"kit_labels_{layout}.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{result_id}/report")
async def result_report_pdf(
    result_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.read"),
):
    try:
        content = await ResultsService(db).get_result_report_pdf(tenant.id, result_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="result_{result_id}.pdf"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/{result_id}/label")
async def result_kit_label(
    result_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.read"),
    layout: str = Query("single", description="single or double (one label centered on double-width page)"),
):
    try:
        label = await ResultsService(db).get_result_kit_label(tenant.id, result_id)
        content = build_kit_labels_pdf([label], layout=layout)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="kit_label.pdf"'},
    )


@router.get("/{result_id}/form")
async def get_result_form(
    result_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("results.read"),
):
    try:
        return await ResultsService(db).get_result_form(tenant.id, result_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


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
