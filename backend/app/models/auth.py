from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(100), index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    full_name_ar: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_tenant_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    default_branch_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"))
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    locale: Mapped[str] = mapped_column(String(5), default="ar")

    roles: Mapped[list["UserRole"]] = relationship(back_populates="user")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")

    __table_args__ = (UniqueConstraint("tenant_id", "username", name="uq_users_tenant_username"),)


class Role(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100))
    name_ar: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    permissions: Mapped[list["RolePermission"]] = relationship(back_populates="role")
    users: Mapped[list["UserRole"]] = relationship(back_populates="role")

    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_roles_tenant_name"),)


class Permission(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    module: Mapped[str] = mapped_column(String(50), index=True)
    action: Mapped[str] = mapped_column(String(50))
    description: Mapped[Optional[str]] = mapped_column(Text)
    description_ar: Mapped[Optional[str]] = mapped_column(Text)


class RolePermission(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "role_permissions"

    role_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), index=True)
    permission_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), index=True
    )

    role: Mapped["Role"] = relationship(back_populates="permissions")
    permission: Mapped["Permission"] = relationship()

    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)


class UserRole(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "user_roles"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), index=True)

    user: Mapped["User"] = relationship(back_populates="roles")
    role: Mapped["Role"] = relationship(back_populates="users")

    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)


class RefreshToken(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
