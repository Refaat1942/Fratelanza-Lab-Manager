from sqlalchemy import func, select
from fastapi import APIRouter

from app.api.deps import CurrentTenant, CurrentUser, DbSession
from app.models.doctors import Doctor
from app.models.inventory import InventoryItem
from app.models.patients import Patient
from app.models.tests import Test
from app.schemas.dashboard import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
):
    patients = await db.scalar(
        select(func.count()).select_from(Patient).where(
            Patient.tenant_id == tenant.id, Patient.deleted_at.is_(None)
        )
    )
    doctors = await db.scalar(
        select(func.count()).select_from(Doctor).where(
            Doctor.tenant_id == tenant.id, Doctor.deleted_at.is_(None)
        )
    )
    tests = await db.scalar(
        select(func.count()).select_from(Test).where(
            Test.tenant_id == tenant.id, Test.deleted_at.is_(None)
        )
    )
    inventory_items = await db.scalar(
        select(func.count()).select_from(InventoryItem).where(
            InventoryItem.tenant_id == tenant.id, InventoryItem.deleted_at.is_(None)
        )
    )
    return DashboardStats(
        patients=patients or 0,
        doctors=doctors or 0,
        tests=tests or 0,
        inventory_items=inventory_items or 0,
        low_stock_items=0,
    )
