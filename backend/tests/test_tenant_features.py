import uuid

import pytest

from app.core.modules import ALL_LAB_MODULES, ALWAYS_ENABLED_MODULES
from app.models.platform import PlanTier, SubscriptionPlan, TenantFeatureFlag
from app.services.tenant_feature_service import TenantFeatureService


class FakeScalars:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return FakeScalars(self._rows)


class FakeSession:
    def __init__(self, flags: list[TenantFeatureFlag]):
        self.flags = flags

    async def execute(self, query):
        return FakeResult(self.flags)

    async def get(self, model, pk):
        return None


@pytest.mark.asyncio
async def test_no_flags_enables_all_modules():
    tenant_id = uuid.uuid4()
    svc = TenantFeatureService(FakeSession([]))
    enabled = await svc.get_enabled_modules(tenant_id)
    assert set(enabled) == set(ALL_LAB_MODULES)


@pytest.mark.asyncio
async def test_explicit_flags_control_visibility():
    tenant_id = uuid.uuid4()
    flags = [
        TenantFeatureFlag(tenant_id=tenant_id, feature_key="crm", is_enabled=False, config={}),
        TenantFeatureFlag(tenant_id=tenant_id, feature_key="marketing", is_enabled=False, config={}),
    ]
    svc = TenantFeatureService(FakeSession(flags))
    states = await svc.get_module_states(tenant_id)
    assert states["crm"] is False
    assert states["patients"] is True
    for key in ALWAYS_ENABLED_MODULES:
        assert states[key] is True


def test_modules_for_plan_tier():
    assert "inventory" in TenantFeatureService.modules_for_plan_tier(PlanTier.PROFESSIONAL)
    assert "crm" not in TenantFeatureService.modules_for_plan_tier(PlanTier.STARTER)
    assert "crm" in TenantFeatureService.modules_for_plan_tier(PlanTier.ENTERPRISE)
