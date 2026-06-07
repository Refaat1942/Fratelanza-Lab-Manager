from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from datetime import datetime, timedelta, timezone

from app.api.deps import DbSession, PlatformAdmin
from app.models.platform import (
    SubscriptionPlan,
    SubscriptionStatus,
    Tenant,
    TenantStatus,
    TenantSubscription,
)
from app.schemas.common import MessageResponse
from app.schemas.platform import (
    FeatureFlagUpdate,
    PlatformAuditLogResponse,
    PlatformAdminResponse,
    RevenueDashboard,
    SubscriptionListItem,
    SubscriptionPlanCreate,
    SubscriptionPlanResponse,
    SubscriptionPlanUpdate,
    SubscriptionRenewRequest,
    TenantChangePlanRequest,
    TenantCreate,
    TenantDetailResponse,
    TenantResponse,
    TenantSubscriptionResponse,
    TenantUpdate,
)
from app.services.platform_service import PlatformService

router = APIRouter(prefix="/platform", tags=["SaaS Platform"])


@router.get("/me", response_model=PlatformAdminResponse)
async def platform_me(admin: PlatformAdmin):
    return PlatformAdminResponse.model_validate(admin)


@router.get("/dashboard", response_model=RevenueDashboard)
async def revenue_dashboard(db: DbSession, admin: PlatformAdmin):
    total = await db.scalar(select(func.count()).select_from(Tenant).where(Tenant.deleted_at.is_(None)))
    active = await db.scalar(
        select(func.count()).select_from(TenantSubscription).where(TenantSubscription.status == SubscriptionStatus.ACTIVE)
    )
    mrr = await db.scalar(
        select(func.coalesce(func.sum(SubscriptionPlan.price_egp), 0))
        .select_from(TenantSubscription).join(SubscriptionPlan)
        .where(TenantSubscription.status == SubscriptionStatus.ACTIVE, SubscriptionPlan.billing_cycle == "monthly")
    )
    yrr = await db.scalar(
        select(func.coalesce(func.sum(SubscriptionPlan.price_egp), 0))
        .select_from(TenantSubscription).join(SubscriptionPlan)
        .where(TenantSubscription.status == SubscriptionStatus.ACTIVE, SubscriptionPlan.billing_cycle == "yearly")
    )
    soon = await db.scalar(
        select(func.count()).select_from(TenantSubscription).where(
            TenantSubscription.expires_at <= datetime.now(timezone.utc) + timedelta(days=14),
            TenantSubscription.status == SubscriptionStatus.ACTIVE,
        )
    )
    suspended = await db.scalar(select(func.count()).select_from(Tenant).where(Tenant.status == TenantStatus.SUSPENDED))
    return RevenueDashboard(
        total_tenants=total or 0,
        active_subscriptions=active or 0,
        monthly_recurring_revenue=float(mrr or 0),
        yearly_recurring_revenue=float(yrr or 0),
        expiring_soon=soon or 0,
        suspended_tenants=suspended or 0,
    )


@router.get("/subscriptions", response_model=list[SubscriptionListItem])
async def list_subscriptions(db: DbSession, admin: PlatformAdmin):
    rows = await PlatformService(db).list_subscriptions()
    return [
        SubscriptionListItem(
            subscription_id=row["subscription"].id,
            tenant_id=row["tenant"].id,
            tenant_code=row["tenant"].code,
            tenant_name=row["tenant"].name,
            plan_name=row["plan"].name,
            plan_tier=row["plan"].tier,
            status=row["subscription"].status,
            tenant_status=row["tenant"].status,
            expires_at=row["subscription"].expires_at,
            grace_ends_at=row["subscription"].grace_ends_at,
            auto_renew=row["subscription"].auto_renew,
            amount_paid=float(row["subscription"].amount_paid),
            price_egp=float(row["plan"].price_egp),
        )
        for row in rows
    ]


@router.get("/audit-logs", response_model=list[PlatformAuditLogResponse])
async def list_audit_logs(db: DbSession, admin: PlatformAdmin, limit: int = Query(100, le=500)):
    logs = await PlatformService(db).list_audit_logs(limit)
    return [PlatformAuditLogResponse.model_validate(log) for log in logs]


@router.get("/tenants", response_model=list[TenantResponse])
async def list_tenants(db: DbSession, admin: PlatformAdmin, status_filter: TenantStatus | None = None):
    query = select(Tenant).where(Tenant.deleted_at.is_(None))
    if status_filter:
        query = query.where(Tenant.status == status_filter)
    result = await db.execute(query.order_by(Tenant.created_at.desc()))
    return [TenantResponse.model_validate(t) for t in result.scalars().all()]


@router.get("/tenants/{tenant_id}", response_model=TenantDetailResponse)
async def get_tenant(tenant_id: UUID, db: DbSession, admin: PlatformAdmin):
    svc = PlatformService(db)
    tenant = await svc.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    sub = await svc.get_active_subscription(tenant_id)
    detail = TenantDetailResponse.model_validate(tenant)
    if sub:
        detail.subscription = TenantSubscriptionResponse.model_validate(sub)
        plan = await db.get(SubscriptionPlan, sub.plan_id)
        if plan:
            detail.plan_name = plan.name
            detail.plan_tier = plan.tier
    return detail


