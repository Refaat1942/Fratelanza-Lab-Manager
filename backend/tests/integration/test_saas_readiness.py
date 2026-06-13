"""Integration tests for multi-tenant SaaS readiness (subscriptions, isolation, auth)."""

import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import sync_session_factory
from app.models.auth import User
from app.models.platform import (
    BillingCycle,
    PlanTier,
    SubscriptionPlan,
    SubscriptionStatus,
    Tenant,
    TenantStatus,
    TenantSubscription,
)
from app.models.patients import Patient
LIVE_API = "http://localhost:8000"


def test_lab_login_returns_token(sample_login: dict):
    with httpx.Client(base_url=LIVE_API, timeout=30) as client:
        response = client.post("/api/v1/auth/login", json=sample_login)
        assert response.status_code == 200
        data = response.json()
        assert data["access_token"]
        assert data["token_type"] == "bearer"


def test_expired_subscription_blocks_lab_login(sample_login: dict):
    with sync_session_factory() as db:
        tenant = db.execute(select(Tenant).where(Tenant.code == "demo-lab")).scalar_one()
        sub = db.execute(
            select(TenantSubscription)
            .where(TenantSubscription.tenant_id == tenant.id)
            .order_by(TenantSubscription.created_at.desc())
            .limit(1)
        ).scalar_one()
        original_expires = sub.expires_at
        original_grace = sub.grace_ends_at
        original_status = sub.status
        original_tenant_status = tenant.status

        past = datetime.now(timezone.utc) - timedelta(days=30)
        sub.expires_at = past
        sub.grace_ends_at = past - timedelta(days=1)
        sub.status = SubscriptionStatus.ACTIVE
        tenant.status = TenantStatus.ACTIVE
        db.commit()

    try:
        with httpx.Client(base_url=LIVE_API, timeout=30) as client:
            login = client.post("/api/v1/auth/login", json=sample_login)
            assert login.status_code in (403, 402), login.text
    finally:
        with sync_session_factory() as db:
            tenant = db.execute(select(Tenant).where(Tenant.code == "demo-lab")).scalar_one()
            sub = db.execute(
                select(TenantSubscription)
                .where(TenantSubscription.tenant_id == tenant.id)
                .order_by(TenantSubscription.created_at.desc())
                .limit(1)
            ).scalar_one()
            sub.expires_at = original_expires
            sub.grace_ends_at = original_grace
            sub.status = original_status
            tenant.status = original_tenant_status
            db.commit()


def test_tenant_isolation_patients_not_shared():
    suffix = uuid.uuid4().hex[:8]
    code_a = f"iso-a-{suffix}"
    code_b = f"iso-b-{suffix}"

    with sync_session_factory() as db:
        plan = SubscriptionPlan(
            name=f"Test {suffix}",
            name_ar=f"اختبار {suffix}",
            tier=PlanTier.STARTER,
            billing_cycle=BillingCycle.MONTHLY,
            price_egp=999,
            max_users=5,
            max_branches=1,
        )
        db.add(plan)
        db.flush()

        tenant_a = Tenant(code=code_a, name="Iso A", email=f"a-{suffix}@test.com", status=TenantStatus.ACTIVE)
        tenant_b = Tenant(code=code_b, name="Iso B", email=f"b-{suffix}@test.com", status=TenantStatus.ACTIVE)
        db.add_all([tenant_a, tenant_b])
        db.flush()

        now = datetime.now(timezone.utc)
        for tenant in (tenant_a, tenant_b):
            db.add(
                TenantSubscription(
                    tenant_id=tenant.id,
                    plan_id=plan.id,
                    status=SubscriptionStatus.ACTIVE,
                    expires_at=now + timedelta(days=30),
                    grace_ends_at=now + timedelta(days=37),
                    amount_paid=999,
                )
            )
            db.add(
                User(
                    tenant_id=tenant.id,
                    username="admin",
                    password_hash=get_password_hash("TestPass123"),
                    full_name="Admin",
                    is_tenant_admin=True,
                    is_active=True,
                )
            )
            db.add(
                Patient(
                    tenant_id=tenant.id,
                    patient_code="PISO001",
                    full_name="Secret Patient",
                    phone="201000000099",
                )
            )
        db.commit()
        tenant_a_id = str(tenant_a.id)
        tenant_b_id = str(tenant_b.id)

    with httpx.Client(base_url=LIVE_API, timeout=30) as client:
        login_a = client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "TestPass123", "tenant_code": code_a},
        )
        assert login_a.status_code == 200
        token_a = login_a.json()["access_token"]

        patients_a = client.get(
            "/api/v1/patients",
            headers={"Authorization": f"Bearer {token_a}", "X-Tenant-Id": tenant_a_id},
        )
        assert patients_a.status_code == 200
        items_a = patients_a.json().get("items", [])

        login_b = client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "TestPass123", "tenant_code": code_b},
        )
        assert login_b.status_code == 200
        token_b = login_b.json()["access_token"]

        patients_b = client.get(
            "/api/v1/patients",
            headers={"Authorization": f"Bearer {token_b}", "X-Tenant-Id": tenant_b_id},
        )
        assert patients_b.status_code == 200
        items_b = patients_b.json().get("items", [])

        assert len(items_a) == 1 and len(items_b) == 1
        assert items_a[0]["id"] != items_b[0]["id"]

        cross = client.get(
            f"/api/v1/patients/{items_a[0]['id']}",
            headers={"Authorization": f"Bearer {token_b}", "X-Tenant-Id": tenant_b_id},
        )
        assert cross.status_code == 404


def test_platform_login_and_list_tenants():
    with httpx.Client(base_url=LIVE_API, timeout=30) as client:
        response = client.post(
            "/api/v1/auth/platform/login",
            json={"username": "superadmin", "password": "Admin@123"},
        )
        assert response.status_code == 200
        token = response.json()["access_token"]

        tenants = client.get(
            "/api/v1/platform/tenants",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert tenants.status_code == 200
        assert isinstance(tenants.json(), list)
        assert any(t["code"] == "demo-lab" for t in tenants.json())


def test_subscription_grace_period_allows_access():
    suffix = uuid.uuid4().hex[:8]
    code = f"grace-{suffix}"

    with sync_session_factory() as db:
        plan = SubscriptionPlan(
            name=f"Grace {suffix}",
            name_ar="فترة",
            tier=PlanTier.STARTER,
            billing_cycle=BillingCycle.MONTHLY,
            price_egp=100,
            max_users=2,
            max_branches=1,
        )
        db.add(plan)
        db.flush()
        tenant = Tenant(code=code, name="Grace Lab", email=f"g-{suffix}@t.com", status=TenantStatus.ACTIVE)
        db.add(tenant)
        db.flush()
        now = datetime.now(timezone.utc)
        db.add(
            TenantSubscription(
                tenant_id=tenant.id,
                plan_id=plan.id,
                status=SubscriptionStatus.ACTIVE,
                expires_at=now - timedelta(days=1),
                grace_ends_at=now + timedelta(days=5),
                amount_paid=100,
            )
        )
        db.add(
            User(
                tenant_id=tenant.id,
                username="admin",
                password_hash=get_password_hash("TestPass123"),
                full_name="Admin",
                is_tenant_admin=True,
                is_active=True,
            )
        )
        db.commit()

    with httpx.Client(base_url=LIVE_API, timeout=30) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "TestPass123", "tenant_code": code},
        )
        assert login.status_code == 200
