from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.services.reports_service import REPORT_TYPES, ReportsService
from app.utils.date_filter import parse_date_param

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/{report_type}/excel")
async def export_report_excel(
    report_type: str,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("reports.read"),
    date_from: str | None = Query(None, description="YYYY-MM-DD"),
    date_to: str | None = Query(None, description="YYYY-MM-DD"),
):
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=404, detail=f"Unknown report: {report_type}")
    try:
        content, filename = await ReportsService(db).export_report(
            tenant.id,
            report_type,
            parse_date_param(date_from),
            parse_date_param(date_to),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
