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


class TenantUserUpdate(BaseModel):
    full_name: Optional[str] = None
    full_name_ar: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    role_ids: Optional[list[UUID]] = None


class RoleResponse(BaseModel):
    id: UUID
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    is_system: bool
    permissions: list[str] = []


class PermissionResponse(BaseModel):
    code: str
    module: str
    action: str
    description: Optional[str] = None
    description_ar: Optional[str] = None


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
