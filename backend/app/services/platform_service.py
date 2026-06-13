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
from app.core.security import get_password_hash
from app.models.auth import User
from app.models.tenant_config import Branch, TenantBranding
from app.schemas.auth import UserCreate
from app.schemas.platform import (
    SubscriptionRenewRequest,
    TenantAdminUpdate,
    TenantChangePlanRequest,
    TenantCreate,
    TenantUpdate,
)
from app.db.manager import get_database_manager, tenant_database_name
from app.services.auth_service import AuthService
from app.services.tenant_access_service import BLOCKED_STATUSES, TenantAccessService
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
    ) -> Optional[User]:
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
                return user

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
            saved_username = user.username

        async with factory() as tenant_db:
            user = await tenant_db.get(User, saved_id)
            if not user:
                raise ValueError("Tenant admin user not found after save")

        await self.log_action(
            admin_id,
            "tenant_admin_updated",
            "user",
            tenant.id,
            str(saved_id),
            {"username": saved_username},
        )
        return user

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
