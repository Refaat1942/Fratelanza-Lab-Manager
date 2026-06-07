from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.inventory import InventoryItemCreate, InventoryItemResponse, InventoryItemUpdate
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("")
async def list_inventory(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.read"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    branch_id: UUID | None = None,
    sort_by: str | None = "name",
    sort_order: str = "asc",
):
    params = PaginationParams(page=page, page_size=page_size, search=search, sort_by=sort_by, sort_order=sort_order)
    result = await InventoryService(db).list_items(tenant.id, params, branch_id)
    return {
        "items": [InventoryItemResponse.model_validate(i) for i in result.items],
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "pages": result.pages,
    }


@router.get("/import/template")
async def download_import_template(
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.read"),
):
    content = InventoryService.generate_import_template()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=inventory_import_template.xlsx"},
    )


@router.post("/import")
async def import_inventory(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.manage"),
    file: UploadFile = File(...),
):
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Upload an Excel file (.xlsx)")
    content = await file.read()
    try:
        result = await InventoryService(db).import_from_excel(tenant.id, content, user.id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    data: InventoryItemCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.manage"),
):
    item = await InventoryService(db).create_item(tenant.id, data, user.id)
    return InventoryItemResponse.model_validate({**{c.name: getattr(item, c.name) for c in item.__table__.columns}, "total_quantity": 0})


@router.get("/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.read"),
):
    item = await InventoryService(db).get_item(tenant.id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return InventoryItemResponse.model_validate({**{c.name: getattr(item, c.name) for c in item.__table__.columns}, "total_quantity": 0})


@router.put("/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: UUID,
    data: InventoryItemUpdate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.manage"),
):
    item = await InventoryService(db).update_item(tenant.id, item_id, data, user.id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return InventoryItemResponse.model_validate({**{c.name: getattr(item, c.name) for c in item.__table__.columns}, "total_quantity": 0})


@router.delete("/{item_id}", response_model=MessageResponse)
async def delete_inventory_item(
    item_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.manage"),
):
    deleted = await InventoryService(db).delete_item(tenant.id, item_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found")
    return MessageResponse(message="Item deleted", message_ar="تم حذف الصنف")
