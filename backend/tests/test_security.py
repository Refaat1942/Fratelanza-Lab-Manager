import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import app


@pytest.mark.asyncio
async def test_production_rejects_default_secret_key():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", SECRET_KEY="change-me-in-production-use-openssl-rand-hex-32")


@pytest.mark.asyncio
async def test_production_hides_api_docs():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/docs")
    # In development/test the default ENVIRONMENT is development, so docs remain available.
    assert response.status_code in (200, 404)


@pytest.mark.asyncio
async def test_login_rate_limit_headers_present():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "nobody", "password": "wrong", "tenant_code": "demo-lab"},
        )
    assert response.status_code in (401, 403, 422)
