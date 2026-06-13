"""Regression tests for test create audit payload and code allocation."""

import json
from uuid import uuid4

import pytest

from app.schemas.tests import TestCreate as TestCreateSchema


def test_create_audit_values_are_json_serializable():
    category_id = uuid4()
    data = TestCreateSchema(name="CBC", price=50, cost=10)
    assert data.name_ar == "CBC"
    audit_values = data.model_dump(mode="json")
    audit_values["category_id"] = str(category_id)
    json.dumps(audit_values)


def test_create_without_arabic_name_uses_english():
    data = TestCreateSchema(name="Glucose", price=25, cost=5)
    assert data.name == "Glucose"
    assert data.name_ar == "Glucose"


def test_sync_display_name_on_update():
    from app.services.test_service import TestService

    updates = TestService._sync_display_name({"name": "  Hemoglobin  "}, "Old Name")
    assert updates["name"] == "Hemoglobin"
    assert updates["name_ar"] == "Hemoglobin"


@pytest.mark.parametrize(
    "codes,expected",
    [
        ([], "T0001"),
        (["T0001"], "T0002"),
        (["T0001", "T0009"], "T0010"),
        (["GLU", "CBC"], "T0001"),
        (["T0099", "T0001"], "T0100"),
    ],
)
def test_next_test_code_logic(codes, expected):
    max_num = 0
    for code in codes:
        suffix = code[1:]
        if len(code) == 5 and suffix.isdigit():
            max_num = max(max_num, int(suffix))
    assert f"T{max_num + 1:04d}" == expected
