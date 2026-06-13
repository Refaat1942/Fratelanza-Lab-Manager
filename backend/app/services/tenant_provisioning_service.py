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

    async def _registry_id_conflict(self, tenant: Tenant) -> bool:
        factory = await self.manager.get_tenant_session_factory(tenant.database_name)
        async with factory() as tenant_db:
            if await tenant_db.get(Tenant, tenant.id):
                return False
            by_code = (
                await tenant_db.execute(select(Tenant).where(Tenant.code == tenant.code))
            ).scalar_one_or_none()
            return bool(by_code and by_code.id != tenant.id)

    async def _rebuild_tenant_database(self, tenant: Tenant) -> None:
        """Safe repair: dedicated DB only. All laboratory data is re-copied from platform DB."""
        db_name = tenant.database_name
        if not db_name:
            raise ValueError("Tenant has no database_name")
        print(
            f"  repair: resetting {db_name} (partial setup removed; "
            f"data will be copied from platform DB '{self.manager.platform_database_name}')"
        )
        await self.manager.dispose_tenant_engine(db_name)
        self.manager.rebuild_tenant_database(db_name)

    async def _sync_tenant_registry_row(self, tenant: Tenant) -> None:
        """Ensure tenant DB has a tenants row (FK target for users, branches, etc.)."""
        if await self._registry_id_conflict(tenant):
            await self._rebuild_tenant_database(tenant)

        factory = await self.manager.get_tenant_session_factory(tenant.database_name)
        async with factory() as tenant_db:
            try:
                existing = await tenant_db.get(Tenant, tenant.id)
                if not existing:
                    by_code = (
                        await tenant_db.execute(select(Tenant).where(Tenant.code == tenant.code))
                    ).scalar_one_or_none()
                    if by_code:
                        if by_code.id == tenant.id:
                            existing = by_code
                        else:
                            await tenant_db.delete(by_code)
                            await tenant_db.flush()

                if existing:
                    self._apply_tenant_registry_fields(existing, tenant)
                    existing.deleted_at = None
                else:
                    tenant_db.add(self._tenant_registry_row(tenant))
                await tenant_db.commit()
            except Exception:
                await tenant_db.rollback()
                raise

    @staticmethod
    def _apply_tenant_registry_fields(row: Tenant, tenant: Tenant) -> None:
        row.code = tenant.code
        row.name = tenant.name
        row.name_ar = tenant.name_ar
        row.email = tenant.email
        row.phone = tenant.phone
        row.tax_number = tenant.tax_number
        row.status = tenant.status
        row.locale = tenant.locale
        row.timezone = tenant.timezone
        row.database_name = tenant.database_name

    @staticmethod
    def _tenant_registry_row(tenant: Tenant) -> Tenant:
        return Tenant(
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

    async def provision_new_tenant(self, tenant: Tenant) -> str:
        return await self.ensure_tenant_database(tenant)

    async def migrate_existing_tenant(self, tenant_id: UUID) -> str:
        tenant = await self.platform_db.get(Tenant, tenant_id)
        if not tenant:
            raise ValueError("Tenant not found")
        db_name = await self.ensure_tenant_database(tenant)
        await self._copy_tenant_data_from_platform(tenant, db_name)
        return db_name

    async def sync_missing_data_from_platform(self, tenant: Tenant, db_name: str) -> int:
        """Copy rows that exist in platform DB but are missing from the dedicated tenant DB."""
        platform_name = self.manager.platform_database_name
        if db_name == platform_name:
            return 0

        skip_tables = {
            "platform_users",
            "subscription_plans",
            "tenant_subscriptions",
            "tenant_feature_flags",
            "platform_audit_logs",
            "alembic_version",
            "refresh_tokens",
        }
        copied = 0
        tenant_factory = await self.manager.get_tenant_session_factory(db_name)
        async with tenant_factory() as tenant_db:
            try:
                for table in Base.metadata.sorted_tables:
                    if table.name in skip_tables or "tenant_id" not in table.c:
                        continue
                    pk_cols = list(table.primary_key.columns)
                    if len(pk_cols) != 1:
                        continue
                    pk_col = pk_cols[0]

                    platform_rows = (
                        await self.platform_db.execute(
                            select(table).where(table.c.tenant_id == tenant.id)
                        )
                    ).mappings().all()
                    if not platform_rows:
                        continue

                    existing_ids = {
                        row[0]
                        for row in (
                            await tenant_db.execute(
                                select(pk_col).where(table.c.tenant_id == tenant.id)
                            )
                        ).all()
                    }

                    for row in platform_rows:
                        row_dict = dict(row)
                        if row_dict[pk_col.name] in existing_ids:
                            continue
                        await tenant_db.execute(table.insert().values(**row_dict))
                        copied += 1
                if copied:
                    await tenant_db.commit()
            except Exception:
                await tenant_db.rollback()
                raise
        return copied

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
                    print(f"  skip copy: {existing_patients} patient(s) already in tenant DB")
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
