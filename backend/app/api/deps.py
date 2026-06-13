from collections.abc import AsyncGenerator
from typing import Annotated, Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.security import verify_token
from app.db.manager import get_database_manager
from app.db.session import get_platform_db, get_tenant_db
from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.models.platform import PlatformUser, Tenant
from app.services.tenant_access_service import TenantAccessService

settings = get_settings()
security = HTTPBearer(auto_error=False)
manager = get_database_manager()


async def _resolve_database_name(
    credentials: Optional[HTTPAuthorizationCredentials],
    platform_db: AsyncSession,
) -> str:
    if credentials:
        payload = verify_token(credentials.credentials)
        if payload and payload.get("database_name"):
            return payload["database_name"]
        if payload and payload.get("tenant_id"):
            tenant = await platform_db.get(Tenant, UUID(payload["tenant_id"]))
            if tenant:
                return manager.resolve_tenant_database(tenant.code, tenant.database_name)
    return manager.platform_database_name


async def get_tenant_db_from_token(
    platform_db: Annotated[AsyncSession, Depends(get_platform_db)],
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
) -> AsyncGenerator[AsyncSession, None]:
    database_name = await _resolve_database_name(credentials, platform_db)
    session = await manager.tenant_session(database_name)
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_platform_admin(
    db: Annotated[AsyncSession, Depends(get_platform_db)],
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
) -> PlatformUser:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    if not payload or payload.get("role") != "platform_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform admin access required")
    admin_id = payload.get("sub")
    result = await db.execute(
        select(PlatformUser).where(PlatformUser.id == admin_id, PlatformUser.is_active.is_(True))
    )
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Platform admin not found")
    return admin


PlatformAdmin = Annotated[PlatformUser, Depends(get_platform_admin)]


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_tenant_db_from_token)],
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id = payload.get("sub")
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.roles).selectinload(UserRole.role).selectinload(Role.permissions).selectinload(RolePermission.permission)
        )
        .where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


async def get_current_tenant(
    platform_db: Annotated[AsyncSession, Depends(get_platform_db)],
    user: Annotated[User, Depends(get_current_user)],
    x_tenant_id: Annotated[Optional[str], Header()] = None,
) -> Tenant:
    tenant_id = (str(user.tenant_id) if user.tenant_id else None) or x_tenant_id
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant context required")
    if user.tenant_id and str(user.tenant_id) != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant context mismatch")
    try:
        tenant = await TenantAccessService(platform_db).assert_tenant_active(UUID(tenant_id))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return tenant


def get_user_permissions(user: User) -> set[str]:
    permissions: set[str] = set()
    if user.is_tenant_admin:
        return {"*"}
    for user_role in user.roles:
        for role_perm in user_role.role.permissions:
            permissions.add(role_perm.permission.code)
    return permissions


def require_permission(permission_code: str):
    async def _checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        perms = get_user_permissions(user)
        if "*" not in perms and permission_code not in perms:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return _checker


def require_module(module_key: str):
    async def _checker(
        tenant: Annotated[Tenant, Depends(get_current_tenant)],
        platform_db: Annotated[AsyncSession, Depends(get_platform_db)],
    ) -> None:
        from app.services.tenant_feature_service import TenantFeatureService

        if not await TenantFeatureService(platform_db).is_module_enabled(tenant.id, module_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This feature is not enabled for your laboratory",
            )

    return Depends(_checker)


def require_any_module(*module_keys: str):
    async def _checker(
        tenant: Annotated[Tenant, Depends(get_current_tenant)],
        platform_db: Annotated[AsyncSession, Depends(get_platform_db)],
    ) -> None:
        from app.services.tenant_feature_service import TenantFeatureService

        svc = TenantFeatureService(platform_db)
        if not await svc.is_any_module_enabled(tenant.id, list(module_keys)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This feature is not enabled for your laboratory",
            )

    return Depends(_checker)


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentTenant = Annotated[Tenant, Depends(get_current_tenant)]
PlatformDbSession = Annotated[AsyncSession, Depends(get_platform_db)]
DbSession = Annotated[AsyncSession, Depends(get_tenant_db_from_token)]
