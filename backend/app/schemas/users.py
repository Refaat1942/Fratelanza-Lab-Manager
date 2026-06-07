from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class TenantUserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=8)
    full_name: str
    full_name_ar: Optional[str] = None
    phone: Optional[str] = None
    is_tenant_admin: bool = False
    role_ids: list[UUID] = []


class TenantUserResponse(BaseModel):
    id: UUID
    username: str
    email: Optional[str] = None
    full_name: str
    full_name_ar: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    is_tenant_admin: bool
    roles: list[str] = []
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
