"""Tenant soft delete, restore, and permanent purge (platform registry + optional dedicated DB)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import create_engine

from app.core.config import get_settings
from app.models.platform import PlatformAuditLog, Tenant, TenantStatus
from app.services.tenant_access_service import TenantAccessService

settings = get_settings()


class TenantLifecycleService:
    def __init__(self, platform_db: AsyncSession):
        self.db = platform_db

    async def get_tenant(self, tenant_id: UUID, *, include_deleted: bool = False) -> Tenant | None:
        query = select(Tenant).where(Tenant.id == tenant_id)
        if not include_deleted:
            query = query.where(Tenant.deleted_at.is_(None))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_tenants(self, lifecycle: str | None = None) -> list[Tenant]:
        query = select(Tenant)
        if lifecycle == "deleted":
            query = query.where(Tenant.deleted_at.isnot(None))
        elif lifecycle == "suspended":
            query = query.where(Tenant.deleted_at.is_(None), Tenant.status == TenantStatus.SUSPENDED)
        else:
            # active (default) — non-deleted laboratories that are not suspended
            query = query.where(Tenant.deleted_at.is_(None), Tenant.status == TenantStatus.ACTIVE)
        result = await self.db.execute(query.order_by(Tenant.created_at.desc()))
        return list(result.scalars().all())

    async def code_available(self, code: str) -> bool:
        normalized = code.strip().lower()
        existing = await self.db.execute(
            select(Tenant.id).where(Tenant.code == normalized, Tenant.deleted_at.is_(None)).limit(1)
        )
        return existing.scalar_one_or_none() is None

    async def soft_delete(self, tenant_id: UUID, admin_id: UUID, log_action) -> bool:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return False
        from sqlalchemy import func

        tenant.deleted_at = func.now()
        tenant.status = TenantStatus.DELETED
        await TenantAccessService(self.db).revoke_tenant_sessions(tenant.id)
        await log_action(
            admin_id,
            "tenant_soft_deleted",
            "tenant",
            tenant.id,
            str(tenant.id),
            {"code": tenant.code, "name": tenant.name},
        )
        return True

    async def restore(self, tenant_id: UUID, admin_id: UUID, log_action) -> bool:
        tenant = await self.get_tenant(tenant_id, include_deleted=True)
        if not tenant or tenant.deleted_at is None:
            return False
        conflict = await self.db.execute(
            select(Tenant.id).where(
                Tenant.code == tenant.code,
                Tenant.deleted_at.is_(None),
                Tenant.id != tenant.id,
            )
        )
        if conflict.scalar_one_or_none():
            raise ValueError(
                f"Cannot restore: another active laboratory already uses code '{tenant.code}'"
            )
        tenant.deleted_at = None
        tenant.status = TenantStatus.ACTIVE
        await log_action(
            admin_id,
            "tenant_restored",
            "tenant",
            tenant.id,
            str(tenant.id),
            {"code": tenant.code, "name": tenant.name},
        )
        return True

    async def permanent_delete(
        self, tenant_id: UUID, admin_id: UUID, confirm_code: str, log_action
    ) -> bool:
        tenant = await self.get_tenant(tenant_id, include_deleted=True)
        if not tenant:
            return False
        if confirm_code.strip().lower() != tenant.code.strip().lower():
            raise ValueError("Confirmation code does not match laboratory code")

        code = tenant.code
        name = tenant.name
        database_name = getattr(tenant, "database_name", None)
        purged_id = str(tenant.id)

        await TenantAccessService(self.db).revoke_tenant_sessions(tenant.id)
        self._drop_tenant_database_if_exists(database_name)

        await self.db.execute(
            update(PlatformAuditLog)
            .where(PlatformAuditLog.tenant_id == tenant.id)
            .values(tenant_id=None)
        )
        await self.db.execute(delete(Tenant).where(Tenant.id == tenant.id))
        await self.db.flush()

        await log_action(
            admin_id,
            "tenant_permanently_deleted",
            "tenant",
            None,
            purged_id,
            {
                "code": code,
                "name": name,
                "database_name": database_name,
                "purged_tenant_id": purged_id,
            },
        )
        return True

    @staticmethod
    def _drop_tenant_database_if_exists(database_name: str | None) -> None:
        if not database_name:
            return
        platform_db = settings.DATABASE_URL_SYNC.rsplit("/", 1)[-1]
        if database_name == platform_db:
            return
        engine = create_engine(settings.DATABASE_URL_SYNC, isolation_level="AUTOCOMMIT")
        with engine.connect() as conn:
            conn.execute(
                text(
                    """
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = :dbname AND pid <> pg_backend_pid()
                    """
                ),
                {"dbname": database_name},
            )
            conn.execute(text(f'DROP DATABASE IF EXISTS "{database_name}"'))
