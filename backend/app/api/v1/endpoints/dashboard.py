from datetime import date

from fastapi import APIRouter

from app.api.v1.endpoints._date_filters import date_range_bounds
from app.api.deps import CurrentTenant, CurrentUser, DbSession
from app.schemas.dashboard import DashboardInsights, DashboardStats
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
):
    start, end = date_range_bounds(date_from, date_to)
    return DashboardStats(**await DashboardService(db).get_stats(tenant.id, start, end))


@router.get("/insights", response_model=DashboardInsights)
async def get_insights(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
):
    start, end = date_range_bounds(date_from, date_to)
    return DashboardInsights(**await DashboardService(db).get_insights(tenant.id, start, end))
