"""Lab module registry — keys align with frontend sidebar `labModules[].key`."""

from typing import Final

# Modules that cannot be disabled for a laboratory.
ALWAYS_ENABLED_MODULES: Final[frozenset[str]] = frozenset({"dashboard", "settings"})

ALL_LAB_MODULES: Final[list[str]] = [
    "dashboard",
    "patients",
    "doctors",
    "referrals",
    "tests",
    "results",
    "billing",
    "expenses",
    "inventory",
    "purchasing",
    "suppliers",
    "crm",
    "marketing",
    "accounting",
    "reports",
    "users",
    "branches",
    "settings",
]

MODULE_LABELS: Final[dict[str, tuple[str, str]]] = {
    "dashboard": ("Dashboard", "لوحة التحكم"),
    "patients": ("Patients", "المرضى"),
    "doctors": ("Doctors", "الأطباء"),
    "referrals": ("Referrals", "الإحالات"),
    "tests": ("Tests", "التحاليل"),
    "results": ("Results", "النتائج"),
    "billing": ("Billing", "الفواتير"),
    "expenses": ("Expenses", "المصروفات"),
    "inventory": ("Inventory", "المخزون"),
    "purchasing": ("Purchasing", "المشتريات"),
    "suppliers": ("Suppliers", "الموردون"),
    "crm": ("CRM", "إدارة العملاء"),
    "marketing": ("Marketing", "التسويق"),
    "accounting": ("Accounting", "المحاسبة"),
    "reports": ("Reports", "التقارير"),
    "users": ("Users", "المستخدمون"),
    "branches": ("Branches", "الفروع"),
    "settings": ("Settings", "الإعدادات"),
}

# Default modules for new Starter-tier laboratories.
STARTER_MODULES: Final[list[str]] = [
    "dashboard",
    "patients",
    "tests",
    "results",
    "billing",
    "settings",
]

PROFESSIONAL_MODULES: Final[list[str]] = [
    *STARTER_MODULES,
    "doctors",
    "inventory",
    "expenses",
    "reports",
    "users",
    "branches",
]

ENTERPRISE_MODULES: Final[list[str]] = list(ALL_LAB_MODULES)
