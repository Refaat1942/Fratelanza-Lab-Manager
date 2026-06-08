from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.api.deps import DbSession
from app.schemas.branding import PublicBrandingResponse
from app.services.branding_service import BrandingService

router = APIRouter(prefix="/public", tags=["Public"])


@router.get("/branding/{tenant_code}", response_model=PublicBrandingResponse)
async def get_public_branding(tenant_code: str, db: DbSession):
    result = await BrandingService(db).get_by_tenant_code(tenant_code.strip().lower())
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
async def get_public_logo_by_code(tenant_code: str, db: DbSession):
    """Serve tenant logo without auth — used by login page and sidebar img tags."""
    result = await BrandingService(db).get_by_tenant_code(tenant_code.strip().lower())
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
async def get_public_logo_by_id(tenant_id: UUID, db: DbSession):
    """Serve tenant logo by ID — fallback when tenant code is unavailable."""
    branding = await BrandingService(db).get_by_tenant_id(tenant_id)
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
