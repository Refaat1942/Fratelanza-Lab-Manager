from typing import Optional

from pydantic import BaseModel, Field


class BrandingResponse(BaseModel):
    company_name: str
    company_name_ar: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: str = "#1e3a5f"
    secondary_color: str = "#2d5a87"
    accent_color: str = "#c9a227"
    custom_domain: Optional[str] = None
    custom_css: Optional[str] = None
    report_header_html: Optional[str] = None
    report_footer_html: Optional[str] = None

    model_config = {"from_attributes": True}


class BrandingUpdate(BaseModel):
    company_name: Optional[str] = Field(None, min_length=2, max_length=255)
    company_name_ar: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = Field(None, max_length=500)
    favicon_url: Optional[str] = Field(None, max_length=500)
    primary_color: Optional[str] = Field(None, max_length=20)
    secondary_color: Optional[str] = Field(None, max_length=20)
    accent_color: Optional[str] = Field(None, max_length=20)
    custom_css: Optional[str] = None
    report_header_html: Optional[str] = None
    report_footer_html: Optional[str] = None


class PublicBrandingResponse(BaseModel):
    tenant_code: str
    company_name: str
    company_name_ar: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: str = "#1e3a5f"
