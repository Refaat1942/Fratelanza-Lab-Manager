"""Create or reset the admin user for a laboratory (fixes labs that cannot log in).

Usage:
  python scripts/ensure_tenant_admin.py --tenant-code my-lab --username admin --password 'SecurePass123'
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
from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.models.platform import Tenant
from app.models.tenant_config import Branch
from app.services.tenant_provisioning_service import TenantProvisioningService

settings = get_settings()
manager = get_database_manager()


async def ensure_admin(tenant_code: str, username: str, password: str, full_name: str) -> None:
    tenant_code = tenant_code.strip().lower()
    username = username.strip().lower()

    async with async_session_factory() as platform_db:
        tenant = (
            await platform_db.execute(
                select(Tenant).where(Tenant.code == tenant_code, Tenant.deleted_at.is_(None))
            )
        ).scalar_one_or_none()
        if not tenant:
            print(f"Tenant not found: {tenant_code}")
            sys.exit(1)

        if settings.TENANT_DATABASE_PER_CUSTOMER:
            db_name = await TenantProvisioningService(platform_db).ensure_tenant_database(tenant)
            await platform_db.commit()
            tenant_factory = await manager.get_tenant_session_factory(db_name)
        else:
            tenant_factory = async_session_factory

        async with tenant_factory() as tenant_db:
            branch = (
                await tenant_db.execute(
                    select(Branch).where(Branch.tenant_id == tenant.id, Branch.deleted_at.is_(None)).limit(1)
                )
            ).scalar_one_or_none()
            if not branch:
                branch = Branch(
                    tenant_id=tenant.id,
                    code="HQ",
                    name="Headquarters",
                    name_ar="الفرع الرئيسي",
                    is_headquarters=True,
                )
                tenant_db.add(branch)
                await tenant_db.flush()

            admin_role = (
                await tenant_db.execute(
                    select(Role).where(
                        Role.tenant_id == tenant.id,
                        Role.name == "Administrator",
                        Role.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if not admin_role:
                admin_role = Role(
                    tenant_id=tenant.id,
                    name="Administrator",
                    name_ar="مدير النظام",
                    is_system=True,
                )
                tenant_db.add(admin_role)
                await tenant_db.flush()
                for perm in (await tenant_db.execute(select(Permission))).scalars():
                    tenant_db.add(RolePermission(role_id=admin_role.id, permission_id=perm.id))

            user = (
                await tenant_db.execute(
                    select(User).where(
                        User.tenant_id == tenant.id,
                        User.username == username,
                        User.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            password_hash = get_password_hash(password)

            if user:
                user.password_hash = password_hash
                user.is_active = True
                user.is_tenant_admin = True
                user.is_system = True
                if not user.default_branch_id:
                    user.default_branch_id = branch.id
                print(f"Reset admin: {username} @ {tenant_code}")
            else:
                user = User(
                    tenant_id=tenant.id,
                    username=username,
                    password_hash=password_hash,
                    full_name=full_name,
                    is_tenant_admin=True,
                    is_system=True,
                    default_branch_id=branch.id,
                )
                tenant_db.add(user)
                await tenant_db.flush()
                tenant_db.add(UserRole(user_id=user.id, role_id=admin_role.id))
                print(f"Created admin: {username} @ {tenant_code}")

            await tenant_db.commit()
            print(f"Database: {manager.resolve_tenant_database(tenant.code, tenant.database_name)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ensure laboratory admin account exists")
    parser.add_argument("--tenant-code", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--full-name", default="Lab Administrator")
    args = parser.parse_args()
    asyncio.run(ensure_admin(args.tenant_code, args.username, args.password, args.full_name))


if __name__ == "__main__":
    main()
