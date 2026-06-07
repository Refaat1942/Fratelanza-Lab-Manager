from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import CrmContact, MarketingCampaign
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.crm import CrmContactCreate, CrmContactUpdate, MarketingCampaignCreate


class CrmService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_contacts(self, tenant_id: UUID, params: PaginationParams) -> PaginatedResponse:
        query = select(CrmContact).where(CrmContact.tenant_id == tenant_id, CrmContact.deleted_at.is_(None))
        count = await self.db.scalar(select(func.count()).select_from(query.subquery()))
        query = query.order_by(CrmContact.created_at.desc()).offset((params.page - 1) * params.page_size).limit(params.page_size)
        items = list((await self.db.execute(query)).scalars().all())
        total = count or 0
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def create_contact(self, tenant_id: UUID, data: CrmContactCreate) -> CrmContact:
        c = CrmContact(tenant_id=tenant_id, **data.model_dump())
        self.db.add(c)
        await self.db.flush()
        return c

    async def update_contact(self, tenant_id: UUID, contact_id: UUID, data: CrmContactUpdate) -> CrmContact | None:
        c = await self.db.scalar(
            select(CrmContact).where(CrmContact.id == contact_id, CrmContact.tenant_id == tenant_id, CrmContact.deleted_at.is_(None))
        )
        if not c:
            return None
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(c, k, v)
        await self.db.flush()
        return c

    async def delete_contact(self, tenant_id: UUID, contact_id: UUID) -> bool:
        c = await self.db.scalar(
            select(CrmContact).where(CrmContact.id == contact_id, CrmContact.tenant_id == tenant_id, CrmContact.deleted_at.is_(None))
        )
        if not c:
            return False
        c.deleted_at = func.now()
        await self.db.flush()
        return True

    async def list_campaigns(self, tenant_id: UUID, params: PaginationParams) -> PaginatedResponse:
        query = select(MarketingCampaign).where(MarketingCampaign.tenant_id == tenant_id, MarketingCampaign.deleted_at.is_(None))
        count = await self.db.scalar(select(func.count()).select_from(query.subquery()))
        query = query.order_by(MarketingCampaign.created_at.desc()).offset((params.page - 1) * params.page_size).limit(params.page_size)
        items = list((await self.db.execute(query)).scalars().all())
        total = count or 0
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def create_campaign(self, tenant_id: UUID, data: MarketingCampaignCreate) -> MarketingCampaign:
        c = MarketingCampaign(tenant_id=tenant_id, **data.model_dump())
        self.db.add(c)
        await self.db.flush()
        return c

    async def delete_campaign(self, tenant_id: UUID, campaign_id: UUID) -> bool:
        c = await self.db.scalar(
            select(MarketingCampaign).where(MarketingCampaign.id == campaign_id, MarketingCampaign.tenant_id == tenant_id)
        )
        if not c:
            return False
        c.deleted_at = func.now()
        await self.db.flush()
        return True
