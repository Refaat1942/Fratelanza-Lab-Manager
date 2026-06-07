from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession
from app.core.security import get_password_hash
from app.models.auth import User
from app.models.platform import (
    PlatformAuditLog,
    SubscriptionPlan,
    SubscriptionStatus,
    Tenant,
    TenantFeatureFlag,
    TenantStatus,
    TenantSubscription,
)
from app.models.tenant_config import Branch, TenantBranding
from app.schemas.common import MessageResponse
from app.schemas.platform import (
    FeatureFlagUpdate,
    RevenueDashboard,
    SubscriptionPlanCreate,
    SubscriptionPlanResponse,
    TenantCreate,
    TenantResponse,
    TenantUpdate,
)
from app.services.auth_service import AuthService
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/platform", tags=["SaaS Platform"])


@router.get("/dashboard", response_model=RevenueDashboard)
async def revenue_dashboard(db: DbSession):
    total = await db.scalar(select(func.count()).select_from(Tenant).where(Tenant.deleted_at.is_(None)))
    active = await db.scalar(
        select(func.count())
        .select_from(TenantSubscription)
        .where(TenantSubscription.status == SubscriptionStatus.ACTIVE)
    )
    mrr = await db.scalar(
        select(func.coalesce(func.sum(SubscriptionPlan.price_egp), 0))
        .select_from(TenantSubscription)
        .join(SubscriptionPlan)
        .where(TenantSubscription.status == SubscriptionStatus.ACTIVE, SubscriptionPlan.billing_cycle == "monthly")
    )
    yrr = await db.scalar(
        select(func.coalesce(func.sum(SubscriptionPlan.price_egp), 0))
        .select_from(TenantSubscription)
        .join(SubscriptionPlan)
        .where(TenantSubscription.status == SubscriptionStatus.ACTIVE, SubscriptionPlan.billing_cycle == "yearly")
    )
    soon = await db.scalar(
        select(func.count())
        .select_from(TenantSubscription)
        .where(
            TenantSubscription.expires_at <= datetime.now(timezone.utc) + timedelta(days=14),
            TenantSubscription.status == SubscriptionStatus.ACTIVE,
        )
    )
    suspended = await db.scalar(
        select(func.count()).select_from(Tenant).where(Tenant.status == TenantStatus.SUSPENDED)
    )
    return RevenueDashboard(
        total_tenants=total or 0,
        active_subscriptions=active or 0,
        monthly_recurring_revenue=float(mrr or 0),
        yearly_recurring_revenue=float(yrr or 0),
        expiring_soon=soon or 0,
        suspended_tenants=suspended or 0,
    )


@router.get("/tenants", response_model=list[TenantResponse])
async def list_tenants(db: DbSession, status_filter: TenantStatus | None = None):
    query = select(Tenant).where(Tenant.deleted_at.is_(None))
    if status_filter:
        query = query.where(Tenant.status == status_filter)
    result = await db.execute(query.order_by(Tenant.created_at.desc()))
    return [TenantResponse.model_validate(t) for t in result.scalars().all()]


@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(data: TenantCreate, db: DbSession):
    existing = await db.execute(select(Tenant).where(Tenant.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tenant code already exists")

    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == data.plan_id))
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    tenant = Tenant(
        code=data.code,
        name=data.name,
        name_ar=data.name_ar,
        email=data.email,
        phone=data.phone,
        tax_number=data.tax_number,
        status=TenantStatus.TRIAL,
    )
    db.add(tenant)
    await db.flush()

    expires = datetime.now(timezone.utc) + timedelta(days=30 if plan.billing_cycle.value == "monthly" else 365)
    db.add(
        TenantSubscription(
            tenant_id=tenant.id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            expires_at=expires,
            amount_paid=plan.price_egp,
        )
    )
    db.add(
        Branch(
            tenant_id=tenant.id,
            code="HQ",
            name="Headquarters",
            name_ar="الفرع الرئيسي",
            is_headquarters=True,
        )
    )
    db.add(
        TenantBranding(
            tenant_id=tenant.id,
            company_name=data.name,
            company_name_ar=data.name_ar or data.name,
        )
    )
    from app.schemas.auth import UserCreate

    await AuthService(db).create_user(
        tenant.id,
        UserCreate(
            email=data.admin_email,
            password=data.admin_password,
            full_name=data.admin_name,
            is_tenant_admin=True,
        ),
    )
    db.add(
        PlatformAuditLog(
            tenant_id=tenant.id,
            action="tenant_created",
            entity_type="tenant",
            entity_id=str(tenant.id),
            details={"code": data.code, "plan_id": str(data.plan_id)},
        )
    )
    await db.flush()
    return TenantResponse.model_validate(tenant)


@router.patch("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(tenant_id: UUID, data: TenantUpdate, db: DbSession):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(tenant, key, value)
    await db.flush()
    return TenantResponse.model_validate(tenant)


@router.post("/tenants/{tenant_id}/lock", response_model=MessageResponse)
async def lock_tenant(tenant_id: UUID, db: DbSession):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.status = TenantStatus.LOCKED
    return MessageResponse(message="Tenant locked", message_ar="تم قفل المختبر")


@router.post("/tenants/{tenant_id}/unlock", response_model=MessageResponse)
async def unlock_tenant(tenant_id: UUID, db: DbSession):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.status = TenantStatus.ACTIVE
    return MessageResponse(message="Tenant unlocked", message_ar="تم تفعيل المختبر")


@router.get("/plans", response_model=list[SubscriptionPlanResponse])
async def list_plans(db: DbSession):
    result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.deleted_at.is_(None), SubscriptionPlan.is_active.is_(True))
    )
    return [SubscriptionPlanResponse.model_validate(p) for p in result.scalars().all()]


@router.post("/plans", response_model=SubscriptionPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(data: SubscriptionPlanCreate, db: DbSession):
    plan = SubscriptionPlan(**data.model_dump())
    db.add(plan)
    await db.flush()
    return SubscriptionPlanResponse.model_validate(plan)


@router.put("/tenants/{tenant_id}/features", response_model=MessageResponse)
async def update_feature_flags(tenant_id: UUID, flags: list[FeatureFlagUpdate], db: DbSession):
    for flag in flags:
        result = await db.execute(
            select(TenantFeatureFlag).where(
                TenantFeatureFlag.tenant_id == tenant_id,
                TenantFeatureFlag.feature_key == flag.feature_key,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.is_enabled = flag.is_enabled
            existing.config = flag.config
        else:
            db.add(
                TenantFeatureFlag(
                    tenant_id=tenant_id,
                    feature_key=flag.feature_key,
                    is_enabled=flag.is_enabled,
                    config=flag.config,
                )
            )
    return MessageResponse(message="Feature flags updated", message_ar="تم تحديث الميزات")
