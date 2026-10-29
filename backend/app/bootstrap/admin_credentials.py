import secrets

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.security import get_password_hash, verify_password
from app.db.manager import get_database_manager
from app.db.session import async_session_factory
from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.models.platform import PlatformUser, Tenant
from app.models.tenant_config import Branch
from app.services.tenant_provisioning_service import TenantProvisioningService

settings = get_settings()
manager = get_database_manager()

DEMO_TENANT_CODE = "demo-lab"
DEMO_USERNAME = "labadmin"
DEMO_PASSWORD = "Demo@123"
PLATFORM_USERNAME = "superadmin"
PLATFORM_PASSWORD = "Admin@123"


def _initial_password(configured: str | None, default: str, label: str) -> str:
    """Password for a newly created bootstrap account."""
    if configured:
        return configured
    if not settings.is_production:
        return default
    generated = secrets.token_urlsafe(12)
    print("=" * 64)
    print(f"Created {label} with a generated password: {generated}")
    print("Log in and change it, or set the password in .env.production.")
    print("=" * 64)
    return generated


def is_default_platform_password(user: PlatformUser) -> bool:
    return verify_password(PLATFORM_PASSWORD, user.password_hash)


async def ensure_platform_admin(reset_password: str | None = None) -> None:
    """Create the platform superadmin if missing (with PLATFORM_ADMIN_PASSWORD when set).
    An existing password is only changed when reset_password is passed explicitly."""
    async with async_session_factory() as db:
        result = await db.execute(
            select(PlatformUser).where(func.lower(PlatformUser.username) == PLATFORM_USERNAME)
        )
        user = result.scalar_one_or_none()

        if not user:
            super_result = await db.execute(
                select(PlatformUser).where(PlatformUser.is_superadmin.is_(True)).limit(1)
            )
            user = super_result.scalar_one_or_none()

        configured = settings.PLATFORM_ADMIN_PASSWORD
        if user:
            if reset_password:
                user.password_hash = get_password_hash(reset_password)
                user.is_active = True
                user.is_superadmin = True
                print(f"Reset password for platform admin: {user.username}")
            elif settings.is_production and is_default_platform_password(user):
                print(
                    f"WARNING: platform admin '{user.username}' still uses the public default password. "
                    "Change it from the platform panel or set PLATFORM_ADMIN_PASSWORD."
                )
        else:
            password = _initial_password(configured, PLATFORM_PASSWORD, f"platform admin '{PLATFORM_USERNAME}'")
            db.add(
                PlatformUser(
                    username=PLATFORM_USERNAME,
                    password_hash=get_password_hash(password),
                    full_name="Platform Administrator",
                    is_superadmin=True,
                )
            )
            print(f"Created platform admin: {PLATFORM_USERNAME}")

        await db.commit()


async def ensure_demo_admin(reset_password: str | None = None) -> None:
    async with async_session_factory() as platform_db:
        tenant_result = await platform_db.execute(
            select(Tenant).where(Tenant.code == DEMO_TENANT_CODE, Tenant.deleted_at.is_(None))
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            print(f"Demo tenant '{DEMO_TENANT_CODE}' not found — skipping demo admin setup.")
            return

        if settings.TENANT_DATABASE_PER_CUSTOMER:
            db_name = await TenantProvisioningService(platform_db).ensure_tenant_database(tenant)
            await platform_db.commit()
            tenant_factory = await manager.get_tenant_session_factory(db_name)
        else:
            tenant_factory = async_session_factory

        async with tenant_factory() as tenant_db:
            branch_result = await tenant_db.execute(
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
                tenant_db.add(branch)
                await tenant_db.flush()

            role_result = await tenant_db.execute(
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
                tenant_db.add(admin_role)
                await tenant_db.flush()
                perm_result = await tenant_db.execute(select(Permission))
                for perm in perm_result.scalars():
                    tenant_db.add(RolePermission(role_id=admin_role.id, permission_id=perm.id))

            user_result = await tenant_db.execute(
                select(User).where(
                    User.tenant_id == tenant.id,
                    User.username == DEMO_USERNAME,
                    User.deleted_at.is_(None),
                )
            )
            user = user_result.scalar_one_or_none()
            configured = settings.DEMO_ADMIN_PASSWORD

            if user:
                if reset_password:
                    user.password_hash = get_password_hash(reset_password)
                    user.is_active = True
                    user.is_tenant_admin = True
                    print(f"Reset password for {DEMO_USERNAME} @ {DEMO_TENANT_CODE}")
                if not user.default_branch_id:
                    user.default_branch_id = branch.id
            else:
                user = User(
                    tenant_id=tenant.id,
                    username=DEMO_USERNAME,
                    password_hash=get_password_hash(configured or DEMO_PASSWORD),
                    full_name="Lab Administrator",
                    full_name_ar="مدير المختبر",
                    is_tenant_admin=True,
                    is_system=True,
                    default_branch_id=branch.id,
                )
                tenant_db.add(user)
                await tenant_db.flush()
                tenant_db.add(UserRole(user_id=user.id, role_id=admin_role.id))
                print(f"Created {DEMO_USERNAME} @ {DEMO_TENANT_CODE}")

            await tenant_db.commit()
