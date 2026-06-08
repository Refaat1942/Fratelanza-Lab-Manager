import pytest

from app.core.config import Settings
from app.services.branding_service import ALLOWED_EXTENSIONS


def test_production_rejects_weak_secret_key():
    settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="change-me-in-production",
    )

    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        settings.validate_production_safety()


def test_production_rejects_debug_mode():
    settings = Settings(
        ENVIRONMENT="production",
        DEBUG=True,
        SECRET_KEY="x" * 32,
    )

    with pytest.raises(RuntimeError, match="DEBUG"):
        settings.validate_production_safety()


def test_svg_logos_are_not_uploadable():
    assert ".svg" not in ALLOWED_EXTENSIONS
