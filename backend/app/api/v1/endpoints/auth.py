from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import CurrentUser, DbSession, PlatformDbSession
from app.bootstrap.admin_credentials import is_default_platform_password
from app.core.rate_limit import limiter
from app.core.security import verify_token
from app.models.platform import Tenant, TenantStatus
from app.schemas.common import MessageResponse
from app.schemas.auth import (
    ChangePasswordRequest,
    DemoLoginRequest,
    LoginRequest,
    PlatformLoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
)
from app.schemas.platform import PlatformAdminResponse
from app.api.deps import PlatformAdmin
from app.services.auth_service import AuthService
from app.services.tenant_access_service import TenantAccessService

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Brute-force protection for credential endpoints (per client IP).
LOGIN_RATE_LIMIT = "20/minute"


@router.post("/login", response_model=TokenResponse)
@limiter.limit(LOGIN_RATE_LIMIT)
async def login(request: Request, data: LoginRequest, platform_db: PlatformDbSession):
    try:
        return await AuthService.login_with_platform(platform_db, data)
    except ValueError as e:
        msg = str(e)
        if msg.startswith("Tenant account is"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)


@router.post("/platform/login", response_model=TokenResponse)
@limiter.limit(LOGIN_RATE_LIMIT)
async def platform_login(request: Request, data: PlatformLoginRequest, platform_db: PlatformDbSession):
    try:
        return await AuthService(platform_db=platform_db).platform_login(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest, platform_db: PlatformDbSession):
    try:
        return await AuthService.refresh_with_platform(platform_db, data.refresh_token)
    except ValueError as e:
        msg = str(e)
        if msg.startswith("Tenant account is"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)


@router.post("/demo-login", response_model=TokenResponse)
@limiter.limit("20/minute")
async def demo_login(request: Request, data: DemoLoginRequest, platform_db: PlatformDbSession):
    """Exchange a passwordless demo link for a session. Works only while the demo is valid."""
    payload = verify_token(data.token, token_type="demo_access")
    if not payload:
        raise HTTPException(status_code=401, detail="Demo link is invalid or has expired")
    tenant = await platform_db.get(Tenant, UUID(payload["sub"]))
    if not tenant or tenant.deleted_at is not None or tenant.status != TenantStatus.TRIAL:
        raise HTTPException(status_code=403, detail="This demo link is no longer active")
    try:
        await TenantAccessService(platform_db).assert_tenant_active(tenant.id)
        return await AuthService.demo_login(platform_db, tenant)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/platform/me", response_model=PlatformAdminResponse)
async def get_platform_me(admin: PlatformAdmin):
    response = PlatformAdminResponse.model_validate(admin)
    response.using_default_password = is_default_platform_password(admin)
    return response


@router.post("/platform/change-password", response_model=MessageResponse)
@limiter.limit(LOGIN_RATE_LIMIT)
async def platform_change_password(
    request: Request, data: ChangePasswordRequest, admin: PlatformAdmin, platform_db: PlatformDbSession
):
    try:
        await AuthService.change_password(platform_db, admin, data.current_password, data.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return MessageResponse(message="Password changed", message_ar="تم تغيير كلمة المرور")


@router.post("/change-password", response_model=MessageResponse)
@limiter.limit(LOGIN_RATE_LIMIT)
async def change_password(request: Request, data: ChangePasswordRequest, user: CurrentUser, db: DbSession):
    try:
        await AuthService.change_password(db, user, data.current_password, data.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return MessageResponse(message="Password changed", message_ar="تم تغيير كلمة المرور")


@router.get("/me", response_model=UserResponse)
async def get_me(user: CurrentUser, platform_db: PlatformDbSession):
    if user.tenant_id:
        try:
            await TenantAccessService(platform_db).assert_tenant_active(user.tenant_id)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    roles = [ur.role.name for ur in user.roles]
    permissions: list[str] = []
    if user.is_tenant_admin:
        permissions = ["*"]
    else:
        for ur in user.roles:
            for rp in ur.role.permissions:
                permissions.append(rp.permission.code)
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        full_name_ar=user.full_name_ar,
        phone=user.phone,
        is_active=user.is_active,
        is_tenant_admin=user.is_tenant_admin,
        tenant_id=user.tenant_id,
        default_branch_id=user.default_branch_id,
        locale=user.locale,
        last_login_at=user.last_login_at,
        roles=roles,
        permissions=permissions,
    )
