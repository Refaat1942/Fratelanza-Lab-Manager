from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.orders import OrderStatus, ResultStatus


class LabOrderCreate(BaseModel):
    patient_id: UUID
    branch_id: Optional[UUID] = None
    test_ids: list[UUID] = Field(min_length=1)
    referring_doctor_id: Optional[UUID] = None
    notes: Optional[str] = None


class ResultListItem(BaseModel):
    id: UUID
    order_id: UUID
    order_number: str
    patient_id: UUID
    patient_name: str
    test_id: UUID
    test_name: str
    test_code: str
    status: ResultStatus
    ordered_at: datetime


class ResultValueInput(BaseModel):
    parameter_name: str
    value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None


class ResultEntryCreate(BaseModel):
    values: list[ResultValueInput] = Field(min_length=1)
    notes: Optional[str] = None


class LabOrderListItem(BaseModel):
    id: UUID
    order_number: str
    patient_id: UUID
    patient_name: str
    status: OrderStatus
    ordered_at: datetime
    test_count: int
