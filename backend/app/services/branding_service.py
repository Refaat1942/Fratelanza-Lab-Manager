from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform import Tenant
from app.models.tenant_config import TenantBranding
from app.schemas.branding import BrandingUpdate

UPLOAD_DIR = Path("uploads/logos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


class BrandingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_tenant_id(self, tenant_id: UUID) -> TenantBranding | None:
        result = await self.db.execute(
            select(TenantBranding).where(TenantBranding.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def get_by_tenant_code(self, tenant_code: str) -> tuple[Tenant, TenantBranding] | None:
        result = await self.db.execute(
            select(Tenant, TenantBranding)
            .join(TenantBranding, TenantBranding.tenant_id == Tenant.id)
            .where(Tenant.code == tenant_code, Tenant.deleted_at.is_(None))
        )
        row = result.first()
        if not row:
            tenant_result = await self.db.execute(
                select(Tenant).where(Tenant.code == tenant_code, Tenant.deleted_at.is_(None))
            )
            tenant = tenant_result.scalar_one_or_none()
            if not tenant:
                return None
            branding = TenantBranding(
                tenant_id=tenant.id,
                company_name=tenant.name,
                company_name_ar=tenant.name_ar,
            )
            self.db.add(branding)
            await self.db.flush()
            return tenant, branding
        return row[0], row[1]

    async def update(self, tenant_id: UUID, data: BrandingUpdate) -> TenantBranding:
        branding = await self.get_by_tenant_id(tenant_id)
        if not branding:
            tenant = await self.db.get(Tenant, tenant_id)
            branding = TenantBranding(
                tenant_id=tenant_id,
                company_name=tenant.name if tenant else "Laboratory",
                company_name_ar=tenant.name_ar if tenant else None,
            )
            self.db.add(branding)
            await self.db.flush()

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(branding, key, value)
        await self.db.flush()
        return branding

    async def save_logo(self, tenant_id: UUID, filename: str, content: bytes) -> str:
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Unsupported image type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

        dest = UPLOAD_DIR / f"{tenant_id}{ext}"
        for old in UPLOAD_DIR.glob(f"{tenant_id}.*"):
            old.unlink(missing_ok=True)
        dest.write_bytes(content)

        logo_path = f"/uploads/logos/{tenant_id}{ext}"
        branding = await self.get_by_tenant_id(tenant_id)
        if branding:
            branding.logo_url = logo_path
        else:
            tenant = await self.db.get(Tenant, tenant_id)
            self.db.add(
                TenantBranding(
                    tenant_id=tenant_id,
                    company_name=tenant.name if tenant else "Laboratory",
                    company_name_ar=tenant.name_ar if tenant else None,
                    logo_url=logo_path,
                )
            )
        await self.db.flush()
        return logo_path
