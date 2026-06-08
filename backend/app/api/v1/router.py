from fastapi import APIRouter

from app.api.v1.endpoints import (
    assistant, auth, billing, branches, crm, dashboard, doctors, expenses, export, inventory, patients,
    platform, public, purchasing, referrals, reports, results, settings, suppliers, tests, users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(platform.router)
api_router.include_router(public.router)
api_router.include_router(settings.router)
api_router.include_router(dashboard.router)
api_router.include_router(assistant.router)
api_router.include_router(patients.router)
api_router.include_router(doctors.router)
api_router.include_router(tests.router)
api_router.include_router(results.router)
api_router.include_router(billing.router)
api_router.include_router(inventory.router)
api_router.include_router(suppliers.router)
api_router.include_router(branches.router)
api_router.include_router(users.router)
api_router.include_router(expenses.router)
api_router.include_router(referrals.router)
api_router.include_router(crm.router)
api_router.include_router(purchasing.router)
api_router.include_router(export.router)
api_router.include_router(reports.router)
