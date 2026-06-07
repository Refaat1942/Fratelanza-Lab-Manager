from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User
from app.models.platform import SubscriptionPlan, Tenant, TenantSubscription
from app.models.tenant_config import Branch


@dataclass
class TenantLimits:
    max_users: int
    max_branches: int
    current_users: int
    current_branches: int
    plan_max_users: int | None
    plan_max_branches: int | None
    max_users_override: int | None
    max_branches_override: int | None


class TenantLimitsService:
    DEFAULT_MAX_USERS = 5
    DEFAULT_MAX_BRANCHES = 1

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_limits(self, tenant_id: UUID) -> TenantLimits:
        tenant = await self.db.get(Tenant, tenant_id)
        if not tenant:
            raise ValueError("Tenant not found")

        plan_limits = await self._get_plan_limits(tenant_id)
        plan_max_users = plan_limits[0] if plan_limits else None
        plan_max_branches = plan_limits[1] if plan_limits else None

        max_users = tenant.max_users_override or plan_max_users or self.DEFAULT_MAX_USERS
        max_branches = tenant.max_branches_override or plan_max_branches or self.DEFAULT_MAX_BRANCHES

        current_users = await self.db.scalar(
            select(func.count()).where(User.tenant_id == tenant_id, User.deleted_at.is_(None))
        ) or 0
        current_branches = await self.db.scalar(
            select(func.count()).where(Branch.tenant_id == tenant_id, Branch.deleted_at.is_(None))
        ) or 0

        return TenantLimits(
            max_users=max_users,
            max_branches=max_branches,
            current_users=current_users,
            current_branches=current_branches,
            plan_max_users=plan_max_users,
            plan_max_branches=plan_max_branches,
            max_users_override=tenant.max_users_override,
            max_branches_override=tenant.max_branches_override,
        )

    async def assert_can_add_user(self, tenant_id: UUID) -> None:
        limits = await self.get_limits(tenant_id)
        if limits.current_users >= limits.max_users:
            raise ValueError(
                f"User limit reached ({limits.current_users}/{limits.max_users}). "
                "Contact platform admin to increase your plan."
            )

    async def assert_can_add_branch(self, tenant_id: UUID) -> None:
        limits = await self.get_limits(tenant_id)
        if limits.current_branches >= limits.max_branches:
            raise ValueError(
                f"Branch limit reached ({limits.current_branches}/{limits.max_branches}). "
                "Contact platform admin to increase your plan."
            )

    async def assert_plan_downgrade_allowed(self, tenant_id: UUID, plan_id: UUID) -> None:
        plan = await self.db.get(SubscriptionPlan, plan_id)
        if not plan:
            raise ValueError("Plan not found")

        tenant = await self.db.get(Tenant, tenant_id)
        limits = await self.get_limits(tenant_id)
        effective_max_users = tenant.max_users_override or plan.max_users
        effective_max_branches = tenant.max_branches_override or plan.max_branches

        if limits.current_users > effective_max_users:
            raise ValueError(
                f"Cannot change plan: laboratory has {limits.current_users} users "
                f"but the new plan allows only {effective_max_users}"
            )
        if limits.current_branches > effective_max_branches:
            raise ValueError(
                f"Cannot change plan: laboratory has {limits.current_branches} branches "
                f"but the new plan allows only {effective_max_branches}"
            )

    async def _get_plan_limits(self, tenant_id: UUID) -> tuple[int, int] | None:
        result = await self.db.execute(
            select(SubscriptionPlan.max_users, SubscriptionPlan.max_branches)
            .join(TenantSubscription, TenantSubscription.plan_id == SubscriptionPlan.id)
            .where(TenantSubscription.tenant_id == tenant_id)
            .order_by(TenantSubscription.created_at.desc())
            .limit(1)
        )
        row = result.first()
        if not row:
            return None
        return int(row[0]), int(row[1])
