from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ReferralCreate(BaseModel):
    doctor_id: UUID
    patient_id: UUID
    branch_id: Optional[UUID] = None
    notes: Optional[str] = None


class ReferralResponse(BaseModel):
    id: UUID
    doctor_id: UUID
    doctor_name: str
    patient_id: UUID
    patient_name: str
    referral_date: datetime
    notes: Optional[str] = None

    model_config = {"from_attributes": True}
