from fastapi import APIRouter

from app.api.v1.endpoints import auth, branches, dashboard, doctors, inventory, patients, platform, tests

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(platform.router)
api_router.include_router(dashboard.router)
api_router.include_router(patients.router)
api_router.include_router(doctors.router)
api_router.include_router(tests.router)
api_router.include_router(inventory.router)
api_router.include_router(branches.router)
