from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class BranchCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=2, max_length=255)
    name_ar: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    governorate: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_headquarters: bool = False


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    governorate: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_headquarters: Optional[bool] = None
    is_active: Optional[bool] = None


class BranchResponse(BaseModel):
    id: UUID
    code: str
    name: str
    name_ar: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    governorate: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_headquarters: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
