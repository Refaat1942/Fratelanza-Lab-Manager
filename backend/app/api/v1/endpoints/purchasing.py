from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.models.tenant_config import Branch
from app.schemas.common import MessageResponse, PaginationParams
from app.services.purchase_service import PurchaseService
from sqlalchemy import select

router = APIRouter(prefix="/purchasing", tags=["Purchasing"])


class POCreate(BaseModel):
    supplier_id: UUID
    branch_id: UUID | None = None
    notes: str | None = None


@router.get("/orders")
async def list_purchase_orders(
    db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("inventory.read"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
):
    result = await PurchaseService(db).list_orders(tenant.id, PaginationParams(page=page, page_size=page_size))
    return {"items": result.items, "total": result.total, "page": result.page, "page_size": result.page_size, "pages": result.pages}


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_purchase_order(data: POCreate, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("inventory.manage")):
    branch_id = data.branch_id
    if not branch_id:
        branch_id = await db.scalar(select(Branch.id).where(Branch.tenant_id == tenant.id, Branch.deleted_at.is_(None)).limit(1))
    po = await PurchaseService(db).create_order(tenant.id, data.supplier_id, branch_id, data.notes)
    return {"id": str(po.id), "po_number": po.po_number}


@router.delete("/orders/{po_id}", response_model=MessageResponse)
async def delete_purchase_order(po_id: UUID, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("inventory.manage")):
    if not await PurchaseService(db).delete_order(tenant.id, po_id):
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return MessageResponse(message="PO deleted", message_ar="تم حذف أمر الشراء")
