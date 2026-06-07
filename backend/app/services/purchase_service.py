from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import POStatus, PurchaseOrder, PurchaseOrderItem, Supplier
from app.schemas.common import PaginatedResponse, PaginationParams


class PurchaseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_orders(self, tenant_id: UUID, params: PaginationParams) -> PaginatedResponse:
        query = (
            select(PurchaseOrder, Supplier)
            .join(Supplier, PurchaseOrder.supplier_id == Supplier.id)
            .where(PurchaseOrder.tenant_id == tenant_id, PurchaseOrder.deleted_at.is_(None))
            .order_by(PurchaseOrder.order_date.desc())
        )
        count = await self.db.scalar(select(func.count()).select_from(
            select(PurchaseOrder.id).where(PurchaseOrder.tenant_id == tenant_id, PurchaseOrder.deleted_at.is_(None)).subquery()
        ))
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        items = []
        for po, supplier in (await self.db.execute(query)).all():
            items.append({
                "id": po.id,
                "po_number": po.po_number,
                "supplier_name": supplier.name,
                "status": po.status.value,
                "total_amount": float(po.total_amount),
                "order_date": po.order_date,
            })
        total = count or 0
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def create_order(self, tenant_id: UUID, supplier_id: UUID, branch_id: UUID, notes: str | None = None) -> PurchaseOrder:
        num = (await self.db.scalar(select(func.count()).where(PurchaseOrder.tenant_id == tenant_id)) or 0) + 1
        po = PurchaseOrder(
            tenant_id=tenant_id,
            branch_id=branch_id,
            supplier_id=supplier_id,
            po_number=f"PO-{num:05d}",
            status=POStatus.DRAFT,
            order_date=datetime.now(timezone.utc),
            notes=notes,
        )
        self.db.add(po)
        await self.db.flush()
        return po

    async def delete_order(self, tenant_id: UUID, po_id: UUID) -> bool:
        po = await self.db.scalar(
            select(PurchaseOrder).where(PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == tenant_id, PurchaseOrder.deleted_at.is_(None))
        )
        if not po:
            return False
        po.deleted_at = func.now()
        await self.db.flush()
        return True
