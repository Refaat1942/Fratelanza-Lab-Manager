from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.referrals import ReferralCreate, ReferralResponse
from app.services.referral_service import ReferralService

router = APIRouter(prefix="/referrals", tags=["Referrals"])


@router.get("")
async def list_referrals(
    db: DbSession, tenant: CurrentTenant,
    user: CurrentUser = require_permission("doctors.read"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
):
    result = await ReferralService(db).list_referrals(tenant.id, PaginationParams(page=page, page_size=page_size))
    return {"items": [ReferralResponse.model_validate(i) for i in result.items], "total": result.total, "page": result.page, "page_size": result.page_size, "pages": result.pages}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_referral(data: ReferralCreate, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("doctors.create")):
    ref = await ReferralService(db).create_referral(tenant.id, data)
    return {"id": str(ref.id)}


@router.delete("/{referral_id}", response_model=MessageResponse)
async def delete_referral(referral_id: UUID, db: DbSession, tenant: CurrentTenant, user: CurrentUser = require_permission("doctors.delete")):
    if not await ReferralService(db).delete_referral(tenant.id, referral_id):
        raise HTTPException(status_code=404, detail="Referral not found")
    return MessageResponse(message="Referral deleted", message_ar="تم حذف الإحالة")
