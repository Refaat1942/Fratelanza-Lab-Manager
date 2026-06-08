from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.models.platform import PlatformUser, Tenant
from app.models.tenant_config import Branch

DEMO_TENANT_CODE = "demo-lab"
DEVELOPMENT_DEMO_PASSWORD = "Demo@123"
DEVELOPMENT_PLATFORM_PASSWORD = "Admin@123"


def _bootstrap_enabled() -> bool:
    settings = get_settings()
    return settings.BOOTSTRAP_ADMINS or not settings.is_production


def _bootstrap_password(configured_password: str | None, development_password: str) -> str | None:
    settings = get_settings()
    if configured_password:
        return configured_password
    return development_password if not settings.is_production else None


async def ensure_platform_admin() -> None:
    settings = get_settings()
    if not _bootstrap_enabled():
        print("Platform admin bootstrap disabled.")
        return

    password = _bootstrap_password(settings.PLATFORM_ADMIN_PASSWORD, DEVELOPMENT_PLATFORM_PASSWORD)
    if not password:
        print("Platform admin bootstrap skipped: PLATFORM_ADMIN_PASSWORD is required.")
        return

    username = settings.PLATFORM_ADMIN_USERNAME.strip().lower()
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
            user.username = username
            if settings.RESET_BOOTSTRAP_PASSWORDS:
                user.password_hash = get_password_hash(password)
            user.is_active = True
            user.is_superadmin = True
            print(f"Ensured platform admin exists: {username}")
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
    settings = get_settings()
    if not _bootstrap_enabled():
        print("Demo admin bootstrap disabled.")
        return

    password = _bootstrap_password(settings.DEMO_ADMIN_PASSWORD, DEVELOPMENT_DEMO_PASSWORD)
    if not password:
        print("Demo admin bootstrap skipped: DEMO_ADMIN_PASSWORD is required.")
        return

    username = settings.DEMO_ADMIN_USERNAME.strip().lower()
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
                User.username == username,
                User.deleted_at.is_(None),
            )
        )
        user = user_result.scalar_one_or_none()

        if user:
            if settings.RESET_BOOTSTRAP_PASSWORDS:
                user.password_hash = get_password_hash(password)
            user.is_active = True
            user.is_tenant_admin = True
            if not user.default_branch_id:
                user.default_branch_id = branch.id
            print(f"Ensured demo admin exists: {username} @ {DEMO_TENANT_CODE}")
        else:
            user = User(
                tenant_id=tenant.id,
                username=username,
                password_hash=get_password_hash(password),
                full_name="Lab Administrator",
                full_name_ar="مدير المختبر",
                is_tenant_admin=True,
                default_branch_id=branch.id,
            )
            db.add(user)
            await db.flush()
            db.add(UserRole(user_id=user.id, role_id=admin_role.id))
            print(f"Created {username} @ {DEMO_TENANT_CODE}")

        await db.commit()
