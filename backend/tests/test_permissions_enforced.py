"""Permission checks must actually run.

`user: CurrentUser = require_permission(...)` looks right but FastAPI ignores the default when
the annotation already carries a dependency, which silently disabled every check.
"""

import inspect
import re
from pathlib import Path

from fastapi.params import Depends

from app.api.deps import require_permission
from app.core.rbac import ALL_CODES, DEFAULT_ROLES

ENDPOINTS = Path(__file__).resolve().parents[1] / "app" / "api" / "v1" / "endpoints"


def test_require_permission_is_a_dependency():
    assert isinstance(require_permission("patients.read"), Depends)


def test_no_endpoint_pairs_current_user_with_require_permission():
    offenders = [
        f"{p.name}:{n}"
        for p in ENDPOINTS.glob("*.py")
        for n, line in enumerate(p.read_text().splitlines(), 1)
        if re.search(r"CurrentUser\s*=\s*require_permission", line)
    ]
    assert offenders == []


def test_every_required_code_exists_in_catalogue():
    used = {
        m.group(1)
        for p in ENDPOINTS.glob("*.py")
        for m in re.finditer(r'require_permission\("([a-z_.]+)"\)', p.read_text())
    }
    assert used <= ALL_CODES


def test_default_roles_only_use_known_codes():
    for _, _, codes in DEFAULT_ROLES:
        assert codes <= ALL_CODES


def test_protected_routes_declare_the_checker():
    from app.api.v1.endpoints import billing

    sig = inspect.signature(billing.list_invoices)
    assert isinstance(sig.parameters["user"].default, Depends)
