from fastapi import APIRouter, Query

from app.api.deps import CurrentTenant, CurrentUser, DbSession
from app.schemas.dashboard import DashboardInsights, DashboardStats
from app.services.dashboard_service import DashboardService
from app.utils.date_filter import parse_date_param

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    return DashboardStats(**await DashboardService(db).get_stats(
        tenant.id, parse_date_param(date_from), parse_date_param(date_to)
    ))


@router.get("/insights", response_model=DashboardInsights)
async def get_insights(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    return DashboardInsights(**await DashboardService(db).get_insights(
        tenant.id, parse_date_param(date_from), parse_date_param(date_to)
    ))
