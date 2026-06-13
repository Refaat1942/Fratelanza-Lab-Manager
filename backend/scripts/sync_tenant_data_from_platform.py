#!/usr/bin/env python3
"""Copy laboratory rows from platform DB into a tenant's dedicated DB (missing IDs only)."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.manager import get_database_manager
from app.db.session import async_session_factory
from app.models.platform import Tenant
from app.services.tenant_provisioning_service import TenantProvisioningService


async def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/sync_tenant_data_from_platform.py <tenant-code>")
        sys.exit(1)

    code = sys.argv[1].strip().lower()
    manager = get_database_manager()

    async with async_session_factory() as platform_db:
        tenant = (
            await platform_db.execute(select(Tenant).where(Tenant.code == code, Tenant.deleted_at.is_(None)))
        ).scalar_one_or_none()
        if not tenant:
            print(f"Tenant not found: {code}")
            sys.exit(1)

        db_name = manager.resolve_tenant_database(tenant.code, tenant.database_name)
        svc = TenantProvisioningService(platform_db)
        await svc.ensure_tenant_database(tenant)
        copied = await svc.sync_missing_data_from_platform(tenant, db_name)
        await platform_db.commit()
        print(f"Synced {copied} row(s) into {db_name} for tenant {code}")


if __name__ == "__main__":
    asyncio.run(main())
