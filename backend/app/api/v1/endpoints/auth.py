from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import CurrentUser, DbSession, PlatformAdmin
from app.core.config import get_settings
from app.core.limiter import limiter
from app.schemas.auth import (
    LoginRequest,
    PlatformLoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
)
from app.schemas.platform import PlatformAdminResponse
from app.services.auth_service import AuthService
from app.services.tenant_access_service import TenantAccessService

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def login(request: Request, data: LoginRequest, db: DbSession):
    try:
        return await AuthService(db).login(data)
    except ValueError as e:
        msg = str(e)
        if msg.startswith("Tenant account is"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)


@router.post("/platform/login", response_model=TokenResponse)
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def platform_login(request: Request, data: PlatformLoginRequest, db: DbSession):
    try:
        return await AuthService(db).platform_login(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def refresh_token(request: Request, data: RefreshTokenRequest, db: DbSession):
    try:
        return await AuthService(db).refresh(data.refresh_token)
    except ValueError as e:
        msg = str(e)
        if msg.startswith("Tenant account is"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)


@router.get("/platform/me", response_model=PlatformAdminResponse)
async def get_platform_me(admin: PlatformAdmin):
    return PlatformAdminResponse.model_validate(admin)


@router.get("/me", response_model=UserResponse)
async def get_me(user: CurrentUser, db: DbSession):
    if user.tenant_id:
        try:
            await TenantAccessService(db).assert_tenant_active(user.tenant_id)
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
