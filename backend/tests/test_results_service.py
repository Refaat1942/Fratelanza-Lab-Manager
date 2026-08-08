"""Unit tests for results order validation and collection workflow."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.models.orders import OrderStatus
from app.schemas.results import LabOrderCreate
from app.services.results_service import ResultsService


def _scalar_result(value):
    result = MagicMock()
    result.scalar.return_value = value
    result.scalar_one_or_none.return_value = value
    return result


@pytest.mark.asyncio
async def test_create_order_rejects_invalid_test_id():
    tenant_id = uuid4()
    patient_id = uuid4()
    bad_test_id = uuid4()

    patient = MagicMock()
    patient.id = patient_id
    patient.tenant_id = tenant_id
    patient.branch_id = uuid4()

    db = AsyncMock()
    db.get = AsyncMock(side_effect=lambda model, pk: patient if pk == patient_id else None)
    db.execute = AsyncMock(side_effect=[_scalar_result(0), _scalar_result(0)])
    db.add = MagicMock()
    db.flush = AsyncMock()

    service = ResultsService(db)
    data = LabOrderCreate(patient_id=patient_id, test_ids=[bad_test_id])

    with pytest.raises(ValueError, match="Test not found"):
        await service.create_order(tenant_id, data, uuid4())


@pytest.mark.asyncio
async def test_collect_order_sets_collected_status():
    tenant_id = uuid4()
    order_id = uuid4()

    order = MagicMock()
    order.id = order_id
    order.tenant_id = tenant_id
    order.deleted_at = None
    order.status = OrderStatus.PENDING
    order.collected_at = None

    result = MagicMock()
    result.scalar_one_or_none.return_value = order

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    db.flush = AsyncMock()

    updated = await ResultsService(db).collect_order(tenant_id, order_id)

    assert updated.status == OrderStatus.COLLECTED
    assert updated.collected_at is not None
    assert updated.collected_at.tzinfo == timezone.utc


@pytest.mark.asyncio
async def test_collect_order_is_idempotent_when_already_collected():
    tenant_id = uuid4()
    order_id = uuid4()
    collected_at = datetime(2026, 6, 1, tzinfo=timezone.utc)

    order = MagicMock()
    order.id = order_id
    order.tenant_id = tenant_id
    order.deleted_at = None
    order.status = OrderStatus.COLLECTED
    order.collected_at = collected_at

    result = MagicMock()
    result.scalar_one_or_none.return_value = order

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    updated = await ResultsService(db).collect_order(tenant_id, order_id)

    assert updated.status == OrderStatus.COLLECTED
    assert updated.collected_at == collected_at
    db.flush.assert_not_called()


@pytest.mark.asyncio
async def test_delete_order_soft_deletes_results():
    tenant_id = uuid4()
    order_id = uuid4()

    order = MagicMock()
    order.id = order_id
    order.tenant_id = tenant_id
    order.deleted_at = None

    r1 = MagicMock()
    r1.deleted_at = None
    r2 = MagicMock()
    r2.deleted_at = None

    order_result = MagicMock()
    order_result.scalar_one_or_none.return_value = order
    results_result = MagicMock()
    results_result.scalars.return_value = iter([r1, r2])

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[order_result, results_result])
    db.flush = AsyncMock()

    count = await ResultsService(db).delete_order(tenant_id, order_id)

    assert count == 2
    assert order.status == OrderStatus.CANCELLED
    assert order.deleted_at is not None
    assert r1.deleted_at is not None
    assert r2.deleted_at is not None
