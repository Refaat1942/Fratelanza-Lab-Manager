from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

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
    email: Optional[str] = None
    phone: Optional[str] = None
    tax_number: Optional[str] = None
    plan_id: UUID
    admin_username: str = Field(min_length=2, max_length=64)
    admin_password: str = Field(min_length=8)
    admin_name: str


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    tax_number: Optional[str] = None
    status: Optional[TenantStatus] = None
    locale: Optional[str] = None
    custom_domain: Optional[str] = None
    max_users_override: Optional[int] = Field(None, ge=1)
    max_branches_override: Optional[int] = Field(None, ge=1)


class TenantLimitsResponse(BaseModel):
    max_users: int
    max_branches: int
    current_users: int
    current_branches: int
    plan_max_users: Optional[int] = None
    plan_max_branches: Optional[int] = None
    max_users_override: Optional[int] = None
    max_branches_override: Optional[int] = None


class TenantResponse(BaseModel):
    id: UUID
    code: str
    name: str
    name_ar: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    tax_number: Optional[str] = None
    status: TenantStatus
    locale: str
    custom_domain: Optional[str] = None
    max_users_override: Optional[int] = None
    max_branches_override: Optional[int] = None
    database_name: Optional[str] = None
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


class FeatureFlagResponse(BaseModel):
    feature_key: str
    is_enabled: bool
    config: dict = {}


class ModuleCatalogItem(BaseModel):
    key: str
    label_en: str
    label_ar: str
    locked: bool = False


class TenantFeaturesResponse(BaseModel):
    modules: dict[str, bool]
    enabled_modules: list[str]


class RevenueDashboard(BaseModel):
    total_tenants: int
    active_subscriptions: int
    monthly_recurring_revenue: float
    yearly_recurring_revenue: float
    expiring_soon: int
    suspended_tenants: int


class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    price_egp: Optional[float] = Field(None, ge=0)
    max_branches: Optional[int] = Field(None, ge=1)
    max_users: Optional[int] = Field(None, ge=1)
    features: Optional[dict] = None
    is_active: Optional[bool] = None


class SubscriptionRenewRequest(BaseModel):
    plan_id: Optional[UUID] = None
    days: Optional[int] = Field(None, ge=1)
    amount_paid: Optional[float] = Field(None, ge=0)
    auto_renew: Optional[bool] = None


class TenantChangePlanRequest(BaseModel):
    plan_id: UUID
    amount_paid: Optional[float] = Field(None, ge=0)
    auto_renew: Optional[bool] = None


class TenantAdminResponse(BaseModel):
    id: UUID
    username: str
    full_name: str
    full_name_ar: Optional[str] = None
    is_active: bool
    is_tenant_admin: bool

    model_config = {"from_attributes": True}


class TenantAdminUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=2, max_length=64)
    password: Optional[str] = Field(None, min_length=8)
    full_name: Optional[str] = None
    full_name_ar: Optional[str] = None
    is_active: Optional[bool] = None


class TenantDetailResponse(TenantResponse):
    subscription: Optional[TenantSubscriptionResponse] = None
    plan_name: Optional[str] = None
    plan_tier: Optional[PlanTier] = None
    admin: Optional[TenantAdminResponse] = None
    limits: Optional[TenantLimitsResponse] = None
    features: Optional[TenantFeaturesResponse] = None


class SubscriptionListItem(BaseModel):
    subscription_id: UUID
    tenant_id: UUID
    tenant_code: str
    tenant_name: str
    plan_name: str
    plan_tier: PlanTier
    status: SubscriptionStatus
    tenant_status: TenantStatus
    expires_at: datetime
    grace_ends_at: Optional[datetime] = None
    auto_renew: bool
    amount_paid: float
    price_egp: float


class PlatformAuditLogResponse(BaseModel):
    id: UUID
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    tenant_id: Optional[UUID] = None
    details: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlatformAdminResponse(BaseModel):
    id: UUID
    username: str
    email: Optional[str] = None
    full_name: str
    is_superadmin: bool

    model_config = {"from_attributes": True}
