from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ExpenseCreate(BaseModel):
    branch_id: Optional[UUID] = None
    description: str = Field(min_length=2, max_length=500)
    amount: float = Field(gt=0)
    expense_date: Optional[datetime] = None
    payment_method: Optional[str] = None
    vendor: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    category_name: Optional[str] = None


class ExpenseUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    expense_date: Optional[datetime] = None
    payment_method: Optional[str] = None
    vendor: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: UUID
    expense_number: str
    description: str
    amount: float
    expense_date: datetime
    payment_method: Optional[str] = None
    vendor: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
