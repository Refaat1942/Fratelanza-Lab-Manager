from fastapi import APIRouter

from pathlib import Path

from fastapi.staticfiles import StaticFiles

from app.api.v1.endpoints import auth, branches, dashboard, doctors, inventory, patients, platform, public, settings, tests

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(platform.router)
api_router.include_router(public.router)
api_router.include_router(settings.router)
api_router.include_router(dashboard.router)
api_router.include_router(patients.router)
api_router.include_router(doctors.router)
api_router.include_router(tests.router)
api_router.include_router(inventory.router)
api_router.include_router(branches.router)

_uploads = Path("uploads")
_uploads.mkdir(exist_ok=True)
(_uploads / "logos").mkdir(exist_ok=True)
api_router.mount("/uploads", StaticFiles(directory=str(_uploads)), name="uploads")
