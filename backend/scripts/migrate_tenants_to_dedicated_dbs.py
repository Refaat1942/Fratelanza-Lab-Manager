"""Move existing laboratories from the shared platform DB into dedicated PostgreSQL databases.

Usage:
  cd backend && python scripts/migrate_tenants_to_dedicated_dbs.py
  python scripts/migrate_tenants_to_dedicated_dbs.py --tenant-code demo-lab
  python scripts/migrate_tenants_to_dedicated_dbs.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.config import get_settings
from app.db.manager import get_database_manager
from app.db.session import async_session_factory
from app.models.platform import Tenant
from app.services.tenant_provisioning_service import TenantProvisioningService

settings = get_settings()


async def migrate(tenant_code: str | None, dry_run: bool) -> None:
    if not settings.TENANT_DATABASE_PER_CUSTOMER:
        print("TENANT_DATABASE_PER_CUSTOMER is disabled — nothing to do.")
        return

    manager = get_database_manager()
    async with async_session_factory() as platform_db:
        query = select(Tenant).where(Tenant.deleted_at.is_(None)).order_by(Tenant.code)
        if tenant_code:
            query = query.where(Tenant.code == tenant_code.strip().lower())
        tenants = list((await platform_db.execute(query)).scalars().all())

        if not tenants:
            print("No tenants matched.")
            return

        for tenant in tenants:
            target_db = tenant.database_name or f"{settings.TENANT_DATABASE_PREFIX}{tenant.code.replace('-', '_')}"
            print(f"- {tenant.code}: -> {target_db}")
            if dry_run:
                continue
            db_name = await TenantProvisioningService(platform_db).migrate_existing_tenant(tenant.id)
            print(f"  migrated to {db_name}")

        if not dry_run:
            await platform_db.commit()
            print("Done. Users must log in again to receive tokens with the new database_name.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Provision dedicated DBs for existing tenants")
    parser.add_argument("--tenant-code", help="Migrate a single laboratory by code")
    parser.add_argument("--dry-run", action="store_true", help="List actions without changing data")
    args = parser.parse_args()
    asyncio.run(migrate(args.tenant_code, args.dry_run))


if __name__ == "__main__":
    main()
