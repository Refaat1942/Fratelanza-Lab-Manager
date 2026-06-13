import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    LOCKED = "locked"
    TRIAL = "trial"
    EXPIRED = "expired"


class BillingCycle(str, enum.Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    GRACE = "grace"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class PlanTier(str, enum.Enum):
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class PlatformUser(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "platform_users"

    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)


class SubscriptionPlan(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "subscription_plans"

    name: Mapped[str] = mapped_column(String(100))
    name_ar: Mapped[str] = mapped_column(String(100))
    tier: Mapped[PlanTier] = mapped_column(Enum(PlanTier), index=True)
    billing_cycle: Mapped[BillingCycle] = mapped_column(Enum(BillingCycle))
    price_egp: Mapped[float] = mapped_column(Numeric(12, 2))
    max_branches: Mapped[int] = mapped_column(Integer, default=1)
    max_users: Mapped[int] = mapped_column(Integer, default=5)
    features: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Tenant(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tenants"

    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    name_ar: Mapped[Optional[str]] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    tax_number: Mapped[Optional[str]] = mapped_column(String(50))
    status: Mapped[TenantStatus] = mapped_column(Enum(TenantStatus), default=TenantStatus.TRIAL, index=True)
    locale: Mapped[str] = mapped_column(String(5), default="ar")
    timezone: Mapped[str] = mapped_column(String(50), default="Africa/Cairo")
    custom_domain: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    max_users_override: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_branches_override: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    database_name: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True, index=True)

    subscriptions: Mapped[list["TenantSubscription"]] = relationship(back_populates="tenant")
    feature_flags: Mapped[list["TenantFeatureFlag"]] = relationship(back_populates="tenant")


class TenantSubscription(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "tenant_subscriptions"

    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"))
    status: Mapped[SubscriptionStatus] = mapped_column(Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    grace_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    auto_renew: Mapped[bool] = mapped_column(Boolean, default=True)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    tenant: Mapped["Tenant"] = relationship(back_populates="subscriptions")
    plan: Mapped["SubscriptionPlan"] = relationship()


class TenantFeatureFlag(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "tenant_feature_flags"

    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    feature_key: Mapped[str] = mapped_column(String(100), index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    tenant: Mapped["Tenant"] = relationship(back_populates="feature_flags")


class PlatformAuditLog(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "platform_audit_logs"

    platform_user_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("platform_users.id"))
    tenant_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[Optional[str]] = mapped_column(String(100))
    details: Mapped[Optional[dict]] = mapped_column(JSONB)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
