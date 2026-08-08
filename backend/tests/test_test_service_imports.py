"""Ensure test service SQLAlchemy helpers are imported (regression for 500 on /tests)."""

import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.schemas.common import PaginationParams
from app.services.test_service import TestService


@pytest.mark.asyncio
async def test_list_tests_does_not_raise_name_error():
    """list_tests must not crash with NameError: select is not defined."""
    db = AsyncMock()
    count_result = MagicMock()
    count_result.scalar.return_value = 0
    list_result = MagicMock()
    list_result.scalars.return_value.all.return_value = []

    async def execute_side_effect(query):
        query_str = str(query)
        if "count" in query_str.lower():
            return count_result
        return list_result

    db.execute = AsyncMock(side_effect=execute_side_effect)

    result = await TestService(db).list_tests(uuid4(), PaginationParams())
    assert result.total == 0
    assert result.items == []
