from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.branding import BrandingResponse, BrandingUpdate
from app.schemas.platform import TenantLimitsResponse
from app.services.branding_service import BrandingService
from app.services.tenant_limits_service import TenantLimitsService

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/limits", response_model=TenantLimitsResponse)
async def get_limits(db: DbSession, tenant: CurrentTenant, user: CurrentUser):
    limits = await TenantLimitsService(db).get_limits(tenant.id)
    return limits.to_response()


@router.get("/branding", response_model=BrandingResponse)
async def get_branding(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
):
    svc = BrandingService(db)
    branding = await svc.get_by_tenant_id(tenant.id)
    if not branding:
        branding = await svc.update(tenant.id, BrandingUpdate())
        await db.commit()
    return BrandingResponse(
        company_name=branding.company_name,
        company_name_ar=branding.company_name_ar,
        logo_url=branding.logo_url,
        favicon_url=branding.favicon_url,
        primary_color=branding.primary_color,
        secondary_color=branding.secondary_color,
        accent_color=branding.accent_color,
        custom_domain=tenant.custom_domain,
        report_header_html=branding.report_header_html,
        report_footer_html=branding.report_footer_html,
        renewal_reminder_days=branding.renewal_reminder_days or 14,
        renewal_reminder_enabled=branding.renewal_reminder_enabled if branding.renewal_reminder_enabled is not None else True,
        subscription_end_date=branding.subscription_end_date,
    )


@router.put("/branding", response_model=BrandingResponse)
async def update_branding(
    data: BrandingUpdate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("settings.manage"),
):
    branding = await BrandingService(db).update(tenant.id, data)
    await db.commit()
    return BrandingResponse(
        company_name=branding.company_name,
        company_name_ar=branding.company_name_ar,
        logo_url=branding.logo_url,
        favicon_url=branding.favicon_url,
        primary_color=branding.primary_color,
        secondary_color=branding.secondary_color,
        accent_color=branding.accent_color,
        custom_domain=tenant.custom_domain,
        report_header_html=branding.report_header_html,
        report_footer_html=branding.report_footer_html,
        renewal_reminder_days=branding.renewal_reminder_days or 14,
        renewal_reminder_enabled=branding.renewal_reminder_enabled if branding.renewal_reminder_enabled is not None else True,
        subscription_end_date=branding.subscription_end_date,
    )


@router.post("/branding/logo", response_model=BrandingResponse)
async def upload_logo(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("settings.manage"),
    file: UploadFile = File(...),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Logo must be under 5 MB")
    try:
        await BrandingService(db).save_logo(tenant.id, file.filename or "logo.png", content)
        await db.commit()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    branding = await BrandingService(db).get_by_tenant_id(tenant.id)
    return BrandingResponse(
        company_name=branding.company_name,
        company_name_ar=branding.company_name_ar,
        logo_url=branding.logo_url,
        favicon_url=branding.favicon_url,
        primary_color=branding.primary_color,
        secondary_color=branding.secondary_color,
        accent_color=branding.accent_color,
        custom_domain=tenant.custom_domain,
        report_header_html=branding.report_header_html,
        report_footer_html=branding.report_footer_html,
        renewal_reminder_days=branding.renewal_reminder_days or 14,
        renewal_reminder_enabled=branding.renewal_reminder_enabled if branding.renewal_reminder_enabled is not None else True,
        subscription_end_date=branding.subscription_end_date,
    )
