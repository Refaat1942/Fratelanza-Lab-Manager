from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.api.deps import PlatformDbSession
from app.db.manager import get_database_manager
from app.models.platform import Tenant
from app.schemas.branding import BrandingUpdate, PublicBrandingResponse
from app.services.branding_service import BrandingService

from app.core.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/public", tags=["Public"])
manager = get_database_manager()


@router.get("/version")
async def get_app_version():
    """Public build info — use to verify production deploy."""
    return {
        "version": settings.APP_VERSION,
        "build": settings.BUILD_SHA,
        "features": [
            "arabic_daily_report_pdf_excel",
            "patient_paid_remaining",
            "automated_backups",
            "tenant_db_sync_on_login",
        ],
    }


async def _load_tenant_branding(tenant_code: str, platform_db):
    code = tenant_code.strip().lower()
    tenant_result = await platform_db.execute(
        select(Tenant).where(Tenant.code == code, Tenant.deleted_at.is_(None))
    )
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        return None

    db_name = manager.resolve_tenant_database(tenant.code, tenant.database_name)
    factory = await manager.get_tenant_session_factory(db_name)
    async with factory() as tenant_db:
        branding = await BrandingService(tenant_db).get_by_tenant_id(tenant.id)
        if not branding:
            branding = await BrandingService(tenant_db).update(tenant.id, BrandingUpdate())
            await tenant_db.commit()
        return tenant, branding


async def _load_branding_by_id(tenant_id: UUID, platform_db):
    tenant = await platform_db.get(Tenant, tenant_id)
    if not tenant or tenant.deleted_at:
        return None

    db_name = manager.resolve_tenant_database(tenant.code, tenant.database_name)
    factory = await manager.get_tenant_session_factory(db_name)
    async with factory() as tenant_db:
        branding = await BrandingService(tenant_db).get_by_tenant_id(tenant_id)
        return branding


@router.get("/branding/{tenant_code}", response_model=PublicBrandingResponse)
async def get_public_branding(tenant_code: str, platform_db: PlatformDbSession):
    result = await _load_tenant_branding(tenant_code, platform_db)
    if not result:
        raise HTTPException(status_code=404, detail="Laboratory not found")
    tenant, branding = result
    return PublicBrandingResponse(
        tenant_code=tenant.code,
        company_name=branding.company_name,
        company_name_ar=branding.company_name_ar,
        logo_url=branding.logo_url,
        primary_color=branding.primary_color or "#1e3a5f",
    )


@router.get("/branding/{tenant_code}/logo")
async def get_public_logo_by_code(tenant_code: str, platform_db: PlatformDbSession):
    """Serve tenant logo without auth — used by login page and sidebar img tags."""
    result = await _load_tenant_branding(tenant_code, platform_db)
    if not result:
        raise HTTPException(status_code=404, detail="Laboratory not found")
    _, branding = result
    path = BrandingService.resolve_logo_path(branding.logo_url)
    if not path:
        raise HTTPException(status_code=404, detail="Logo not found")
    return FileResponse(
        path,
        media_type=BrandingService.logo_media_type(path),
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/logo/{tenant_id}")
async def get_public_logo_by_id(tenant_id: UUID, platform_db: PlatformDbSession):
    """Serve tenant logo by ID — fallback when tenant code is unavailable."""
    branding = await _load_branding_by_id(tenant_id, platform_db)
    if not branding or not branding.logo_url:
        raise HTTPException(status_code=404, detail="Logo not found")
    path = BrandingService.resolve_logo_path(branding.logo_url)
    if not path:
        raise HTTPException(status_code=404, detail="Logo file not found on disk")
    return FileResponse(
        path,
        media_type=BrandingService.logo_media_type(path),
        headers={"Cache-Control": "public, max-age=3600"},
    )
