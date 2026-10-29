from fastapi import APIRouter, Query

from app.api.deps import CurrentTenant, CurrentUser, DbSession, get_user_permissions
from app.schemas.dashboard import DashboardInsights, DashboardStats, ExpenseInsight, FinancialInsight
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
    insights = DashboardInsights(**await DashboardService(db).get_insights(
        tenant.id, parse_date_param(date_from), parse_date_param(date_to)
    ))
    perms = get_user_permissions(user)
    if not perms & {"*", "billing.read", "reports.read"}:
        # e.g. lab technicians: keep the work figures, hide the money.
        insights.show_financials = False
        insights.financial = FinancialInsight(total_invoiced=0, total_collected=0, outstanding=0, invoice_count=0)
        insights.expenses = ExpenseInsight(total_expenses=0, expense_count=0)
        insights.net_profit = 0
        insights.laboratory.sales_total = insights.laboratory.discount_total = 0
        insights.laboratory.cost_total = insights.laboratory.margin = 0
        insights.recent_invoices = []
    return insights
