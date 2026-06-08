from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.services.export_service import EXPORT_MODULES, ExportService
from app.utils.date_filter import parse_date_param

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/{module}/excel")
async def export_module_excel(
    module: str,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("reports.read"),
    date_from: str | None = Query(None, description="YYYY-MM-DD"),
    date_to: str | None = Query(None, description="YYYY-MM-DD"),
):
    if module not in EXPORT_MODULES:
        raise HTTPException(status_code=404, detail=f"Unknown module: {module}")
    try:
        content, filename = await ExportService(db).export_excel(
            tenant.id,
            module,
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
