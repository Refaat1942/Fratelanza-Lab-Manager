from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.services.branding_service import BrandingService
from app.services.pdf_service import PdfService
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


@router.get("/daily-operations/pdf")
async def daily_operations_pdf(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("reports.read"),
    date_from: str = Query(..., description="YYYY-MM-DD"),
    date_to: str = Query(..., description="YYYY-MM-DD"),
):
    d_from = parse_date_param(date_from)
    d_to = parse_date_param(date_to)
    if not d_from or not d_to:
        raise HTTPException(status_code=400, detail="date_from and date_to are required")
    branding = await BrandingService(db).get_by_tenant_id(tenant.id)
    company = branding.company_name if branding else tenant.name
    content = await PdfService(db).daily_operations_pdf(tenant.id, d_from, d_to, company)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="daily_operations.pdf"'},
    )
