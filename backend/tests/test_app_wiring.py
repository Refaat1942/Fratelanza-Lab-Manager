"""Smoke tests: module registry, API wiring, frontend parity."""

from app.api.v1.router import api_router
from app.core.modules import ALL_LAB_MODULES, ALWAYS_ENABLED_MODULES, ENTERPRISE_MODULES
from app.main import app
from app.services.reports_service import REPORT_TYPES
from app.services.tenant_feature_service import TenantFeatureService

# Keys used in frontend/src/components/layout/app-sidebar.tsx labModules[].key
FRONTEND_LAB_MODULE_KEYS = [
    "dashboard",
    "patients",
    "doctors",
    "tests",
    "results",
    "billing",
    "expenses",
    "inventory",
    "accounting",
    "reports",
    "users",
    "branches",
    "settings",
]

FRONTEND_REPORT_TYPES = {
    "daily",
    "monthly",
    "profitability",
    "inventory",
    "patients",
    "branches",
    "labs_done",
}


def test_lab_modules_match_frontend_sidebar():
    assert set(ALL_LAB_MODULES) == set(FRONTEND_LAB_MODULE_KEYS)
    assert list(ALL_LAB_MODULES) == FRONTEND_LAB_MODULE_KEYS


def test_enterprise_modules_is_full_catalog():
    assert set(ENTERPRISE_MODULES) == set(ALL_LAB_MODULES)


def test_always_enabled_modules_in_catalog():
    for key in ALWAYS_ENABLED_MODULES:
        assert key in ALL_LAB_MODULES


def test_report_types_match_frontend():
    assert REPORT_TYPES == FRONTEND_REPORT_TYPES


def test_tenant_feature_catalog_covers_all_modules():
    catalog_keys = {item["key"] for item in TenantFeatureService.catalog()}
    assert catalog_keys == set(ALL_LAB_MODULES)


def test_critical_api_routes_registered():
    paths = set()
    for route in app.routes:
        p = getattr(route, "path", "")
        if p:
            paths.add(p)
    joined = " ".join(paths)
    for fragment in (
        "/health",
        "/api/v1/auth/login",
        "/api/v1/patients",
        "/api/v1/doctors",
        "/api/v1/doctors/commissions/summary",
        "/api/v1/tests",
        "/api/v1/tests/import/template",
        "/api/v1/results",
        "/api/v1/billing/invoices",
        "/api/v1/settings/branding",
        "/api/v1/reports/{report_type}/excel",
        "/api/v1/export/{module}/excel",
    ):
        assert fragment in joined, f"Missing route fragment: {fragment}"


def test_api_router_has_routes():
    assert len(api_router.routes) >= 15
