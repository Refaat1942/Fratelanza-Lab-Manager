from fastapi import APIRouter, HTTPException

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
