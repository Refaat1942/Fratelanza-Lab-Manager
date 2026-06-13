from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.billing import InvoiceStatus, PaymentMethod


class InvoiceItemCreate(BaseModel):
    description: str
    unit_price: float = Field(ge=0)
    quantity: float = Field(default=1, ge=0)
    test_id: Optional[UUID] = None


class InvoiceCreate(BaseModel):
    patient_id: UUID
    branch_id: Optional[UUID] = None
    visit_id: Optional[UUID] = None
    order_id: Optional[UUID] = None
    items: list[InvoiceItemCreate] = Field(min_length=1)
    discount: float = Field(default=0, ge=0)
    notes: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    method: PaymentMethod = PaymentMethod.CASH
    reference: Optional[str] = None
    notes: Optional[str] = None


class InvoiceListItem(BaseModel):
    id: UUID
    invoice_number: str
    patient_id: UUID
    patient_name: str
    status: InvoiceStatus
    subtotal: float
    discount: float
    total: float
    paid_amount: float
    balance: float
    issued_at: Optional[datetime] = None
    created_at: datetime


class InvoiceResponse(BaseModel):
    id: UUID
    invoice_number: str
    patient_id: UUID
    patient_name: str
    status: InvoiceStatus
    subtotal: float
    discount: float
    tax: float
    total: float
    paid_amount: float
    issued_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
