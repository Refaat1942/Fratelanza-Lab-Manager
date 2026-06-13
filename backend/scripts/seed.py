"""Seed platform registry and demo laboratory (dedicated tenant DB when enabled)."""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.manager import get_database_manager, tenant_database_name
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
from app.models.billing import Invoice, InvoiceItem, InvoiceStatus
from app.models.inventory import InventoryBatch, InventoryCategory, InventoryItem
from app.models.orders import LabOrder, LabOrderItem, LabResult, OrderStatus, ResultStatus
from app.models.patients import Gender, Patient, PatientVisit, VisitStatus
from app.models.doctors import Doctor
from app.core.modules import ENTERPRISE_MODULES, PROFESSIONAL_MODULES, STARTER_MODULES
from app.services.tenant_feature_service import TenantFeatureService

settings = get_settings()
manager = get_database_manager()

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


async def seed_tenant_data(db, tenant: Tenant) -> None:
    perm_objects = []
    for code, module, action, desc, desc_ar in PERMISSIONS:
        p = Permission(code=code, module=module, action=action, description=desc, description_ar=desc_ar)
        db.add(p)
        perm_objects.append(p)
    await db.flush()

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
        is_system=True,
        default_branch_id=branch.id,
    )
    db.add(admin)
    await db.flush()
    db.add(UserRole(user_id=admin.id, role_id=admin_role.id))

    for sku, name, name_ar, cat, unit, cost in EGYPTIAN_INVENTORY:
        item = InventoryItem(
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
        db.add(item)
        await db.flush()
        db.add(
            InventoryBatch(
                tenant_id=tenant.id,
                item_id=item.id,
                branch_id=branch.id,
                batch_number=f"B-{sku}",
                quantity=50 if cat != InventoryCategory.REAGENT else 20,
                unit_cost=cost,
            )
        )

    demo_doctor = Doctor(
        tenant_id=tenant.id,
        code="DR-001",
        full_name="Dr. Ahmed Hassan",
        full_name_ar="د. أحمد حسن",
        specialty="Internal Medicine",
        phone="+201100000001",
        commission_rate=10,
    )
    db.add(demo_doctor)
    await db.flush()

    demo_patients = [
        ("P000001", "Mohamed Ali", "محمد علي", "+201200000001"),
        ("P000002", "Sara Ibrahim", "سارة إبراهيم", "+201200000002"),
        ("P000003", "Omar Farouk", "عمر فاروق", "+201200000003"),
    ]
    patient_objs = []
    for code, name, name_ar, phone in demo_patients:
        p = Patient(
            tenant_id=tenant.id,
            branch_id=branch.id,
            patient_code=code,
            full_name=name,
            full_name_ar=name_ar,
            phone=phone,
            gender=Gender.MALE,
        )
        db.add(p)
        await db.flush()
        patient_objs.append(p)

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

    await db.flush()
    glu_test = await db.execute(select(Test).where(Test.tenant_id == tenant.id, Test.code == "GLU"))
    glu = glu_test.scalar_one()
    cbc_test = await db.execute(select(Test).where(Test.tenant_id == tenant.id, Test.code == "CBC"))
    cbc = cbc_test.scalar_one()

    now = datetime.now(timezone.utc)
    visit = PatientVisit(
        tenant_id=tenant.id,
        patient_id=patient_objs[0].id,
        branch_id=branch.id,
        visit_number="V00001",
        visit_date=now,
        status=VisitStatus.IN_PROGRESS,
        referring_doctor_id=demo_doctor.id,
    )
    db.add(visit)
    await db.flush()

    order = LabOrder(
        tenant_id=tenant.id,
        visit_id=visit.id,
        patient_id=patient_objs[0].id,
        branch_id=branch.id,
        order_number="ORD-00001",
        status=OrderStatus.IN_LAB,
        ordered_at=now,
        referring_doctor_id=demo_doctor.id,
    )
    db.add(order)
    await db.flush()

    for test in [glu, cbc]:
        item = LabOrderItem(
            tenant_id=tenant.id,
            order_id=order.id,
            test_id=test.id,
            price=float(test.price),
        )
        db.add(item)
        await db.flush()
        db.add(
            LabResult(
                tenant_id=tenant.id,
                order_id=order.id,
                order_item_id=item.id,
                test_id=test.id,
                branch_id=branch.id,
                status=ResultStatus.PENDING,
            )
        )

    invoice = Invoice(
        tenant_id=tenant.id,
        branch_id=branch.id,
        patient_id=patient_objs[0].id,
        visit_id=visit.id,
        order_id=order.id,
        invoice_number="INV-00001",
        status=InvoiceStatus.ISSUED,
        subtotal=float(glu.price) + float(cbc.price),
        total=float(glu.price) + float(cbc.price),
        issued_at=now,
    )
    db.add(invoice)
    await db.flush()
    for test in [glu, cbc]:
        db.add(
            InvoiceItem(
                tenant_id=tenant.id,
                invoice_id=invoice.id,
                test_id=test.id,
                description=test.name,
                quantity=1,
                unit_price=float(test.price),
                total=float(test.price),
            )
        )


async def seed() -> None:
    async with async_session_factory() as platform_db:
        existing = await platform_db.execute(select(PlatformUser).limit(1))
        if existing.scalar_one_or_none():
            print("Database already seeded.")
            return

        platform_db.add(
            PlatformUser(
                username="superadmin",
                email=None,
                password_hash=get_password_hash("Admin@123"),
                full_name="Platform Administrator",
                is_superadmin=True,
            )
        )

        for name, name_ar, tier, cycle, price, branches, users in PLANS:
            if tier == PlanTier.STARTER:
                modules = STARTER_MODULES
            elif tier == PlanTier.PROFESSIONAL:
                modules = PROFESSIONAL_MODULES
            else:
                modules = ENTERPRISE_MODULES
            platform_db.add(
                SubscriptionPlan(
                    name=name,
                    name_ar=name_ar,
                    tier=tier,
                    billing_cycle=cycle,
                    price_egp=price,
                    max_branches=branches,
                    max_users=users,
                    features={"modules": [m for m in modules if m not in {"dashboard", "settings"}]},
                )
            )
        await platform_db.flush()

        plan_result = await platform_db.execute(
            select(SubscriptionPlan).where(
                SubscriptionPlan.tier == PlanTier.PROFESSIONAL,
                SubscriptionPlan.billing_cycle == BillingCycle.MONTHLY,
            )
        )
        plan = plan_result.scalar_one()

        tenant = Tenant(
            code="demo-lab",
            name="Demo Medical Laboratory",
            name_ar="مختبر العرض الطبي",
            email="demo@labmaster.eg",
            phone="+201000000000",
            status=TenantStatus.ACTIVE,
            database_name=tenant_database_name("demo-lab") if settings.TENANT_DATABASE_PER_CUSTOMER else None,
        )
        platform_db.add(tenant)
        await platform_db.flush()

        platform_db.add(
            TenantSubscription(
                tenant_id=tenant.id,
                plan_id=plan.id,
                status=SubscriptionStatus.ACTIVE,
                expires_at=datetime.now(timezone.utc) + timedelta(days=365),
                amount_paid=plan.price_egp,
            )
        )
        await platform_db.flush()

        await TenantFeatureService(platform_db).seed_from_plan(tenant.id, plan)

        if settings.TENANT_DATABASE_PER_CUSTOMER:
            db_name = await TenantProvisioningService(platform_db).provision_new_tenant(tenant)
            tenant_factory = await manager.get_tenant_session_factory(db_name)
        else:
            tenant_factory = async_session_factory

        async with tenant_factory() as tenant_db:
            await seed_tenant_data(tenant_db, tenant)
            await tenant_db.commit()

        await platform_db.commit()
        print("Seed completed successfully!")
        print("Platform admin username: superadmin")
        print("Demo lab admin username: labadmin (tenant code: demo-lab)")
        if settings.TENANT_DATABASE_PER_CUSTOMER:
            print(f"Demo laboratory database: {tenant.database_name}")


if __name__ == "__main__":
    asyncio.run(seed())
