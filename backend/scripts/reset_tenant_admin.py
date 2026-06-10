"""Reset a tenant admin password by lab code and username.

Usage:
  python scripts/reset_tenant_admin.py --tenant-code demo-lab --username labadmin --password 'Demo@123'
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.manager import get_database_manager
from app.db.session import async_session_factory
from app.models.auth import User
from app.models.platform import Tenant

settings = get_settings()
manager = get_database_manager()


async def reset_password(tenant_code: str, username: str, password: str) -> None:
    tenant_code = tenant_code.strip().lower()
    username = username.strip().lower()

    async with async_session_factory() as platform_db:
        tenant_result = await platform_db.execute(
            select(Tenant).where(Tenant.code == tenant_code, Tenant.deleted_at.is_(None))
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            print(f"Tenant not found: {tenant_code}")
            sys.exit(1)

        db_name = manager.resolve_tenant_database(tenant.code, tenant.database_name)
        factory = await manager.get_tenant_session_factory(db_name)
        async with factory() as tenant_db:
            user_result = await tenant_db.execute(
                select(User).where(
                    User.tenant_id == tenant.id,
                    User.username == username,
                    User.deleted_at.is_(None),
                )
            )
            user = user_result.scalar_one_or_none()
            if not user:
                print(f"User not found: {username} (tenant {tenant_code})")
                sys.exit(1)

            user.password_hash = get_password_hash(password)
            await tenant_db.commit()
            print(f"Password updated for {username} @ {tenant_code} (database: {db_name})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset tenant admin password")
    parser.add_argument("--tenant-code", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()
    asyncio.run(reset_password(args.tenant_code, args.username, args.password))


if __name__ == "__main__":
    main()
