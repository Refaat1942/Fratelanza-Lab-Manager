import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
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
from app.db.manager import get_database_manager
from app.models.auth import RefreshToken, Role, RolePermission, User, UserRole
from app.models.platform import PlatformUser, Tenant
from app.services.tenant_access_service import TenantAccessService
from app.services.tenant_provisioning_service import TenantProvisioningService
from app.schemas.auth import LoginRequest, PlatformLoginRequest, TokenResponse, UserCreate

settings = get_settings()
manager = get_database_manager()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AuthService:
    def __init__(
        self,
        platform_db: AsyncSession | None = None,
        tenant_db: AsyncSession | None = None,
    ):
        if platform_db is None and tenant_db is None:
            raise ValueError("At least one database session is required")
        self.platform_db = platform_db
        self.tenant_db = tenant_db or platform_db

    @classmethod
    async def login_with_platform(cls, platform_db: AsyncSession, data: LoginRequest) -> TokenResponse:
        username = data.username.strip().lower()
        tenant_code = data.tenant_code.strip().lower() if data.tenant_code else None
        if not tenant_code:
            raise ValueError("Tenant code is required")

        tenant_result = await platform_db.execute(
            select(Tenant).where(Tenant.code == tenant_code, Tenant.deleted_at.is_(None))
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            raise ValueError("Invalid tenant code")

        await TenantAccessService(platform_db).assert_tenant_active(tenant.id)
        database_name = await TenantProvisioningService(platform_db).ensure_tenant_database(tenant)

        factory = await manager.get_tenant_session_factory(database_name)
        async with factory() as tenant_db:
            service = cls(platform_db, tenant_db)
            try:
                return await service._authenticate_lab_user(username, data.password, tenant, database_name)
            except ValueError as exc:
                if str(exc) != "Invalid credentials":
                    raise

        # User may still exist in the shared platform DB from an older create path — copy then retry once.
        if settings.TENANT_DATABASE_PER_CUSTOMER and database_name != manager.platform_database_name:
            await TenantProvisioningService(platform_db).migrate_existing_tenant(tenant.id)
            await platform_db.commit()
            async with factory() as tenant_db:
                service = cls(platform_db, tenant_db)
                return await service._authenticate_lab_user(username, data.password, tenant, database_name)
        raise ValueError("Invalid credentials")

    async def _find_lab_user(self, username: str, tenant_id: UUID) -> User | None:
        result = await self.tenant_db.execute(
            select(User)
            .options(
                selectinload(User.roles)
                .selectinload(UserRole.role)
                .selectinload(Role.permissions)
                .selectinload(RolePermission.permission)
            )
            .where(
                User.username == username,
                User.tenant_id == tenant_id,
                User.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def _sync_lab_user_from_platform(
        self, tenant: Tenant, username: str, password: str
    ) -> User | None:
        """Copy lab user from platform registry DB into tenant DB when credentials match there."""
        if self.platform_db is None:
            return None
        legacy_result = await self.platform_db.execute(
            select(User).where(
                User.tenant_id == tenant.id,
                User.username == username,
                User.deleted_at.is_(None),
            )
        )
        legacy = legacy_result.scalar_one_or_none()
        if not legacy or not verify_password(password, legacy.password_hash):
            return None

        existing = await self.tenant_db.execute(
            select(User).where(User.id == legacy.id, User.tenant_id == tenant.id)
        )
        user = existing.scalar_one_or_none()
        if user:
            user.password_hash = legacy.password_hash
            user.is_active = legacy.is_active
            user.is_tenant_admin = legacy.is_tenant_admin
            await self.tenant_db.flush()
        else:
            self.tenant_db.add(
                User(
                    id=legacy.id,
                    tenant_id=legacy.tenant_id,
                    username=legacy.username,
                    email=legacy.email,
                    password_hash=legacy.password_hash,
                    full_name=legacy.full_name,
                    full_name_ar=legacy.full_name_ar,
                    phone=legacy.phone,
                    is_active=legacy.is_active,
                    is_tenant_admin=legacy.is_tenant_admin,
                    is_system=legacy.is_system,
                    default_branch_id=legacy.default_branch_id,
                    locale=legacy.locale,
                )
            )
            await self.tenant_db.flush()
            user = await self._find_lab_user(username, tenant.id)
        return user

    async def _authenticate_lab_user(
        self,
        username: str,
        password: str,
        tenant: Tenant,
        database_name: str,
    ) -> TokenResponse:
        user = await self._find_lab_user(username, tenant.id)
        if user and not verify_password(password, user.password_hash):
            user = None
        if not user:
            user = await self._sync_lab_user_from_platform(tenant, username, password)
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Invalid credentials")
        if not user.is_active:
            raise ValueError("Account is inactive")

        permissions = self._extract_permissions(user)
        access_token = create_access_token(
            str(user.id),
            tenant_id=user.tenant_id,
            database_name=database_name,
            permissions=list(permissions),
        )
        refresh_token = create_refresh_token(
            str(user.id),
            tenant_id=user.tenant_id,
            database_name=database_name,
        )
        await self._store_refresh_token(user.id, refresh_token)

        user.last_login_at = datetime.now(timezone.utc)
        await self.tenant_db.flush()
        await self.tenant_db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def platform_login(self, data: PlatformLoginRequest) -> TokenResponse:
        if self.platform_db is None:
            raise ValueError("Platform database session required")
        username = data.username.strip().lower()
        result = await self.platform_db.execute(
            select(PlatformUser).where(
                func.lower(PlatformUser.username) == username,
                PlatformUser.is_active.is_(True),
            )
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

    @classmethod
    async def refresh_with_platform(cls, platform_db: AsyncSession, refresh_token: str) -> TokenResponse:
        payload = verify_token(refresh_token, token_type="refresh")
        if not payload:
            raise ValueError("Invalid refresh token")

        database_name = payload.get("database_name") or manager.platform_database_name
        factory = await manager.get_tenant_session_factory(database_name)
        async with factory() as tenant_db:
            service = cls(platform_db, tenant_db)
            return await service._refresh(refresh_token, payload, database_name)

    async def _refresh(
        self, refresh_token: str, payload: dict, database_name: str
    ) -> TokenResponse:
        token_hash = _hash_token(refresh_token)
        result = await self.tenant_db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
            )
        )
        stored = result.scalar_one_or_none()
        if not stored or stored.expires_at < datetime.now(timezone.utc):
            raise ValueError("Refresh token expired or revoked")

        user_result = await self.tenant_db.execute(select(User).where(User.id == stored.user_id))
        user = user_result.scalar_one_or_none()
        if not user or not user.is_active:
            raise ValueError("User not found")
        if user.tenant_id:
            await TenantAccessService(self.platform_db).assert_tenant_active(user.tenant_id)

        permissions = await self._get_permissions(user.id)
        access_token = create_access_token(
            str(user.id),
            tenant_id=user.tenant_id,
            database_name=database_name,
            permissions=list(permissions),
        )
        new_refresh = create_refresh_token(
            str(user.id),
            tenant_id=user.tenant_id,
            database_name=database_name,
        )
        stored.revoked_at = datetime.now(timezone.utc)
        await self._store_refresh_token(user.id, new_refresh)
        await self.tenant_db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def create_user(self, tenant_id: UUID, data: UserCreate) -> User:
        from app.schemas.auth import RESERVED_USERNAMES
        from app.services.tenant_limits_service import TenantLimitsService

        if not data.is_system:
            await TenantLimitsService(self.tenant_db, self.platform_db).assert_can_add_user(tenant_id)
        username = data.username.strip().lower()
        if username in RESERVED_USERNAMES and not data.is_system:
            raise ValueError(f"Username '{username}' is reserved and cannot be used")
        user = User(
            tenant_id=tenant_id,
            username=username,
            email=data.email,
            password_hash=get_password_hash(data.password),
            full_name=data.full_name,
            full_name_ar=data.full_name_ar,
            phone=data.phone,
            is_tenant_admin=data.is_tenant_admin,
            is_system=data.is_system,
            default_branch_id=data.default_branch_id,
            locale=data.locale,
        )
        self.tenant_db.add(user)
        await self.tenant_db.flush()
        for role_id in data.role_ids:
            self.tenant_db.add(UserRole(user_id=user.id, role_id=role_id))
        await self.tenant_db.flush()
        return user

    async def _store_refresh_token(self, user_id: UUID, token: str) -> None:
        expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        self.tenant_db.add(
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
        result = await self.tenant_db.execute(
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
