import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    verify_token,
)
from app.models.auth import RefreshToken, Role, RolePermission, User, UserRole
from app.models.platform import PlatformUser, Tenant
from app.schemas.auth import LoginRequest, PlatformLoginRequest, TokenResponse, UserCreate

settings = get_settings()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def login(self, data: LoginRequest) -> TokenResponse:
        username = data.username.strip().lower()
        query = select(User).options(
            selectinload(User.roles)
            .selectinload(UserRole.role)
            .selectinload(Role.permissions)
            .selectinload(RolePermission.permission)
        ).where(User.username == username, User.deleted_at.is_(None))

        if data.tenant_code:
            tenant_result = await self.db.execute(
                select(Tenant).where(Tenant.code == data.tenant_code, Tenant.deleted_at.is_(None))
            )
            tenant = tenant_result.scalar_one_or_none()
            if not tenant:
                raise ValueError("Invalid tenant code")
            query = query.where(User.tenant_id == tenant.id)

        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        if not user or not verify_password(data.password, user.password_hash):
            raise ValueError("Invalid credentials")
        if not user.is_active:
            raise ValueError("Account is inactive")

        permissions = self._extract_permissions(user)
        access_token = create_access_token(
            str(user.id),
            tenant_id=user.tenant_id,
            permissions=list(permissions),
        )
        refresh_token = create_refresh_token(str(user.id))
        await self._store_refresh_token(user.id, refresh_token)

        user.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def platform_login(self, data: PlatformLoginRequest) -> TokenResponse:
        username = data.username.strip().lower()
        result = await self.db.execute(
            select(PlatformUser).where(PlatformUser.username == username, PlatformUser.is_active.is_(True))
        )
        user = result.scalar_one_or_none()
        if not user or not verify_password(data.password, user.password_hash):
            raise ValueError("Invalid credentials")
        access_token = create_access_token(str(user.id), role="platform_admin")
        refresh_token = create_refresh_token(str(user.id))
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def refresh(self, refresh_token: str) -> TokenResponse:
        payload = verify_token(refresh_token, token_type="refresh")
        if not payload:
            raise ValueError("Invalid refresh token")
        token_hash = _hash_token(refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
            )
        )
        stored = result.scalar_one_or_none()
        if not stored or stored.expires_at < datetime.now(timezone.utc):
            raise ValueError("Refresh token expired or revoked")

        user_result = await self.db.execute(select(User).where(User.id == stored.user_id))
        user = user_result.scalar_one_or_none()
        if not user or not user.is_active:
            raise ValueError("User not found")

        permissions = await self._get_permissions(user.id)
        access_token = create_access_token(
            str(user.id),
            tenant_id=user.tenant_id,
            permissions=list(permissions),
        )
        new_refresh = create_refresh_token(str(user.id))
        stored.revoked_at = datetime.now(timezone.utc)
        await self._store_refresh_token(user.id, new_refresh)

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def create_user(self, tenant_id: UUID, data: UserCreate) -> User:
        username = data.username.strip().lower()
        user = User(
            tenant_id=tenant_id,
            username=username,
            email=data.email,
            password_hash=get_password_hash(data.password),
            full_name=data.full_name,
            full_name_ar=data.full_name_ar,
            phone=data.phone,
            is_tenant_admin=data.is_tenant_admin,
            default_branch_id=data.default_branch_id,
            locale=data.locale,
        )
        self.db.add(user)
        await self.db.flush()
        for role_id in data.role_ids:
            self.db.add(UserRole(user_id=user.id, role_id=role_id))
        await self.db.flush()
        return user

    async def _store_refresh_token(self, user_id: UUID, token: str) -> None:
        expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        self.db.add(
            RefreshToken(
                user_id=user_id,
                token_hash=_hash_token(token),
                expires_at=expires,
            )
        )

    def _extract_permissions(self, user: User) -> set[str]:
        if user.is_tenant_admin:
            return {"*"}
        perms: set[str] = set()
        for ur in user.roles:
            for rp in ur.role.permissions:
                perms.add(rp.permission.code)
        return perms

    async def _get_permissions(self, user_id: UUID) -> set[str]:
        result = await self.db.execute(
            select(User)
            .options(
                selectinload(User.roles)
                .selectinload(UserRole.role)
                .selectinload(Role.permissions)
                .selectinload(RolePermission.permission)
            )
            .where(User.id == user_id)
        )
        user = result.scalar_one()
        return self._extract_permissions(user)
