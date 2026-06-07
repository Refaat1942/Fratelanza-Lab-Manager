"""Ensure demo-lab / labadmin exists with known credentials (runs on every deploy)."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.models.platform import Tenant
from app.models.tenant_config import Branch

DEMO_TENANT_CODE = "demo-lab"
DEMO_USERNAME = "labadmin"
DEMO_PASSWORD = "Demo@123"


async def ensure_demo_admin() -> None:
    async with async_session_factory() as db:
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.code == DEMO_TENANT_CODE, Tenant.deleted_at.is_(None))
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            print(f"Demo tenant '{DEMO_TENANT_CODE}' not found — skipping demo admin setup.")
            return

        branch_result = await db.execute(
            select(Branch).where(Branch.tenant_id == tenant.id, Branch.deleted_at.is_(None)).limit(1)
        )
        branch = branch_result.scalar_one_or_none()
        if not branch:
            branch = Branch(
                tenant_id=tenant.id,
                code="HQ",
                name="Headquarters",
                name_ar="الفرع الرئيسي",
                is_headquarters=True,
            )
            db.add(branch)
            await db.flush()

        role_result = await db.execute(
            select(Role).where(
                Role.tenant_id == tenant.id,
                Role.name == "Administrator",
                Role.deleted_at.is_(None),
            )
        )
        admin_role = role_result.scalar_one_or_none()
        if not admin_role:
            admin_role = Role(
                tenant_id=tenant.id,
                name="Administrator",
                name_ar="مدير النظام",
                is_system=True,
            )
            db.add(admin_role)
            await db.flush()
            perm_result = await db.execute(select(Permission))
            for perm in perm_result.scalars():
                db.add(RolePermission(role_id=admin_role.id, permission_id=perm.id))

        user_result = await db.execute(
            select(User).where(
                User.tenant_id == tenant.id,
                User.username == DEMO_USERNAME,
                User.deleted_at.is_(None),
            )
        )
        user = user_result.scalar_one_or_none()
        password_hash = get_password_hash(DEMO_PASSWORD)

        if user:
            user.password_hash = password_hash
            user.is_active = True
            user.is_tenant_admin = True
            if not user.default_branch_id:
                user.default_branch_id = branch.id
            print(f"Reset password for {DEMO_USERNAME} @ {DEMO_TENANT_CODE}")
        else:
            user = User(
                tenant_id=tenant.id,
                username=DEMO_USERNAME,
                password_hash=password_hash,
                full_name="Lab Administrator",
                full_name_ar="مدير المختبر",
                is_tenant_admin=True,
                default_branch_id=branch.id,
            )
            db.add(user)
            await db.flush()
            db.add(UserRole(user_id=user.id, role_id=admin_role.id))
            print(f"Created {DEMO_USERNAME} @ {DEMO_TENANT_CODE}")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(ensure_demo_admin())
