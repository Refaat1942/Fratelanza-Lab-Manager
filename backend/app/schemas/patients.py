from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.patients import Gender, VisitStatus


class PatientCreate(BaseModel):
    branch_id: Optional[UUID] = None
    national_id: Optional[str] = Field(None, max_length=20)
    full_name: str = Field(min_length=2, max_length=255)
    full_name_ar: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    phone_secondary: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    governorate: Optional[str] = None
    blood_type: Optional[str] = None
    notes: Optional[str] = None


class PatientUpdate(BaseModel):
    national_id: Optional[str] = None
    full_name: Optional[str] = None
    full_name_ar: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    phone_secondary: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    governorate: Optional[str] = None
    blood_type: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[UUID] = None


class PatientResponse(BaseModel):
    id: UUID
    patient_code: str
    national_id: Optional[str] = None
    full_name: str
    full_name_ar: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    governorate: Optional[str] = None
    blood_type: Optional[str] = None
    branch_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PatientVisitCreate(BaseModel):
    patient_id: UUID
    branch_id: UUID
    referring_doctor_id: Optional[UUID] = None
    notes: Optional[str] = None


class PatientVisitResponse(BaseModel):
    id: UUID
    patient_id: UUID
    branch_id: UUID
    visit_number: str
    visit_date: datetime
    status: VisitStatus
    referring_doctor_id: Optional[UUID] = None

    model_config = {"from_attributes": True}
