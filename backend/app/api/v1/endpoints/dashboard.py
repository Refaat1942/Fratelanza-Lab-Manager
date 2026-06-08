from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentTenant, CurrentUser, DbSession
from app.schemas.dashboard import DashboardInsights, DashboardStats
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    return DashboardStats(**await DashboardService(db).get_stats(tenant.id, start_date, end_date))


@router.get("/insights", response_model=DashboardInsights)
async def get_insights(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    return DashboardInsights(**await DashboardService(db).get_insights(tenant.id, start_date, end_date))
