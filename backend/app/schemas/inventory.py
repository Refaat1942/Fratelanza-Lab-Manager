from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.inventory import InventoryCategory


class InventoryItemCreate(BaseModel):
    branch_id: Optional[UUID] = None
    sku: str = Field(min_length=2, max_length=50)
    name: str
    name_ar: str
    category: InventoryCategory
    unit: str = "piece"
    reorder_level: float = Field(default=0, ge=0)
    unit_cost: float = Field(default=0, ge=0)
    description: Optional[str] = None


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    category: Optional[InventoryCategory] = None
    unit: Optional[str] = None
    reorder_level: Optional[float] = Field(None, ge=0)
    unit_cost: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None
    description: Optional[str] = None


class InventoryItemResponse(BaseModel):
    id: UUID
    sku: str
    name: str
    name_ar: str
    category: InventoryCategory
    unit: str
    reorder_level: float
    unit_cost: float
    is_active: bool
    branch_id: Optional[UUID] = None
    total_quantity: float = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class InventoryBatchResponse(BaseModel):
    id: UUID
    batch_number: str
    quantity: float
    expiry_date: Optional[date] = None
    unit_cost: float

    model_config = {"from_attributes": True}
