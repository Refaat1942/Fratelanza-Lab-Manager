from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.platform import (
    BillingCycle,
    PlatformAuditLog,
    SubscriptionPlan,
    SubscriptionStatus,
    Tenant,
    TenantFeatureFlag,
    TenantStatus,
    TenantSubscription,
)
from app.models.tenant_config import Branch, TenantBranding
from app.schemas.auth import UserCreate
from app.schemas.platform import (
    SubscriptionRenewRequest,
    TenantChangePlanRequest,
    TenantCreate,
    TenantUpdate,
)
from app.services.auth_service import AuthService

settings = get_settings()


class PlatformService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_action(
        self,
        admin_id: UUID,
        action: str,
        entity_type: str,
        tenant_id: Optional[UUID] = None,
        entity_id: Optional[str] = None,
        details: Optional[dict] = None,
    ) -> None:
        self.db.add(
            PlatformAuditLog(
                platform_user_id=admin_id,
                tenant_id=tenant_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                details=details or {},
            )
        )

    async def get_tenant(self, tenant_id: UUID) -> Optional[Tenant]:
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_active_subscription(self, tenant_id: UUID) -> Optional[TenantSubscription]:
        result = await self.db.execute(
            select(TenantSubscription)
            .options(selectinload(TenantSubscription.plan))
            .where(TenantSubscription.tenant_id == tenant_id)
            .order_by(TenantSubscription.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_subscriptions(self) -> list[dict]:
        result = await self.db.execute(
            select(TenantSubscription, Tenant, SubscriptionPlan)
            .join(Tenant, TenantSubscription.tenant_id == Tenant.id)
            .join(SubscriptionPlan, TenantSubscription.plan_id == SubscriptionPlan.id)
            .where(Tenant.deleted_at.is_(None))
            .order_by(TenantSubscription.expires_at.asc())
        )
        rows = []
        for sub, tenant, plan in result.all():
            rows.append({
                "subscription": sub,
                "tenant": tenant,
                "plan": plan,
            })
        return rows

    async def create_tenant(self, data: TenantCreate, admin_id: UUID) -> Tenant:
        plan = await self.db.get(SubscriptionPlan, data.plan_id)
        if not plan:
            raise ValueError("Plan not found")

        tenant = Tenant(
            code=data.code,
            name=data.name,
            name_ar=data.name_ar,
            email=data.email,
            phone=data.phone,
            tax_number=data.tax_number,
            status=TenantStatus.TRIAL,
        )
        self.db.add(tenant)
        await self.db.flush()

        days = 30 if plan.billing_cycle == BillingCycle.MONTHLY else 365
        self.db.add(
            TenantSubscription(
                tenant_id=tenant.id,
                plan_id=plan.id,
                status=SubscriptionStatus.ACTIVE,
                expires_at=datetime.now(timezone.utc) + timedelta(days=days),
                amount_paid=plan.price_egp,
            )
        )
        self.db.add(Branch(tenant_id=tenant.id, code="HQ", name="Headquarters", name_ar="الفرع الرئيسي", is_headquarters=True))
        self.db.add(TenantBranding(tenant_id=tenant.id, company_name=data.name, company_name_ar=data.name_ar or data.name))

        await AuthService(self.db).create_user(
            tenant.id,
            UserCreate(email=data.admin_email, password=data.admin_password, full_name=data.admin_name, is_tenant_admin=True),
        )
        await self.log_action(admin_id, "tenant_created", "tenant", tenant.id, str(tenant.id), {"code": data.code})
        return tenant

    async def update_tenant(self, tenant_id: UUID, data: TenantUpdate, admin_id: UUID) -> Optional[Tenant]:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(tenant, key, value)
        await self.log_action(admin_id, "tenant_updated", "tenant", tenant.id, str(tenant.id))
        return tenant

    async def delete_tenant(self, tenant_id: UUID, admin_id: UUID) -> bool:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return False
        tenant.deleted_at = func.now()
        tenant.status = TenantStatus.LOCKED
        await self.log_action(admin_id, "tenant_deleted", "tenant", tenant.id, str(tenant.id))
        return True

    async def suspend_tenant(self, tenant_id: UUID, admin_id: UUID) -> bool:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return False
        tenant.status = TenantStatus.SUSPENDED
        sub = await self.get_active_subscription(tenant_id)
        if sub:
            sub.status = SubscriptionStatus.CANCELLED
        await self.log_action(admin_id, "tenant_suspended", "tenant", tenant.id, str(tenant.id))
        return True

    async def activate_tenant(self, tenant_id: UUID, admin_id: UUID) -> bool:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return False
        tenant.status = TenantStatus.ACTIVE
        sub = await self.get_active_subscription(tenant_id)
        if sub:
            sub.status = SubscriptionStatus.ACTIVE
        await self.log_action(admin_id, "tenant_activated", "tenant", tenant.id, str(tenant.id))
        return True

    async def lock_tenant(self, tenant_id: UUID, admin_id: UUID) -> bool:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return False
        tenant.status = TenantStatus.LOCKED
        await self.log_action(admin_id, "tenant_locked", "tenant", tenant.id, str(tenant.id))
        return True

    async def unlock_tenant(self, tenant_id: UUID, admin_id: UUID) -> bool:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return False
        tenant.status = TenantStatus.ACTIVE
        await self.log_action(admin_id, "tenant_unlocked", "tenant", tenant.id, str(tenant.id))
        return True

    async def renew_subscription(
        self, tenant_id: UUID, data: SubscriptionRenewRequest, admin_id: UUID
    ) -> Optional[TenantSubscription]:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return None
        sub = await self.get_active_subscription(tenant_id)
        plan = await self.db.get(SubscriptionPlan, data.plan_id or (sub.plan_id if sub else None))
        if not plan:
            raise ValueError("Plan not found")

        days = data.days or (30 if plan.billing_cycle == BillingCycle.MONTHLY else 365)
        now = datetime.now(timezone.utc)
        base = sub.expires_at if sub and sub.expires_at > now else now

        if sub:
            sub.plan_id = plan.id
            sub.status = SubscriptionStatus.ACTIVE
            sub.expires_at = base + timedelta(days=days)
            sub.grace_ends_at = sub.expires_at + timedelta(days=settings.GRACE_PERIOD_DAYS)
            sub.amount_paid = float(sub.amount_paid or 0) + (data.amount_paid or plan.price_egp)
            sub.auto_renew = data.auto_renew if data.auto_renew is not None else sub.auto_renew
        else:
            sub = TenantSubscription(
                tenant_id=tenant_id,
                plan_id=plan.id,
                status=SubscriptionStatus.ACTIVE,
                expires_at=now + timedelta(days=days),
                grace_ends_at=now + timedelta(days=days + settings.GRACE_PERIOD_DAYS),
                amount_paid=data.amount_paid or plan.price_egp,
                auto_renew=data.auto_renew if data.auto_renew is not None else True,
            )
            self.db.add(sub)

        tenant.status = TenantStatus.ACTIVE
        await self.log_action(
            admin_id, "subscription_renewed", "subscription", tenant_id, str(tenant_id),
            {"days": days, "plan_id": str(plan.id), "amount": data.amount_paid or plan.price_egp},
        )
        await self.db.flush()
        return sub

    async def change_plan(self, tenant_id: UUID, data: TenantChangePlanRequest, admin_id: UUID) -> Optional[TenantSubscription]:
        return await self.renew_subscription(
            tenant_id,
            SubscriptionRenewRequest(plan_id=data.plan_id, days=None, amount_paid=data.amount_paid, auto_renew=data.auto_renew),
            admin_id,
        )

    async def update_feature_flags(self, tenant_id: UUID, flags: list, admin_id: UUID) -> None:
        for flag in flags:
            result = await self.db.execute(
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
                self.db.add(TenantFeatureFlag(
                    tenant_id=tenant_id, feature_key=flag.feature_key,
                    is_enabled=flag.is_enabled, config=flag.config,
                ))
        await self.log_action(admin_id, "feature_flags_updated", "tenant", tenant_id, str(tenant_id))

    async def list_audit_logs(self, limit: int = 100) -> list[PlatformAuditLog]:
        result = await self.db.execute(
            select(PlatformAuditLog).order_by(PlatformAuditLog.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())