@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(data: TenantCreate, db: DbSession, admin: PlatformAdmin):
    code = data.code.strip().lower()
    existing = await db.execute(select(Tenant).where(Tenant.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tenant code already exists")
    try:
        tenant = await PlatformService(db).create_tenant(data, admin.id)
        return TenantResponse.model_validate(tenant)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(tenant_id: UUID, data: TenantUpdate, db: DbSession, admin: PlatformAdmin):
    tenant = await PlatformService(db).update_tenant(tenant_id, data, admin.id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantResponse.model_validate(tenant)


@router.delete("/tenants/{tenant_id}", response_model=MessageResponse)
async def delete_tenant(tenant_id: UUID, db: DbSession, admin: PlatformAdmin):
    if not await PlatformService(db).delete_tenant(tenant_id, admin.id):
        raise HTTPException(status_code=404, detail="Tenant not found")
    return MessageResponse(message="Tenant deleted", message_ar="تم حذف المختبر")


@router.post("/tenants/{tenant_id}/suspend", response_model=MessageResponse)
async def suspend_tenant(tenant_id: UUID, db: DbSession, admin: PlatformAdmin):
    if not await PlatformService(db).suspend_tenant(tenant_id, admin.id):
        raise HTTPException(status_code=404, detail="Tenant not found")
    return MessageResponse(message="Tenant suspended", message_ar="تم تعليق المختبر")


@router.post("/tenants/{tenant_id}/activate", response_model=MessageResponse)
async def activate_tenant(tenant_id: UUID, db: DbSession, admin: PlatformAdmin):
    if not await PlatformService(db).activate_tenant(tenant_id, admin.id):
        raise HTTPException(status_code=404, detail="Tenant not found")
    return MessageResponse(message="Tenant activated", message_ar="تم تفعيل المختبر")


@router.post("/tenants/{tenant_id}/lock", response_model=MessageResponse)
async def lock_tenant(tenant_id: UUID, db: DbSession, admin: PlatformAdmin):
    if not await PlatformService(db).lock_tenant(tenant_id, admin.id):
        raise HTTPException(status_code=404, detail="Tenant not found")
    return MessageResponse(message="Tenant locked", message_ar="تم قفل المختبر")


@router.post("/tenants/{tenant_id}/unlock", response_model=MessageResponse)
async def unlock_tenant(tenant_id: UUID, db: DbSession, admin: PlatformAdmin):
    if not await PlatformService(db).unlock_tenant(tenant_id, admin.id):
        raise HTTPException(status_code=404, detail="Tenant not found")
    return MessageResponse(message="Tenant unlocked", message_ar="تم تفعيل المختبر")


@router.post("/tenants/{tenant_id}/renew", response_model=TenantSubscriptionResponse)
async def renew_subscription(tenant_id: UUID, data: SubscriptionRenewRequest, db: DbSession, admin: PlatformAdmin):
    try:
        sub = await PlatformService(db).renew_subscription(tenant_id, data, admin.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not sub:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantSubscriptionResponse.model_validate(sub)


@router.post("/tenants/{tenant_id}/change-plan", response_model=TenantSubscriptionResponse)
async def change_plan(tenant_id: UUID, data: TenantChangePlanRequest, db: DbSession, admin: PlatformAdmin):
    try:
        sub = await PlatformService(db).change_plan(tenant_id, data, admin.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not sub:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantSubscriptionResponse.model_validate(sub)


@router.put("/tenants/{tenant_id}/features", response_model=MessageResponse)
async def update_feature_flags(tenant_id: UUID, flags: list[FeatureFlagUpdate], db: DbSession, admin: PlatformAdmin):
    await PlatformService(db).update_feature_flags(tenant_id, flags, admin.id)
    return MessageResponse(message="Feature flags updated", message_ar="تم تحديث الميزات")


@router.get("/plans", response_model=list[SubscriptionPlanResponse])
async def list_plans(db: DbSession, admin: PlatformAdmin, include_inactive: bool = False):
    query = select(SubscriptionPlan).where(SubscriptionPlan.deleted_at.is_(None))
    if not include_inactive:
        query = query.where(SubscriptionPlan.is_active.is_(True))
    result = await db.execute(query.order_by(SubscriptionPlan.tier, SubscriptionPlan.price_egp))
    return [SubscriptionPlanResponse.model_validate(p) for p in result.scalars().all()]


@router.post("/plans", response_model=SubscriptionPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(data: SubscriptionPlanCreate, db: DbSession, admin: PlatformAdmin):
    plan = SubscriptionPlan(**data.model_dump())
    db.add(plan)
    await db.flush()
    return SubscriptionPlanResponse.model_validate(plan)


@router.patch("/plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def update_plan(plan_id: UUID, data: SubscriptionPlanUpdate, db: DbSession, admin: PlatformAdmin):
    plan = await db.get(SubscriptionPlan, plan_id)
    if not plan or plan.deleted_at:
        raise HTTPException(status_code=404, detail="Plan not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(plan, key, value)
    await db.flush()
    return SubscriptionPlanResponse.model_validate(plan)


@router.delete("/plans/{plan_id}", response_model=MessageResponse)
async def delete_plan(plan_id: UUID, db: DbSession, admin: PlatformAdmin):
    plan = await db.get(SubscriptionPlan, plan_id)
    if not plan or plan.deleted_at:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.deleted_at = func.now()
    plan.is_active = False
    return MessageResponse(message="Plan deleted", message_ar="تم حذف الباقة")
