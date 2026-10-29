"""Subscription cut-off, demo access links and rate-limit client IP."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.api.v1.endpoints.platform import _access_state
from app.core.rate_limit import client_ip
from app.core.security import create_demo_access_token, verify_token
from app.models.platform import SubscriptionStatus, Tenant, TenantStatus, TenantSubscription

NOW = datetime.now(timezone.utc)


def _sub(expires_in_days: float, grace_days: float = 7, status=SubscriptionStatus.ACTIVE):
    expires = NOW + timedelta(days=expires_in_days)
    return TenantSubscription(
        tenant_id=uuid4(), plan_id=uuid4(), status=status,
        expires_at=expires, grace_ends_at=expires + timedelta(days=grace_days),
    )


def _tenant(status=TenantStatus.ACTIVE):
    return Tenant(id=uuid4(), code="lab", name="Lab", email="a@b.c", status=status)


def test_active_subscription_reports_days_left():
    state, days = _access_state(_tenant(), _sub(29.5))
    assert state == "active" and days == 30


def test_paid_plan_keeps_access_during_grace():
    assert _access_state(_tenant(), _sub(-2))[0] == "grace"


def test_paid_plan_cut_off_after_grace():
    assert _access_state(_tenant(), _sub(-10)) == ("expired", 0)


def test_demo_has_no_grace_period():
    assert _access_state(_tenant(TenantStatus.TRIAL), _sub(-1))[0] == "expired"


def test_suspended_and_cancelled_states():
    assert _access_state(_tenant(TenantStatus.SUSPENDED), _sub(10))[0] == "suspended"
    assert _access_state(_tenant(), _sub(10, status=SubscriptionStatus.CANCELLED))[0] == "expired"


def test_demo_access_token_round_trip_and_type():
    tenant_id = uuid4()
    token = create_demo_access_token(tenant_id, NOW + timedelta(days=3))
    payload = verify_token(token, token_type="demo_access")
    assert payload and payload["sub"] == str(tenant_id)
    # A demo link must never work as an API access token.
    assert verify_token(token, token_type="access") is None


def test_expired_demo_access_token_rejected():
    token = create_demo_access_token(uuid4(), NOW - timedelta(minutes=1))
    assert verify_token(token, token_type="demo_access") is None


def test_client_ip_prefers_proxy_header():
    req = SimpleNamespace(headers={"x-real-ip": "41.33.1.2"}, client=SimpleNamespace(host="127.0.0.1"))
    assert client_ip(req) == "41.33.1.2"
    req = SimpleNamespace(headers={}, client=SimpleNamespace(host="10.0.0.5"))
    assert client_ip(req) == "10.0.0.5"


def test_demo_access_key_is_short_safe_and_verifiable():
    from app.core.security import create_demo_access_key, verify_demo_access_key

    tenant_id = uuid4()
    key = create_demo_access_key(tenant_id)
    # Only hex digits and dashes: survives WhatsApp/SMS formatting.
    assert set(key) <= set("0123456789abcdef-")
    assert verify_demo_access_key(key) == tenant_id
    assert verify_demo_access_key(key[:-1] + ("0" if key[-1] != "0" else "1")) is None
    assert verify_demo_access_key(f"{uuid4()}-{key.rsplit('-', 1)[1]}") is None
    assert verify_demo_access_key("not-a-key") is None


def test_tokens_issued_in_same_second_are_unique():
    from app.core.security import create_access_token, create_refresh_token

    subject = str(uuid4())
    assert create_refresh_token(subject) != create_refresh_token(subject)
    assert create_access_token(subject) != create_access_token(subject)
