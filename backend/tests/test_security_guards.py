import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from app.core.config import DEFAULT_SECRET_KEY, Settings
from app.services.audit_service import REDACTED_AUDIT_VALUE, redact_sensitive_values


def test_production_rejects_default_secret_key():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", DEBUG=False, SECRET_KEY=DEFAULT_SECRET_KEY)


def test_production_requires_debug_disabled():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", DEBUG=True, SECRET_KEY="a" * 64)


def test_audit_redacts_patient_identifiers_and_tokens():
    values = {
        "full_name": "Test Patient",
        "national_id": "12345678901234",
        "phone": "+201000000000",
        "gender": "male",
        "nested": {"token": "secret-token", "status": "active"},
    }

    redacted = redact_sensitive_values(values)

    assert redacted["full_name"] == REDACTED_AUDIT_VALUE
    assert redacted["national_id"] == REDACTED_AUDIT_VALUE
    assert redacted["phone"] == REDACTED_AUDIT_VALUE
    assert redacted["gender"] == "male"
    assert redacted["nested"]["token"] == REDACTED_AUDIT_VALUE
    assert redacted["nested"]["status"] == "active"


@pytest.mark.asyncio
async def test_security_headers_are_set(client: AsyncClient):
    response = await client.get("/health")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
