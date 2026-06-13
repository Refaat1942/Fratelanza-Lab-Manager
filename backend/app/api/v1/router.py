from fastapi import APIRouter

from app.api.deps import require_any_module, require_module
from app.api.v1.endpoints import (
    assistant, auth, billing, branches, crm, dashboard, doctors, expenses, export, inventory, patients,
    platform, public, purchasing, referrals, reports, results, settings, suppliers, tests, users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(platform.router)
api_router.include_router(public.router)
api_router.include_router(settings.router)
api_router.include_router(dashboard.router, dependencies=[require_module("dashboard")])
api_router.include_router(assistant.router)
api_router.include_router(patients.router, dependencies=[require_module("patients")])
api_router.include_router(doctors.router, dependencies=[require_module("doctors")])
api_router.include_router(tests.router, dependencies=[require_module("tests")])
api_router.include_router(results.router, dependencies=[require_module("results")])
api_router.include_router(billing.router, dependencies=[require_module("billing")])
api_router.include_router(inventory.router, dependencies=[require_module("inventory")])
api_router.include_router(suppliers.router, dependencies=[require_module("suppliers")])
api_router.include_router(branches.router, dependencies=[require_module("branches")])
api_router.include_router(users.router, dependencies=[require_module("users")])
api_router.include_router(expenses.router, dependencies=[require_module("expenses")])
api_router.include_router(referrals.router, dependencies=[require_module("referrals")])
api_router.include_router(crm.router, dependencies=[require_any_module("crm", "marketing")])
api_router.include_router(purchasing.router, dependencies=[require_module("purchasing")])
api_router.include_router(export.router, dependencies=[require_module("reports")])
api_router.include_router(reports.router, dependencies=[require_module("reports")])
