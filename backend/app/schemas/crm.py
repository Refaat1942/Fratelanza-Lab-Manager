from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.crm import ContactType


class CrmContactCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    organization: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_type: ContactType = ContactType.LEAD
    source: Optional[str] = None
    notes: Optional[str] = None


class CrmContactUpdate(BaseModel):
    full_name: Optional[str] = None
    organization: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_type: Optional[ContactType] = None
    source: Optional[str] = None
    notes: Optional[str] = None


class CrmContactResponse(BaseModel):
    id: UUID
    full_name: str
    organization: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_type: ContactType
    source: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MarketingCampaignCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    channel: Optional[str] = None
    budget: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None


class MarketingCampaignResponse(BaseModel):
    id: UUID
    name: str
    name_ar: Optional[str] = None
    channel: Optional[str] = None
    status: str
    budget: Optional[float] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
