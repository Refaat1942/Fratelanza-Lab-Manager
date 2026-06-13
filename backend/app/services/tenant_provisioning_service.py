"""Provision an isolated PostgreSQL database for each customer laboratory."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func

from app.core.config import get_settings
from app.db.base import Base
from app.db.manager import get_database_manager, tenant_database_name
import app.models  # noqa: F401 — register ORM tables on Base.metadata
from app.models.platform import Tenant

settings = get_settings()


class TenantProvisioningService:
    def __init__(self, platform_db: AsyncSession):
        self.platform_db = platform_db
        self.manager = get_database_manager()

    async def ensure_tenant_database(self, tenant: Tenant) -> str:
        """Create DB + migrations if needed; return database_name."""
        if not settings.TENANT_DATABASE_PER_CUSTOMER:
            return self.manager.platform_database_name

        db_name = tenant.database_name or tenant_database_name(tenant.code)
        if tenant.database_name != db_name:
            tenant.database_name = db_name
            await self.platform_db.flush()

        self.manager.create_database_if_not_exists(db_name)
        self.manager.run_migrations(db_name)
        await self._sync_tenant_registry_row(tenant)
        return db_name

    async def _sync_tenant_registry_row(self, tenant: Tenant) -> None:
        """Ensure tenant DB has a tenants row (FK target for users, branches, etc.)."""
        factory = await self.manager.get_tenant_session_factory(tenant.database_name)
        async with factory() as tenant_db:
            try:
                existing = await tenant_db.get(Tenant, tenant.id)
                if existing:
                    existing.code = tenant.code
                    existing.name = tenant.name
                    existing.name_ar = tenant.name_ar
                    existing.email = tenant.email
                    existing.phone = tenant.phone
                    existing.status = tenant.status
                    existing.database_name = tenant.database_name
                else:
                    tenant_db.add(
                        Tenant(
                            id=tenant.id,
                            code=tenant.code,
                            name=tenant.name,
                            name_ar=tenant.name_ar,
                            email=tenant.email,
                            phone=tenant.phone,
                            tax_number=tenant.tax_number,
                            status=tenant.status,
                            locale=tenant.locale,
                            timezone=tenant.timezone,
                            database_name=tenant.database_name,
                        )
                    )
                await tenant_db.commit()
            except Exception:
                await tenant_db.rollback()
                raise

    async def provision_new_tenant(self, tenant: Tenant) -> str:
        return await self.ensure_tenant_database(tenant)

    async def migrate_existing_tenant(self, tenant_id: UUID) -> str:
        tenant = await self.platform_db.get(Tenant, tenant_id)
        if not tenant:
            raise ValueError("Tenant not found")
        db_name = await self.ensure_tenant_database(tenant)
        await self._copy_tenant_data_from_platform(tenant, db_name)
        return db_name

    async def _copy_tenant_data_from_platform(self, tenant: Tenant, db_name: str) -> None:
        """Copy rows for one tenant from shared platform DB into dedicated tenant DB."""
        platform_name = self.manager.platform_database_name
        if db_name == platform_name:
            return

        tenant_factory = await self.manager.get_tenant_session_factory(db_name)
        skip_tables = {
            "platform_users",
            "subscription_plans",
            "tenant_subscriptions",
            "tenant_feature_flags",
            "platform_audit_logs",
            "alembic_version",
        }

        async with tenant_factory() as tenant_db:
            try:
                from app.models.patients import Patient

                existing_patients = await tenant_db.scalar(
                    select(func.count())
                    .select_from(Patient)
                    .where(Patient.tenant_id == tenant.id)
                )
                if existing_patients:
                    return

                tables_to_copy: list[tuple] = []
                for table in Base.metadata.sorted_tables:
                    if table.name in skip_tables or table.name == "tenants":
                        continue
                    if "tenant_id" not in table.c:
                        continue
                    rows = (
                        await self.platform_db.execute(
                            select(table).where(table.c.tenant_id == tenant.id)
                        )
                    ).mappings().all()
                    if rows:
                        tables_to_copy.append((table, rows))

                for table, _ in reversed(tables_to_copy):
                    await tenant_db.execute(delete(table).where(table.c.tenant_id == tenant.id))

                for table, rows in tables_to_copy:
                    for row in rows:
                        await tenant_db.execute(table.insert().values(**dict(row)))
                await tenant_db.commit()
            except Exception:
                await tenant_db.rollback()
                raise
