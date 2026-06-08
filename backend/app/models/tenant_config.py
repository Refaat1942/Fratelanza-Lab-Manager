from typing import Optional

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Branch(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "branches"

    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(255))
    name_ar: Mapped[Optional[str]] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    governorate: Mapped[Optional[str]] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    is_headquarters: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class TenantBranding(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "tenant_branding"

    company_name: Mapped[str] = mapped_column(String(255))
    company_name_ar: Mapped[Optional[str]] = mapped_column(String(255))
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    favicon_url: Mapped[Optional[str]] = mapped_column(String(500))
    primary_color: Mapped[str] = mapped_column(String(20), default="#0F766E")
    secondary_color: Mapped[str] = mapped_column(String(20), default="#14B8A6")
    accent_color: Mapped[str] = mapped_column(String(20), default="#F59E0B")
    custom_css: Mapped[Optional[str]] = mapped_column(Text)
    report_header_html: Mapped[Optional[str]] = mapped_column(Text)
    report_footer_html: Mapped[Optional[str]] = mapped_column(Text)
    renewal_reminder_days: Mapped[int] = mapped_column(Integer, default=14)
    renewal_reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    subscription_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
