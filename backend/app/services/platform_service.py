from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models.auth import User
from app.models.tenant_config import Branch, TenantBranding
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
from app.schemas.auth import UserCreate
from app.schemas.platform import (
    RevenueDashboard,
    SubscriptionRenewRequest,
    TenantAdminResponse,
    TenantAdminUpdate,
    TenantChangePlanRequest,
    TenantCreate,
    TenantListItem,
    TenantResponse,
    TenantSubscriptionUpdate,
    TenantUpdate,
)
from app.db.manager import get_database_manager, tenant_database_name
from app.services.auth_service import AuthService
from app.services.tenant_access_service import BLOCKED_STATUSES, TenantAccessService
from app.services.tenant_feature_service import TenantFeatureService
from app.services.tenant_provisioning_service import TenantProvisioningService

settings = get_settings()
manager = get_database_manager()


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

    async def get_revenue_dashboard(self) -> RevenueDashboard:
        now = datetime.now(timezone.utc)
        total = await self.db.scalar(
            select(func.count()).select_from(Tenant).where(Tenant.deleted_at.is_(None))
        )
        active = await self.db.scalar(
            select(func.count())
            .select_from(TenantSubscription)
            .join(Tenant, TenantSubscription.tenant_id == Tenant.id)
            .where(
                TenantSubscription.status == SubscriptionStatus.ACTIVE,
                Tenant.deleted_at.is_(None),
            )
        )
        mrr = await self.db.scalar(
            select(func.coalesce(func.sum(SubscriptionPlan.price_egp), 0))
            .select_from(TenantSubscription)
            .join(SubscriptionPlan, TenantSubscription.plan_id == SubscriptionPlan.id)
            .join(Tenant, TenantSubscription.tenant_id == Tenant.id)
            .where(
                TenantSubscription.status == SubscriptionStatus.ACTIVE,
                SubscriptionPlan.billing_cycle == BillingCycle.MONTHLY,
                Tenant.deleted_at.is_(None),
            )
        )
        yrr = await self.db.scalar(
            select(func.coalesce(func.sum(SubscriptionPlan.price_egp), 0))
            .select_from(TenantSubscription)
            .join(SubscriptionPlan, TenantSubscription.plan_id == SubscriptionPlan.id)
            .join(Tenant, TenantSubscription.tenant_id == Tenant.id)
            .where(
                TenantSubscription.status == SubscriptionStatus.ACTIVE,
                SubscriptionPlan.billing_cycle == BillingCycle.YEARLY,
                Tenant.deleted_at.is_(None),
            )
        )
        soon = await self.db.scalar(
            select(func.count())
            .select_from(TenantSubscription)
            .join(Tenant, TenantSubscription.tenant_id == Tenant.id)
            .where(
                TenantSubscription.status == SubscriptionStatus.ACTIVE,
                TenantSubscription.expires_at <= now + timedelta(days=14),
                Tenant.deleted_at.is_(None),
            )
        )
        suspended = await self.db.scalar(
            select(func.count()).select_from(Tenant).where(
                Tenant.status == TenantStatus.SUSPENDED,
                Tenant.deleted_at.is_(None),
            )
        )
        return RevenueDashboard(
            total_tenants=int(total or 0),
            active_subscriptions=int(active or 0),
            monthly_recurring_revenue=float(mrr or 0),
            yearly_recurring_revenue=float(yrr or 0),
            expiring_soon=int(soon or 0),
            suspended_tenants=int(suspended or 0),
        )

    async def list_tenants_enriched(self) -> list[TenantListItem]:
        result = await self.db.execute(
            select(Tenant).where(Tenant.deleted_at.is_(None)).order_by(Tenant.created_at.desc())
        )
        items: list[TenantListItem] = []
        for tenant in result.scalars().all():
            sub = await self.get_active_subscription(tenant.id)
            plan_name = None
            starts_at = None
            expires_at = None
            sub_status = None
            if sub:
                plan = await self.db.get(SubscriptionPlan, sub.plan_id)
                plan_name = plan.name if plan else None
                starts_at = sub.starts_at
                expires_at = sub.expires_at
                sub_status = sub.status
            tenant_data = TenantResponse.model_validate(tenant).model_dump()
            if not tenant_data.get("locale"):
                tenant_data["locale"] = "ar"
            items.append(
                TenantListItem(
                    **tenant_data,
                    plan_name=plan_name,
                    subscription_status=sub_status,
                    subscription_starts_at=starts_at,
                    subscription_expires_at=expires_at,
                )
            )
        return items

    async def _sync_subscription_branding(self, tenant: Tenant, expires_at: datetime) -> None:
        db_name = manager.resolve_tenant_database(tenant.code, tenant.database_name)
        if db_name == manager.platform_database_name:
            result = await self.db.execute(
                select(TenantBranding).where(TenantBranding.tenant_id == tenant.id)
            )
            branding = result.scalar_one_or_none()
            if branding:
                branding.subscription_end_date = expires_at.date()
            return

        factory = await manager.get_tenant_session_factory(db_name)
        async with factory() as tenant_db:
            result = await tenant_db.execute(
                select(TenantBranding).where(TenantBranding.tenant_id == tenant.id)
            )
            branding = result.scalar_one_or_none()
            if branding:
                branding.subscription_end_date = expires_at.date()
                await tenant_db.commit()

    async def update_subscription(
        self, tenant_id: UUID, data: TenantSubscriptionUpdate, admin_id: UUID
    ) -> TenantSubscription:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            raise ValueError("Tenant not found")

        sub = await self.get_active_subscription(tenant_id)
        if not sub:
            if not data.plan_id or not data.expires_at:
                raise ValueError("plan_id and expires_at are required for a new subscription")
            plan = await self.db.get(SubscriptionPlan, data.plan_id)
            if not plan:
                raise ValueError("Plan not found")
            now = datetime.now(timezone.utc)
            sub = TenantSubscription(
                tenant_id=tenant_id,
                plan_id=plan.id,
                status=data.status or SubscriptionStatus.ACTIVE,
                starts_at=data.starts_at or now,
                expires_at=data.expires_at,
                grace_ends_at=data.expires_at + timedelta(days=settings.GRACE_PERIOD_DAYS),
                auto_renew=data.auto_renew if data.auto_renew is not None else True,
                amount_paid=float(plan.price_egp),
            )
            self.db.add(sub)
        else:
            if data.plan_id:
                plan = await self.db.get(SubscriptionPlan, data.plan_id)
                if not plan:
                    raise ValueError("Plan not found")
                sub.plan_id = plan.id
            if data.starts_at is not None:
                sub.starts_at = data.starts_at
            if data.expires_at is not None:
                sub.expires_at = data.expires_at
                sub.grace_ends_at = data.expires_at + timedelta(days=settings.GRACE_PERIOD_DAYS)
            if data.status is not None:
                sub.status = data.status
            if data.auto_renew is not None:
                sub.auto_renew = data.auto_renew

        await self.db.flush()
        await self._sync_subscription_branding(tenant, sub.expires_at)
        await self.log_action(
            admin_id,
            "subscription_updated",
            "subscription",
            tenant_id,
            str(sub.id),
            {
                "plan_id": str(sub.plan_id),
                "starts_at": sub.starts_at.isoformat(),
                "expires_at": sub.expires_at.isoformat(),
                "status": sub.status.value,
            },
        )
        return sub

    async def get_lab_subscription_summary(self, tenant_id: UUID) -> dict:
        sub = await self.get_active_subscription(tenant_id)
        if not sub:
            return {
                "plan_name": None,
                "plan_tier": None,
                "status": None,
                "starts_at": None,
                "expires_at": None,
                "auto_renew": None,
                "price_egp": None,
            }
        plan = await self.db.get(SubscriptionPlan, sub.plan_id)
        return {
            "plan_name": plan.name if plan else None,
            "plan_tier": plan.tier.value if plan else None,
            "status": sub.status.value,
            "starts_at": sub.starts_at.isoformat(),
            "expires_at": sub.expires_at.isoformat(),
            "auto_renew": sub.auto_renew,
            "price_egp": float(plan.price_egp) if plan else None,
        }

    async def create_tenant(self, data: TenantCreate, admin_id: UUID) -> Tenant:
        plan = await self.db.get(SubscriptionPlan, data.plan_id)
        if not plan:
            raise ValueError("Plan not found")

        code = data.code.strip().lower()
        admin_username = data.admin_username.strip().lower()
        tenant = Tenant(
            code=code,
            name=data.name,
            name_ar=data.name_ar,
            email=(data.email or "").strip() or f"{code}@labmaster.local",
            phone=data.phone,
            tax_number=data.tax_number,
            status=TenantStatus.ACTIVE,
            database_name=tenant_database_name(code) if settings.TENANT_DATABASE_PER_CUSTOMER else None,
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
        await self.db.flush()

        await TenantFeatureService(self.db).seed_from_plan(tenant.id, plan)

        db_name = await TenantProvisioningService(self.db).provision_new_tenant(tenant)
        factory = await manager.get_tenant_session_factory(db_name)
        async with factory() as tenant_db:
            tenant_db.add(
                Branch(
                    tenant_id=tenant.id,
                    code="HQ",
                    name="Headquarters",
                    name_ar="الفرع الرئيسي",
                    is_headquarters=True,
                )
            )
            tenant_db.add(
                TenantBranding(
                    tenant_id=tenant.id,
                    company_name=data.name,
                    company_name_ar=data.name_ar or data.name,
                )
            )
            await AuthService(self.db, tenant_db).create_user(
                tenant.id,
                UserCreate(
                    username=admin_username,
                    password=data.admin_password,
                    full_name=data.admin_name,
                    is_tenant_admin=True,
                    is_system=True,
                ),
            )
            await tenant_db.commit()

        await self.log_action(admin_id, "tenant_created", "tenant", tenant.id, str(tenant.id), {"code": code})
        await self.db.flush()
        return tenant

    async def _tenant_db_session(self, tenant: Tenant):
        db_name = manager.resolve_tenant_database(tenant.code, tenant.database_name)
        factory = await manager.get_tenant_session_factory(db_name)
        return factory()

    async def get_tenant_admin(self, tenant_id: UUID) -> Optional[User]:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return None
        factory = await manager.get_tenant_session_factory(
            manager.resolve_tenant_database(tenant.code, tenant.database_name)
        )
        async with factory() as tenant_db:
            result = await tenant_db.execute(
                select(User)
                .where(
                    User.tenant_id == tenant_id,
                    User.is_tenant_admin.is_(True),
                    User.deleted_at.is_(None),
                )
                .order_by(User.created_at.asc())
                .limit(1)
            )
            return result.scalar_one_or_none()

    async def update_tenant(self, tenant_id: UUID, data: TenantUpdate, admin_id: UUID) -> Optional[Tenant]:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return None
        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(tenant, key, value)
        if updates.get("status") in BLOCKED_STATUSES:
            await TenantAccessService(self.db).revoke_tenant_sessions(tenant.id)
        await self.log_action(admin_id, "tenant_updated", "tenant", tenant.id, str(tenant.id))
        return tenant

    async def update_tenant_admin(
        self, tenant_id: UUID, data: TenantAdminUpdate, admin_id: UUID
    ) -> Optional[TenantAdminResponse]:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return None

        updates = data.model_dump(exclude_unset=True)
        db_name = manager.resolve_tenant_database(tenant.code, tenant.database_name)
        factory = await manager.get_tenant_session_factory(db_name)
        async with factory() as tenant_db:
            existing_admin = await self.get_tenant_admin(tenant_id)
            if existing_admin:
                user = await tenant_db.get(User, existing_admin.id)
            else:
                user = None

            if not user and updates.get("username") and updates.get("password"):
                from app.schemas.auth import UserCreate

                user = await AuthService(self.db, tenant_db).create_user(
                    tenant_id,
                    UserCreate(
                        username=updates["username"].strip().lower(),
                        password=updates["password"],
                        full_name=updates.get("full_name") or "Lab Administrator",
                        full_name_ar=updates.get("full_name_ar"),
                        is_tenant_admin=True,
                        is_system=True,
                    ),
                )
                await tenant_db.commit()
                await self.log_action(
                    admin_id,
                    "tenant_admin_created",
                    "user",
                    tenant.id,
                    str(user.id),
                    {"username": user.username},
                )
                return TenantAdminResponse(
                    id=user.id,
                    username=user.username,
                    full_name=user.full_name,
                    full_name_ar=user.full_name_ar,
                    is_active=user.is_active,
                    is_tenant_admin=user.is_tenant_admin,
                )

            if not user:
                raise ValueError("Tenant admin user not found")

            if "username" in updates:
                username = updates["username"].strip().lower()
                conflict = await tenant_db.execute(
                    select(User).where(
                        User.tenant_id == tenant_id,
                        User.username == username,
                        User.id != user.id,
                        User.deleted_at.is_(None),
                    )
                )
                if conflict.scalar_one_or_none():
                    raise ValueError("Username already taken in this laboratory")
                user.username = username

            if "password" in updates:
                user.password_hash = get_password_hash(updates["password"])

            if "full_name" in updates:
                user.full_name = updates["full_name"]
            if "full_name_ar" in updates:
                user.full_name_ar = updates["full_name_ar"]
            if "is_active" in updates:
                user.is_active = updates["is_active"]

            await tenant_db.commit()
            saved_id = user.id
            admin_response = TenantAdminResponse(
                id=user.id,
                username=user.username,
                full_name=user.full_name,
                full_name_ar=user.full_name_ar,
                is_active=user.is_active,
                is_tenant_admin=user.is_tenant_admin,
            )

        await self.log_action(
            admin_id,
            "tenant_admin_updated",
            "user",
            tenant.id,
            str(saved_id),
            {"username": admin_response.username},
        )
        return admin_response

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
        await TenantAccessService(self.db).revoke_tenant_sessions(tenant.id)
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
        await TenantAccessService(self.db).revoke_tenant_sessions(tenant.id)
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
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return None
        factory = await manager.get_tenant_session_factory(
            manager.resolve_tenant_database(tenant.code, tenant.database_name)
        )
        async with factory() as tenant_db:
            from app.services.tenant_limits_service import TenantLimitsService

            await TenantLimitsService(tenant_db, self.db).assert_plan_downgrade_allowed(
                tenant_id, data.plan_id
            )
        return await self.renew_subscription(
            tenant_id,
            SubscriptionRenewRequest(plan_id=data.plan_id, days=None, amount_paid=data.amount_paid, auto_renew=data.auto_renew),
            admin_id,
        )

    async def update_feature_flags(self, tenant_id: UUID, flags: list, admin_id: UUID) -> None:
        from app.core.modules import ALWAYS_ENABLED_MODULES

        updated_keys: list[str] = []
        for flag in flags:
            if flag.feature_key in ALWAYS_ENABLED_MODULES:
                continue
            result = await self.db.execute(
                select(TenantFeatureFlag).where(
                    TenantFeatureFlag.tenant_id == tenant_id,
                    TenantFeatureFlag.feature_key == flag.feature_key,
                )
            )
            existing = result.scalars().first()
            if existing:
                existing.is_enabled = flag.is_enabled
                existing.config = flag.config or {}
            else:
                self.db.add(
                    TenantFeatureFlag(
                        tenant_id=tenant_id,
                        feature_key=flag.feature_key,
                        is_enabled=flag.is_enabled,
                        config=flag.config or {},
                    )
                )
            updated_keys.append(flag.feature_key)
        await self.db.flush()
        await self.log_action(
            admin_id,
            "feature_flags_updated",
            "tenant",
            tenant_id,
            str(tenant_id),
            {"modules": updated_keys},
        )

    async def list_audit_logs(self, limit: int = 100) -> list[PlatformAuditLog]:
        result = await self.db.execute(
            select(PlatformAuditLog).order_by(PlatformAuditLog.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())
