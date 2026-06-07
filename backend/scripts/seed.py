"""Seed database with initial platform data, permissions, plans, and demo tenant."""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.models.platform import (
    BillingCycle,
    PlanTier,
    PlatformUser,
    SubscriptionPlan,
    SubscriptionStatus,
    Tenant,
    TenantStatus,
    TenantSubscription,
)
from app.models.tenant_config import Branch, TenantBranding
from app.models.tests import Test, TestCategory
from app.models.inventory import InventoryCategory, InventoryItem

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

PLANS = [
    ("Starter Monthly", "الباقة الأساسية شهري", PlanTier.STARTER, BillingCycle.MONTHLY, 999, 1, 5),
    ("Starter Yearly", "الباقة الأساسية سنوي", PlanTier.STARTER, BillingCycle.YEARLY, 9990, 1, 5),
    ("Professional Monthly", "الباقة الاحترافية شهري", PlanTier.PROFESSIONAL, BillingCycle.MONTHLY, 2499, 3, 15),
    ("Professional Yearly", "الباقة الاحترافية سنوي", PlanTier.PROFESSIONAL, BillingCycle.YEARLY, 24990, 3, 15),
    ("Enterprise Monthly", "باقة المؤسسات شهري", PlanTier.ENTERPRISE, BillingCycle.MONTHLY, 4999, 10, 50),
    ("Enterprise Yearly", "باقة المؤسسات سنوي", PlanTier.ENTERPRISE, BillingCycle.YEARLY, 49990, 10, 50),
]

EGYPTIAN_INVENTORY = [
    ("GLV-001", "Nitrile Gloves (Box 100)", "قفازات نيتrile (علبة 100)", InventoryCategory.GLOVE, "box", 150),
    ("TUB-EDTA", "EDTA Purple Top Tube", "أنبوب EDTA بنفسجي", InventoryCategory.TUBE, "piece", 3.5),
    ("TUB-SST", "SST Gold Top Tube", "أنبوب SST ذهبي", InventoryCategory.TUBE, "piece", 4),
    ("SYR-5ML", "5ml Syringe", "حقنة 5 مل", InventoryCategory.SYRINGE, "piece", 2),
    ("RCT-CBC", "CBC Reagent Kit", "كيت CBC", InventoryCategory.KIT, "kit", 450),
    ("RCT-GLU", "Glucose Reagent", "كاشف الجلوكوز", InventoryCategory.REAGENT, "bottle", 280),
    ("RCT-HBA1C", "HbA1c Reagent", "كاشف السكر التراكمي", InventoryCategory.REAGENT, "bottle", 520),
    ("RCT-LIP", "Lipid Profile Reagent", "كاشف الدهون", InventoryCategory.REAGENT, "bottle", 380),
    ("CTL-LOW", "Low Control Serum", "كنترول منخفض", InventoryCategory.CONTROL, "vial", 120),
    ("CTL-HIGH", "High Control Serum", "كنترول مرتفع", InventoryCategory.CONTROL, "vial", 120),
    ("CAL-GLU", "Glucose Calibrator", "معايرة الجلوكوز", InventoryCategory.CALIBRATOR, "vial", 95),
]

EGYPTIAN_TESTS = [
    ("HEM", "Hematology", "أمراض الدم", [
        ("CBC", "Complete Blood Count", "صورة دم كاملة", 120, 35),
        ("ESR", "ESR", "سرعة الترسيب", 50, 15),
    ]),
    ("BIO", "Biochemistry", "الكيمياء الحيوية", [
        ("GLU", "Fasting Glucose", "سكر صائم", 60, 18),
        ("HBA1C", "HbA1c", "السكر التراكمي", 180, 55),
        ("LIP", "Lipid Profile", "الدهون الثلاثية", 200, 60),
        ("CRE", "Creatinine", "الكرياتينين", 70, 20),
        ("ALT", "ALT (SGPT)", "إنزيمات الكبد ALT", 65, 18),
    ]),
    ("IMM", "Immunology", "المناعة", [
        ("TSH", "TSH", "هرمون الغدة الدرقية", 150, 45),
        ("HCG", "Beta HCG", "هرمون الحمل", 120, 35),
    ]),
    ("MIC", "Microbiology", "الأحياء الدقيقة", [
        ("URC", "Urine Culture", "مزرعة بول", 180, 55),
        ("STW", "Stool Analysis", "تحليل براز", 80, 25),
    ]),
]


