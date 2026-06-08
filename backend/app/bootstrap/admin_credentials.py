from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.models.platform import PlatformUser, Tenant
from app.models.tenant_config import Branch

settings = get_settings()


def _normalize_username(username: str) -> str:
    return username.strip().lower()


async def ensure_platform_admin() -> None:
    if not settings.BOOTSTRAP_ADMIN_ACCOUNTS:
        print("Platform admin bootstrap disabled.")
        return
    if not settings.PLATFORM_ADMIN_PASSWORD:
        raise ValueError("PLATFORM_ADMIN_PASSWORD must be set when BOOTSTRAP_ADMIN_ACCOUNTS=true")

    platform_username = _normalize_username(settings.PLATFORM_ADMIN_USERNAME)
    async with async_session_factory() as db:
        result = await db.execute(
            select(PlatformUser).where(func.lower(PlatformUser.username) == platform_username)
        )
        user = result.scalar_one_or_none()

        if not user:
            super_result = await db.execute(
                select(PlatformUser).where(PlatformUser.is_superadmin.is_(True)).limit(1)
            )
            user = super_result.scalar_one_or_none()

        if user:
            user.username = platform_username
            user.is_active = True
            user.is_superadmin = True
            print(f"Verified platform admin: {platform_username}")
        else:
            db.add(
                PlatformUser(
                    username=platform_username,
                    password_hash=get_password_hash(settings.PLATFORM_ADMIN_PASSWORD),
                    full_name="Platform Administrator",
                    is_superadmin=True,
                )
            )
            print(f"Created platform admin: {platform_username}")

        await db.commit()


async def ensure_demo_admin() -> None:
    if not settings.BOOTSTRAP_ADMIN_ACCOUNTS:
        print("Demo admin bootstrap disabled.")
        return
    if not settings.DEMO_ADMIN_PASSWORD:
        raise ValueError("DEMO_ADMIN_PASSWORD must be set when BOOTSTRAP_ADMIN_ACCOUNTS=true")

    demo_tenant_code = settings.DEMO_TENANT_CODE.strip().lower()
    demo_username = _normalize_username(settings.DEMO_ADMIN_USERNAME)
    async with async_session_factory() as db:
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.code == demo_tenant_code, Tenant.deleted_at.is_(None))
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            print(f"Demo tenant '{demo_tenant_code}' not found — skipping demo admin setup.")
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
                User.username == demo_username,
                User.deleted_at.is_(None),
            )
        )
        user = user_result.scalar_one_or_none()

        if user:
            user.is_active = True
            user.is_tenant_admin = True
            if not user.default_branch_id:
                user.default_branch_id = branch.id
            print(f"Verified {demo_username} @ {demo_tenant_code}")
        else:
            user = User(
                tenant_id=tenant.id,
                username=demo_username,
                password_hash=get_password_hash(settings.DEMO_ADMIN_PASSWORD),
                full_name="Lab Administrator",
                full_name_ar="مدير المختبر",
                is_tenant_admin=True,
                default_branch_id=branch.id,
            )
            db.add(user)
            await db.flush()
            db.add(UserRole(user_id=user.id, role_id=admin_role.id))
            print(f"Created {demo_username} @ {demo_tenant_code}")

        await db.commit()
