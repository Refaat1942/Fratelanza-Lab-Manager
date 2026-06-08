from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.users import TenantUserCreate, TenantUserResponse
from app.services.user_service import UserService
from app.utils.date_filter import parse_date_param

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("")
async def list_users(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("users.manage"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    params = PaginationParams(page=page, page_size=page_size)
    result = await UserService(db).list_users(
        tenant.id, params, parse_date_param(date_from), parse_date_param(date_to)
    )
    return {
        "items": [TenantUserResponse.model_validate(i) for i in result.items],
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "pages": result.pages,
    }


@router.post("", response_model=TenantUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: TenantUserCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("users.manage"),
):
    try:
        new_user = await UserService(db).create_user(tenant.id, data)
        return TenantUserResponse(
            id=new_user.id,
            username=new_user.username,
            email=new_user.email,
            full_name=new_user.full_name,
            full_name_ar=new_user.full_name_ar,
            phone=new_user.phone,
            is_active=new_user.is_active,
            is_tenant_admin=new_user.is_tenant_admin,
            roles=[],
            created_at=new_user.created_at,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{user_id}", response_model=MessageResponse)
async def deactivate_user(
    user_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("users.manage"),
):
    if str(user.id) == str(user_id):
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    ok = await UserService(db).deactivate_user(tenant.id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return MessageResponse(message="User deactivated", message_ar="تم تعطيل المستخدم")
