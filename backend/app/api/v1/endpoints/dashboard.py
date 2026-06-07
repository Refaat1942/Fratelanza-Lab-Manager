from fastapi import APIRouter

from app.api.deps import CurrentTenant, CurrentUser, DbSession
from app.schemas.dashboard import DashboardInsights, DashboardStats
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
):
    return DashboardStats(**await DashboardService(db).get_stats(tenant.id))


@router.get("/insights", response_model=DashboardInsights)
async def get_insights(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
):
    return DashboardInsights(**await DashboardService(db).get_insights(tenant.id))
