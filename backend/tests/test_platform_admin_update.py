import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.platform import TenantAdminUpdate
from app.services.platform_service import PlatformService


class _Scalars:
    def __init__(self, value):
        self._value = value

    def first(self):
        return self._value


class _Result:
    def __init__(self, value):
        self._value = value

    def scalars(self):
        return _Scalars(self._value)

    def scalar_one_or_none(self):
        return self._value


@pytest.mark.asyncio
async def test_update_tenant_admin_returns_response_not_detached_orm():
    tenant_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    user_id = uuid.uuid4()

    tenant = MagicMock()
    tenant.id = tenant_id
    tenant.code = "ahram-lab"
    tenant.database_name = "labmaster_tenant_ahram_lab"

    user = MagicMock()
    user.id = user_id
    user.username = "khaled"
    user.full_name = "khaled Shawky"
    user.full_name_ar = None
    user.is_active = True
    user.is_tenant_admin = True

    platform_db = AsyncMock()
    svc = PlatformService(platform_db)
    svc.get_tenant = AsyncMock(return_value=tenant)
    svc.get_tenant_admin = AsyncMock(return_value=user)
    svc.log_action = AsyncMock()

    tenant_db = AsyncMock()
    tenant_db.get = AsyncMock(return_value=user)
    tenant_db.commit = AsyncMock()
    tenant_db.execute = AsyncMock(return_value=_Result(None))

    factory = MagicMock()
    factory.return_value.__aenter__ = AsyncMock(return_value=tenant_db)
    factory.return_value.__aexit__ = AsyncMock(return_value=False)

    manager = MagicMock()
    manager.resolve_tenant_database = MagicMock(return_value="labmaster_tenant_ahram_lab")
    manager.get_tenant_session_factory = AsyncMock(return_value=factory)

    import app.services.platform_service as platform_module

    original_manager = platform_module.manager
    platform_module.manager = manager
    try:
        result = await svc.update_tenant_admin(
            tenant_id,
            TenantAdminUpdate(full_name="khaled Shawky", username="khaled"),
            admin_id,
        )
    finally:
        platform_module.manager = original_manager

    assert result is not None
    assert result.username == "khaled"
    assert result.full_name == "khaled Shawky"
    assert result.id == user_id
