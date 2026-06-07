from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.platform import BillingCycle, PlanTier, SubscriptionStatus, TenantStatus


class SubscriptionPlanCreate(BaseModel):
    name: str
    name_ar: str
    tier: PlanTier
    billing_cycle: BillingCycle
    price_egp: float = Field(ge=0)
    max_branches: int = Field(ge=1)
    max_users: int = Field(ge=1)
    features: dict = {}


class SubscriptionPlanResponse(BaseModel):
    id: UUID
    name: str
    name_ar: str
    tier: PlanTier
    billing_cycle: BillingCycle
    price_egp: float
    max_branches: int
    max_users: int
    features: dict
    is_active: bool

    model_config = {"from_attributes": True}


class TenantCreate(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    name: str
    name_ar: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    tax_number: Optional[str] = None
    plan_id: UUID
    admin_email: EmailStr
    admin_password: str = Field(min_length=8)
    admin_name: str


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    tax_number: Optional[str] = None
    status: Optional[TenantStatus] = None
    locale: Optional[str] = None
    custom_domain: Optional[str] = None


class TenantResponse(BaseModel):
    id: UUID
    code: str
    name: str
    name_ar: Optional[str] = None
    email: str
    phone: Optional[str] = None
    status: TenantStatus
    locale: str
    custom_domain: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantSubscriptionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    plan_id: UUID
    status: SubscriptionStatus
    starts_at: datetime
    expires_at: datetime
    grace_ends_at: Optional[datetime] = None
    auto_renew: bool
    amount_paid: float

    model_config = {"from_attributes": True}


class FeatureFlagUpdate(BaseModel):
    feature_key: str
    is_enabled: bool
    config: dict = {}


class RevenueDashboard(BaseModel):
    total_tenants: int
    active_subscriptions: int
    monthly_recurring_revenue: float
    yearly_recurring_revenue: float
    expiring_soon: int
    suspended_tenants: int
