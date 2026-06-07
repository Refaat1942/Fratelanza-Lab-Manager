from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DoctorCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    full_name_ar: Optional[str] = None
    specialty: Optional[str] = None
    specialty_ar: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    commission_rate: float = Field(default=0, ge=0, le=100)
    notes: Optional[str] = None


class DoctorUpdate(BaseModel):
    full_name: Optional[str] = None
    full_name_ar: Optional[str] = None
    specialty: Optional[str] = None
    specialty_ar: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    commission_rate: Optional[float] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class DoctorResponse(BaseModel):
    id: UUID
    code: str
    full_name: str
    full_name_ar: Optional[str] = None
    specialty: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    clinic_name: Optional[str] = None
    commission_rate: float
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
