from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.suppliers import SupplierCreate, SupplierResponse, SupplierUpdate
from app.services.supplier_service import SupplierService

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("")
async def list_suppliers(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.read"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    params = PaginationParams(page=page, page_size=page_size, search=search)
    result = await SupplierService(db).list_suppliers(tenant.id, params)
    return {
        "items": [SupplierResponse.model_validate(s) for s in result.items],
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "pages": result.pages,
    }


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.manage"),
):
    supplier = await SupplierService(db).create_supplier(tenant.id, data, user.id)
    return SupplierResponse.model_validate(supplier)


@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: UUID,
    data: SupplierUpdate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.manage"),
):
    supplier = await SupplierService(db).update_supplier(tenant.id, supplier_id, data, user.id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return SupplierResponse.model_validate(supplier)


@router.delete("/{supplier_id}", response_model=MessageResponse)
async def delete_supplier(
    supplier_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("inventory.manage"),
):
    deleted = await SupplierService(db).delete_supplier(tenant.id, supplier_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return MessageResponse(message="Supplier deleted", message_ar="تم حذف المورد")
