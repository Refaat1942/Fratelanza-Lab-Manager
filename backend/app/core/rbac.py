"""Permission catalogue and default roles, ensured in every laboratory database."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import Permission, Role, RolePermission

PERMISSIONS = [
    ("patients.read", "patients", "read", "View patients", "عرض المرضى"),
    ("patients.create", "patients", "create", "Create patients", "إضافة مرضى"),
    ("patients.update", "patients", "update", "Update patients", "تعديل المرضى"),
    ("patients.delete", "patients", "delete", "Delete patients", "حذف المرضى"),
    ("doctors.read", "doctors", "read", "View doctors", "عرض الأطباء"),
    ("doctors.create", "doctors", "create", "Create doctors", "إضافة أطباء"),
    ("doctors.update", "doctors", "update", "Update doctors", "تعديل الأطباء"),
    ("doctors.delete", "doctors", "delete", "Delete doctors", "حذف الأطباء"),
    ("tests.read", "tests", "read", "View tests", "عرض التحاليل"),
    ("tests.create", "tests", "create", "Create tests", "إضافة تحاليل"),
    ("tests.update", "tests", "update", "Update tests", "تعديل التحاليل"),
    ("tests.delete", "tests", "delete", "Delete tests", "حذف التحاليل"),
    ("results.read", "results", "read", "View results", "عرض النتائج"),
    ("results.create", "results", "create", "Enter results", "إدخال النتائج"),
    ("results.verify", "results", "verify", "Verify results", "اعتماد النتائج"),
    ("billing.read", "billing", "read", "View billing", "عرض الفواتير"),
    ("billing.create", "billing", "create", "Create invoices", "إنشاء فواتير"),
    ("inventory.read", "inventory", "read", "View inventory", "عرض المخزون"),
    ("inventory.manage", "inventory", "manage", "Manage inventory", "إدارة المخزون"),
    ("reports.read", "reports", "read", "View reports", "عرض التقارير"),
    ("settings.manage", "settings", "manage", "Manage settings", "إدارة الإعدادات"),
    ("users.manage", "users", "manage", "Manage users", "إدارة المستخدمين"),
]

ALL_CODES = {p[0] for p in PERMISSIONS}

# name, Arabic name, permission codes
DEFAULT_ROLES = [
    ("Administrator", "مدير النظام", ALL_CODES),
    (
        "Receptionist",
        "الاستقبال",
        {
            "patients.read", "patients.create", "patients.update",
            "doctors.read", "tests.read", "results.read",
            "billing.read", "billing.create",
        },
    ),
    (
        "Lab Technician",
        "فني المختبر",
        {
            "results.read", "results.create", "results.verify",
            "tests.read", "tests.update",
            "inventory.read", "inventory.manage",
            "patients.read",
        },
    ),
]


async def ensure_rbac(db: AsyncSession, tenant_id: UUID) -> None:
    """Add missing permissions and default roles. Roles that already exist are left as the lab set them."""
    existing = {p.code: p for p in (await db.execute(select(Permission))).scalars().all()}
    for code, module, action, desc, desc_ar in PERMISSIONS:
        if code not in existing:
            perm = Permission(code=code, module=module, action=action, description=desc, description_ar=desc_ar)
            db.add(perm)
            existing[code] = perm
    await db.flush()

    role_names = {
        r.name
        for r in (
            await db.execute(select(Role).where(Role.tenant_id == tenant_id, Role.deleted_at.is_(None)))
        ).scalars().all()
    }
    for name, name_ar, codes in DEFAULT_ROLES:
        if name in role_names:
            continue
        role = Role(tenant_id=tenant_id, name=name, name_ar=name_ar, is_system=True)
        db.add(role)
        await db.flush()
        for code in codes:
            db.add(RolePermission(role_id=role.id, permission_id=existing[code].id))
    await db.flush()
