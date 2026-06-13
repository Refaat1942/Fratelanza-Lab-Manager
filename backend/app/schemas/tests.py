from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class TestCreate(BaseModel):
    category_id: Optional[UUID] = None
    name: str = Field(min_length=2, max_length=255)
    name_ar: Optional[str] = None
    description: Optional[str] = None
    price: float = Field(ge=0)
    cost: float = Field(ge=0, default=0)
    turnaround_hours: int = Field(default=24, ge=1)
    sample_type: Optional[str] = None
    requires_fasting: bool = False

    @model_validator(mode="after")
    def mirror_english_name_when_arabic_missing(self) -> "TestCreate":
        name = self.name.strip()
        self.name = name
        ar = (self.name_ar or "").strip()
        self.name_ar = ar if ar else name
        return self


class TestUpdate(BaseModel):
    category_id: Optional[UUID] = None
    name: Optional[str] = None
    name_ar: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    cost: Optional[float] = Field(None, ge=0)
    turnaround_hours: Optional[int] = Field(None, ge=1)
    sample_type: Optional[str] = None
    is_active: Optional[bool] = None
    requires_fasting: Optional[bool] = None


class TestResponse(BaseModel):
    id: UUID
    category_id: UUID
    code: str
    name: str
    name_ar: str
    price: float
    cost: float
    turnaround_hours: int
    sample_type: Optional[str] = None
    is_active: bool
    requires_fasting: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TestCategoryResponse(BaseModel):
    id: UUID
    code: str
    name: str
    name_ar: str
    is_active: bool

    model_config = {"from_attributes": True}


class ResultTemplateField(BaseModel):
    parameter_name: str
    parameter_name_ar: Optional[str] = None
    unit: Optional[str] = None
    field_type: str = "numeric"
    sort_order: int = 0
    options: Optional[dict] = None


class ResultTemplateUpdate(BaseModel):
    fields: list[ResultTemplateField]
