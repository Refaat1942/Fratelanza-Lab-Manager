from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.users import (
    PermissionResponse,
    RoleResponse,
    TenantUserCreate,
    TenantUserResponse,
    TenantUserUpdate,
)
from app.services.user_service import UserService
from app.utils.date_filter import parse_date_param

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/roles")
async def list_roles(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("users.manage"),
):
    roles = await UserService(db).list_roles(tenant.id)
    return [RoleResponse.model_validate(r) for r in roles]


@router.get("/permissions")
async def list_permissions(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("users.manage"),
):
    perms = await UserService(db).list_permissions()
    return [PermissionResponse.model_validate(p) for p in perms]


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
        payload = await UserService(db)._user_payload_with_roles(tenant.id, new_user.id)
        return TenantUserResponse.model_validate(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{user_id}", response_model=TenantUserResponse)
async def update_user(
    user_id: UUID,
    data: TenantUserUpdate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("users.manage"),
):
    updated = await UserService(db).update_user(tenant.id, user_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    payload = await UserService(db)._user_payload_with_roles(tenant.id, updated.id)
    return TenantUserResponse.model_validate(payload)


@router.delete("/{user_id}", response_model=MessageResponse)
async def deactivate_user(
    user_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("users.manage"),
):
    if str(user.id) == str(user_id):
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    try:
        ok = await UserService(db).deactivate_user(tenant.id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return MessageResponse(message="User deactivated", message_ar="تم تعطيل المستخدم")
