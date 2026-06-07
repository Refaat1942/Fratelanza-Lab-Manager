from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6)
    tenant_code: Optional[str] = None


class PlatformLoginRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    email: Optional[EmailStr] = None
    password: str = Field(min_length=8)
    full_name: str
    full_name_ar: Optional[str] = None
    phone: Optional[str] = None
    is_tenant_admin: bool = False
    role_ids: list[UUID] = []
    default_branch_id: Optional[UUID] = None
    locale: str = "ar"


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    full_name_ar: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    is_tenant_admin: Optional[bool] = None
    role_ids: Optional[list[UUID]] = None
    default_branch_id: Optional[UUID] = None
    locale: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: Optional[str] = None
    full_name: str
    full_name_ar: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    is_tenant_admin: bool
    tenant_id: Optional[UUID] = None
    default_branch_id: Optional[UUID] = None
    locale: str
    last_login_at: Optional[datetime] = None
    roles: list[str] = []
    permissions: list[str] = []

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    permission_ids: list[UUID] = []


class RoleResponse(BaseModel):
    id: UUID
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    is_system: bool

    model_config = {"from_attributes": True}
