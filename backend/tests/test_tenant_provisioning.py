"""Tests for tenant registry sync during dedicated-DB migration."""

from uuid import uuid4

from app.models.platform import Tenant, TenantStatus


def test_apply_tenant_registry_fields_updates_code():
    from app.services.tenant_provisioning_service import TenantProvisioningService

    tenant_id = uuid4()
    row = Tenant(id=tenant_id, code="old", name="Old", email="a@b.c", status=TenantStatus.ACTIVE)
    source = Tenant(
        id=tenant_id,
        code="ahram-lab",
        name="Al ahram Lab",
        name_ar="معمل",
        email="lab@test.local",
        status=TenantStatus.ACTIVE,
        database_name="labmaster_tenant_ahram_lab",
    )
    TenantProvisioningService._apply_tenant_registry_fields(row, source)
    assert row.code == "ahram-lab"
    assert row.database_name == "labmaster_tenant_ahram_lab"
