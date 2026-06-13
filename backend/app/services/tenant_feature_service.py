from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.modules import (
    ALL_LAB_MODULES,
    ALWAYS_ENABLED_MODULES,
    ENTERPRISE_MODULES,
    MODULE_LABELS,
    PROFESSIONAL_MODULES,
    STARTER_MODULES,
)
from app.models.platform import PlanTier, SubscriptionPlan, TenantFeatureFlag, TenantSubscription


class TenantFeatureService:
    def __init__(self, platform_db: AsyncSession):
        self.platform_db = platform_db

    @staticmethod
    def modules_for_plan_tier(tier: PlanTier) -> list[str]:
        if tier == PlanTier.STARTER:
            return list(STARTER_MODULES)
        if tier == PlanTier.PROFESSIONAL:
            return list(PROFESSIONAL_MODULES)
        return list(ENTERPRISE_MODULES)

    async def get_flag_map(self, tenant_id: UUID) -> dict[str, bool]:
        result = await self.platform_db.execute(
            select(TenantFeatureFlag).where(TenantFeatureFlag.tenant_id == tenant_id)
        )
        return {row.feature_key: row.is_enabled for row in result.scalars().all()}

    async def get_module_states(self, tenant_id: UUID) -> dict[str, bool]:
        """Return enabled/disabled state for every lab module."""
        flags = await self.get_flag_map(tenant_id)
        if not flags:
            return {module: True for module in ALL_LAB_MODULES}

        states: dict[str, bool] = {}
        for module in ALL_LAB_MODULES:
            if module in ALWAYS_ENABLED_MODULES:
                states[module] = True
            elif module in flags:
                states[module] = flags[module]
            else:
                states[module] = True
        return states

    async def get_enabled_modules(self, tenant_id: UUID) -> list[str]:
        states = await self.get_module_states(tenant_id)
        return [module for module, enabled in states.items() if enabled]

    async def is_module_enabled(self, tenant_id: UUID, module_key: str) -> bool:
        if module_key in ALWAYS_ENABLED_MODULES:
            return True
        states = await self.get_module_states(tenant_id)
        return states.get(module_key, True)

    async def is_any_module_enabled(self, tenant_id: UUID, module_keys: list[str]) -> bool:
        for key in module_keys:
            if await self.is_module_enabled(tenant_id, key):
                return True
        return False

    async def seed_from_plan(self, tenant_id: UUID, plan: SubscriptionPlan) -> None:
        plan_modules = (plan.features or {}).get("modules")
        if not plan_modules:
            plan_modules = self.modules_for_plan_tier(plan.tier)

        enabled_set = set(plan_modules) | ALWAYS_ENABLED_MODULES
        for module in ALL_LAB_MODULES:
            if module in ALWAYS_ENABLED_MODULES:
                continue
            self.platform_db.add(
                TenantFeatureFlag(
                    tenant_id=tenant_id,
                    feature_key=module,
                    is_enabled=module in enabled_set,
                    config={},
                )
            )

    async def get_active_plan(self, tenant_id: UUID) -> SubscriptionPlan | None:
        result = await self.platform_db.execute(
            select(TenantSubscription)
            .where(TenantSubscription.tenant_id == tenant_id)
            .order_by(TenantSubscription.created_at.desc())
            .limit(1)
        )
        sub = result.scalar_one_or_none()
        if not sub:
            return None
        return await self.platform_db.get(SubscriptionPlan, sub.plan_id)

    @staticmethod
    def catalog() -> list[dict]:
        items = []
        for key in ALL_LAB_MODULES:
            label_en, label_ar = MODULE_LABELS.get(key, (key, key))
            items.append(
                {
                    "key": key,
                    "label_en": label_en,
                    "label_ar": label_ar,
                    "locked": key in ALWAYS_ENABLED_MODULES,
                }
            )
        return items
