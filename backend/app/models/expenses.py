from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ExpenseCategory(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "expense_categories"

    name: Mapped[str] = mapped_column(String(150))
    name_ar: Mapped[Optional[str]] = mapped_column(String(150))
    description: Mapped[Optional[str]] = mapped_column(Text)


class Expense(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "expenses"

    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    category_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("expense_categories.id"))
    expense_number: Mapped[str] = mapped_column(String(50), index=True)
    description: Mapped[str] = mapped_column(String(500))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    expense_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50))
    vendor: Mapped[Optional[str]] = mapped_column(String(255))
    reference: Mapped[Optional[str]] = mapped_column(String(100))
    created_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
