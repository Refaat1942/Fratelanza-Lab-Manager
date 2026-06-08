from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.crm import CrmContactCreate, CrmContactResponse, CrmContactUpdate, MarketingCampaignCreate, MarketingCampaignResponse
from app.services.crm_service import CrmService
from app.utils.date_filter import parse_date_param

router = APIRouter(prefix="/crm", tags=["CRM"])


@router.get("/contacts")
async def list_contacts(
    db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("reports.read"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    result = await CrmService(db).list_contacts(
        tenant.id,
        PaginationParams(page=page, page_size=page_size),
        parse_date_param(date_from),
        parse_date_param(date_to),
    )
    return {"items": [CrmContactResponse.model_validate(i) for i in result.items], "total": result.total, "page": result.page, "page_size": result.page_size, "pages": result.pages}


@router.post("/contacts", response_model=CrmContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(data: CrmContactCreate, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("reports.read")):
    return CrmContactResponse.model_validate(await CrmService(db).create_contact(tenant.id, data))


@router.put("/contacts/{contact_id}", response_model=CrmContactResponse)
async def update_contact(contact_id: UUID, data: CrmContactUpdate, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("reports.read")):
    c = await CrmService(db).update_contact(tenant.id, contact_id, data)
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    return CrmContactResponse.model_validate(c)


@router.delete("/contacts/{contact_id}", response_model=MessageResponse)
async def delete_contact(contact_id: UUID, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("reports.read")):
    if not await CrmService(db).delete_contact(tenant.id, contact_id):
        raise HTTPException(status_code=404, detail="Contact not found")
    return MessageResponse(message="Contact deleted", message_ar="تم حذف جهة الاتصال")


@router.get("/campaigns")
async def list_campaigns(
    db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("reports.read"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    result = await CrmService(db).list_campaigns(
        tenant.id,
        PaginationParams(page=page, page_size=page_size),
        parse_date_param(date_from),
        parse_date_param(date_to),
    )
    return {"items": [MarketingCampaignResponse.model_validate({**{c.name: getattr(i, c.name) for c in i.__table__.columns}, "status": i.status.value}) for i in result.items], "total": result.total, "page": result.page, "page_size": result.page_size, "pages": result.pages}


@router.post("/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(data: MarketingCampaignCreate, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("reports.read")):
    c = await CrmService(db).create_campaign(tenant.id, data)
    return {"id": str(c.id), "name": c.name}


@router.delete("/campaigns/{campaign_id}", response_model=MessageResponse)
async def delete_campaign(campaign_id: UUID, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("reports.read")):
    if not await CrmService(db).delete_campaign(tenant.id, campaign_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
    return MessageResponse(message="Campaign deleted", message_ar="تم حذف الحملة")
