from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryBatch, InventoryItem
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.inventory import InventoryItemCreate, InventoryItemUpdate
from app.services.audit_service import AuditService


class InventoryService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def list_items(
        self, tenant_id: UUID, params: PaginationParams, branch_id: Optional[UUID] = None
    ) -> PaginatedResponse:
        query = select(InventoryItem).where(InventoryItem.tenant_id == tenant_id, InventoryItem.deleted_at.is_(None))
        if branch_id:
            query = query.where(InventoryItem.branch_id == branch_id)
        if params.search:
            term = f"%{params.search}%"
            query = query.where(or_(InventoryItem.name.ilike(term), InventoryItem.name_ar.ilike(term), InventoryItem.sku.ilike(term)))
        count_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar() or 0
        sort_col = getattr(InventoryItem, params.sort_by or "name", InventoryItem.name)
        query = query.order_by(sort_col.desc() if params.sort_order == "desc" else sort_col.asc())
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        enriched = []
        for item in items:
            qty_result = await self.db.execute(
                select(func.coalesce(func.sum(InventoryBatch.quantity), 0)).where(InventoryBatch.item_id == item.id)
            )
            total_qty = float(qty_result.scalar() or 0)
            item_dict = {c.name: getattr(item, c.name) for c in item.__table__.columns}
            item_dict["total_quantity"] = total_qty
            enriched.append(item_dict)

        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=enriched, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def get_item(self, tenant_id: UUID, item_id: UUID) -> Optional[InventoryItem]:
        result = await self.db.execute(
            select(InventoryItem).where(
                InventoryItem.id == item_id, InventoryItem.tenant_id == tenant_id, InventoryItem.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def create_item(self, tenant_id: UUID, data: InventoryItemCreate, user_id: UUID) -> InventoryItem:
        item = InventoryItem(tenant_id=tenant_id, **data.model_dump())
        self.db.add(item)
        await self.db.flush()
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="create", module="inventory",
            entity_type="inventory_item", entity_id=str(item.id), new_values=data.model_dump(mode="json"),
        )
        return item

    async def update_item(
        self, tenant_id: UUID, item_id: UUID, data: InventoryItemUpdate, user_id: UUID
    ) -> Optional[InventoryItem]:
        item = await self.get_item(tenant_id, item_id)
        if not item:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        await self.db.flush()
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="update", module="inventory",
            entity_type="inventory_item", entity_id=str(item.id),
            new_values=data.model_dump(exclude_unset=True, mode="json"),
        )
        return item

    async def delete_item(self, tenant_id: UUID, item_id: UUID, user_id: UUID) -> bool:
        item = await self.get_item(tenant_id, item_id)
        if not item:
            return False
        item.deleted_at = func.now()
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="delete", module="inventory",
            entity_type="inventory_item", entity_id=str(item.id),
        )
        return True
