"""Tests for tenant lifecycle (code reuse, filters)."""

import pytest

from app.models.platform import TenantStatus


@pytest.mark.parametrize(
    "lifecycle,deleted,status,matches",
    [
        ("active", False, TenantStatus.ACTIVE, True),
        ("active", False, TenantStatus.SUSPENDED, False),
        ("active", True, TenantStatus.DELETED, False),
        ("suspended", False, TenantStatus.SUSPENDED, True),
        ("deleted", True, TenantStatus.DELETED, True),
    ],
)
def test_lifecycle_filter_rules(lifecycle, deleted, status, matches):
    """Document expected filter semantics without DB."""
    is_deleted = deleted
    is_active = not is_deleted and status == TenantStatus.ACTIVE
    is_suspended = not is_deleted and status == TenantStatus.SUSPENDED
    is_deleted_bucket = is_deleted

    if lifecycle == "active":
        assert is_active == matches
    elif lifecycle == "suspended":
        assert is_suspended == matches
    else:
        assert is_deleted_bucket == matches
