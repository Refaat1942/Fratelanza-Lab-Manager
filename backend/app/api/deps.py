from typing import Annotated, Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import verify_token
from app.db.session import get_db
from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.models.platform import PlatformUser, Tenant
from app.services.tenant_access_service import BLOCKED_STATUSES, TenantAccessService

security = HTTPBearer(auto_error=False)


async def get_platform_admin(
    db: Annotated[AsyncSession, Depends(get_db)],
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
    db: Annotated[AsyncSession, Depends(get_db)],
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
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    x_tenant_id: Annotated[Optional[str], Header()] = None,
) -> Tenant:
    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated user is not bound to a tenant",
        )
    tenant_id = str(user.tenant_id)
    if x_tenant_id and x_tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant header does not match authenticated user",
        )
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id, Tenant.deleted_at.is_(None)))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    if tenant.status in BLOCKED_STATUSES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Tenant account is {tenant.status.value}")
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


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentTenant = Annotated[Tenant, Depends(get_current_tenant)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
