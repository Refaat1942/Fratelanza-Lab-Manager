from datetime import date
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Supplier
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.suppliers import SupplierCreate, SupplierUpdate
from app.services.audit_service import AuditService
from app.utils.list_date_filter import filter_by_entry_date


class SupplierService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def list_suppliers(
        self,
        tenant_id: UUID,
        params: PaginationParams,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> PaginatedResponse:
        query = select(Supplier).where(Supplier.tenant_id == tenant_id, Supplier.deleted_at.is_(None))
        query = filter_by_entry_date(query, Supplier.created_at, date_from, date_to)
        if params.search:
            term = f"%{params.search}%"
            query = query.where(or_(Supplier.name.ilike(term), Supplier.code.ilike(term)))
        count_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar() or 0
        query = query.order_by(Supplier.name.asc())
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def create_supplier(self, tenant_id: UUID, data: SupplierCreate, user_id: UUID) -> Supplier:
        count_result = await self.db.execute(select(func.count()).where(Supplier.tenant_id == tenant_id))
        num = (count_result.scalar() or 0) + 1
        supplier = Supplier(
            tenant_id=tenant_id,
            code=f"SUP-{num:04d}",
            **data.model_dump(),
        )
        self.db.add(supplier)
        await self.db.flush()
        return supplier

    async def update_supplier(
        self, tenant_id: UUID, supplier_id: UUID, data: SupplierUpdate, user_id: UUID
    ) -> Supplier | None:
        result = await self.db.execute(
            select(Supplier).where(
                Supplier.id == supplier_id, Supplier.tenant_id == tenant_id, Supplier.deleted_at.is_(None)
            )
        )
        supplier = result.scalar_one_or_none()
        if not supplier:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(supplier, key, value)
        await self.db.flush()
        return supplier

    async def delete_supplier(self, tenant_id: UUID, supplier_id: UUID, user_id: UUID) -> bool:
        result = await self.db.execute(
            select(Supplier).where(
                Supplier.id == supplier_id, Supplier.tenant_id == tenant_id, Supplier.deleted_at.is_(None)
            )
        )
        supplier = result.scalar_one_or_none()
        if not supplier:
            return False
        supplier.deleted_at = func.now()
        await self.db.flush()
        return True
