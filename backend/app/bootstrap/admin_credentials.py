import os
from secrets import token_urlsafe

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.models.platform import PlatformUser, Tenant
from app.models.tenant_config import Branch

settings = get_settings()

DEMO_TENANT_CODE = "demo-lab"
DEMO_USERNAME = "labadmin"
PLATFORM_USERNAME = "superadmin"


def _bootstrap_secret(env_name: str) -> str | None:
    value = os.getenv(env_name)
    if value:
        return value
    if settings.is_production:
        return None
    generated = token_urlsafe(18)
    print(f"{env_name} is not set; generated temporary development password: {generated}")
    return generated


def _require_strong_production_password(password: str, label: str) -> None:
    if settings.is_production and len(password) < 12:
        raise RuntimeError(f"{label} must be at least 12 characters in production")


async def ensure_platform_admin() -> None:
    username = os.getenv("PLATFORM_ADMIN_USERNAME", PLATFORM_USERNAME).strip().lower()
    password = _bootstrap_secret("PLATFORM_ADMIN_PASSWORD")
    if not password:
        print("Platform admin bootstrap skipped: PLATFORM_ADMIN_PASSWORD is not set.")
        return
    _require_strong_production_password(password, "PLATFORM_ADMIN_PASSWORD")

    async with async_session_factory() as db:
        result = await db.execute(
            select(PlatformUser).where(func.lower(PlatformUser.username) == username)
        )
        user = result.scalar_one_or_none()

        if not user:
            super_result = await db.execute(
                select(PlatformUser).where(PlatformUser.is_superadmin.is_(True)).limit(1)
            )
            user = super_result.scalar_one_or_none()

        if user:
            if not settings.is_production:
                user.username = username
                user.is_active = True
                user.is_superadmin = True
                await db.commit()
            print("Platform admin already exists; password unchanged.")
            return
        else:
            db.add(
                PlatformUser(
                    username=username,
                    password_hash=get_password_hash(password),
                    full_name="Platform Administrator",
                    is_superadmin=True,
                )
            )
            print(f"Created platform admin: {username}")

        await db.commit()


async def ensure_demo_admin() -> None:
    if settings.is_production:
        print("Demo admin bootstrap skipped in production.")
        return
    password = _bootstrap_secret("DEMO_ADMIN_PASSWORD")
    if not password:
        print("Demo admin bootstrap skipped: DEMO_ADMIN_PASSWORD is not set.")
        return

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

        if user:
            user.is_active = True
            user.is_tenant_admin = True
            if not user.default_branch_id:
                user.default_branch_id = branch.id
            print(f"Demo admin already exists; password unchanged for {DEMO_USERNAME} @ {DEMO_TENANT_CODE}")
        else:
            user = User(
                tenant_id=tenant.id,
                username=DEMO_USERNAME,
                password_hash=get_password_hash(password),
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
