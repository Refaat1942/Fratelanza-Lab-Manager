from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError
from fastapi import HTTPException

from app.api.deps import get_current_tenant
from app.core.config import DEFAULT_SECRET_KEY, Settings
from app.main import create_app
from app.services.branding_service import detect_image_extension


def test_production_requires_non_default_secret_key():
    with pytest.raises(ValidationError):
        Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SECRET_KEY=DEFAULT_SECRET_KEY,
        )


def test_production_defaults_disable_docs_and_bootstrap():
    settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="a" * 64,
    )

    assert settings.ENABLE_API_DOCS is False
    assert settings.BOOTSTRAP_ADMIN_ACCOUNTS is False
    assert settings.SEED_DEMO_DATA is False


def test_create_app_hides_docs_in_production():
    settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="b" * 64,
    )

    app = create_app(settings)

    assert app.docs_url is None
    assert app.redoc_url is None
    assert app.openapi_url is None


def test_detect_image_extension_accepts_real_png_and_rejects_invalid_bytes():
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"test-image-data"

    assert detect_image_extension(png_bytes) == ".png"
    assert detect_image_extension(b"not-an-image") is None


@pytest.mark.asyncio
async def test_get_current_tenant_rejects_mismatched_header():
    user = SimpleNamespace(tenant_id=uuid4())

    with pytest.raises(HTTPException) as exc_info:
        await get_current_tenant(
            db=None,
            user=user,
            x_tenant_id=str(uuid4()),
        )

    assert exc_info.value.status_code == 403