async def seed() -> None:
    async with async_session_factory() as db:
        existing = await db.execute(select(PlatformUser).limit(1))
        if existing.scalar_one_or_none():
            print("Database already seeded.")
            return

        db.add(
            PlatformUser(
                username="superadmin",
                email=None,
                password_hash=get_password_hash("Admin@123"),
                full_name="Platform Administrator",
                is_superadmin=True,
            )
        )

        perm_objects = []
        for code, module, action, desc, desc_ar in PERMISSIONS:
            p = Permission(code=code, module=module, action=action, description=desc, description_ar=desc_ar)
            db.add(p)
            perm_objects.append(p)
        await db.flush()

        for name, name_ar, tier, cycle, price, branches, users in PLANS:
            db.add(
                SubscriptionPlan(
                    name=name,
                    name_ar=name_ar,
                    tier=tier,
                    billing_cycle=cycle,
                    price_egp=price,
                    max_branches=branches,
                    max_users=users,
                    features={"modules": ["patients", "tests", "billing", "inventory", "reports"]},
                )
            )
        await db.flush()

        plan_result = await db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.tier == PlanTier.PROFESSIONAL, SubscriptionPlan.billing_cycle == BillingCycle.MONTHLY)
        )
        plan = plan_result.scalar_one()

        tenant = Tenant(
            code="demo-lab",
            name="Demo Medical Laboratory",
            name_ar="مختبر العرض الطبي",
            email="demo@labmaster.eg",
            phone="+201000000000",
            status=TenantStatus.ACTIVE,
        )
        db.add(tenant)
        await db.flush()

        db.add(
            TenantSubscription(
                tenant_id=tenant.id,
                plan_id=plan.id,
                status=SubscriptionStatus.ACTIVE,
                expires_at=datetime.now(timezone.utc) + timedelta(days=365),
                amount_paid=plan.price_egp,
            )
        )
        branch = Branch(
            tenant_id=tenant.id,
            code="HQ",
            name="Main Branch - Cairo",
            name_ar="الفرع الرئيسي - القاهرة",
            city="Cairo",
            governorate="Cairo",
            is_headquarters=True,
        )
        db.add(branch)
        db.add(
            TenantBranding(
                tenant_id=tenant.id,
                company_name="Demo Medical Laboratory",
                company_name_ar="مختبر العرض الطبي",
                primary_color="#1e3a5f",
            )
        )
        await db.flush()

        admin_role = Role(tenant_id=tenant.id, name="Administrator", name_ar="مدير النظام", is_system=True)
        reception_role = Role(tenant_id=tenant.id, name="Receptionist", name_ar="الاستقبال", is_system=True)
        lab_role = Role(tenant_id=tenant.id, name="Lab Technician", name_ar="فني المختبر", is_system=True)
        db.add_all([admin_role, reception_role, lab_role])
        await db.flush()

        for p in perm_objects:
            db.add(RolePermission(role_id=admin_role.id, permission_id=p.id))

        admin = User(
            tenant_id=tenant.id,
            username="labadmin",
            email=None,
            password_hash=get_password_hash("Demo@123"),
            full_name="Lab Administrator",
            full_name_ar="مدير المختبر",
            is_tenant_admin=True,
            default_branch_id=branch.id,
        )
        db.add(admin)
        await db.flush()
        db.add(UserRole(user_id=admin.id, role_id=admin_role.id))

        for sku, name, name_ar, cat, unit, cost in EGYPTIAN_INVENTORY:
            db.add(
                InventoryItem(
                    tenant_id=tenant.id,
                    branch_id=branch.id,
                    sku=sku,
                    name=name,
                    name_ar=name_ar,
                    category=cat,
                    unit=unit,
                    unit_cost=cost,
                    reorder_level=10,
                )
            )

        for cat_code, cat_name, cat_name_ar, tests in EGYPTIAN_TESTS:
            category = TestCategory(
                tenant_id=tenant.id,
                code=cat_code,
                name=cat_name,
                name_ar=cat_name_ar,
            )
            db.add(category)
            await db.flush()
            for code, name, name_ar, price, cost in tests:
                db.add(
                    Test(
                        tenant_id=tenant.id,
                        category_id=category.id,
                        code=code,
                        name=name,
                        name_ar=name_ar,
                        price=price,
                        cost=cost,
                    )
                )

        await db.commit()
        print("Seed completed successfully!")
        print("Platform admin username: superadmin")
        print("Demo lab admin username: labadmin (tenant code: demo-lab)")


if __name__ == "__main__":
    asyncio.run(seed())
