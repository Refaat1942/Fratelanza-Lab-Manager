import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class ChartOfAccount(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "chart_of_accounts"

    code: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(255))
    name_ar: Mapped[Optional[str]] = mapped_column(String(255))
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType), index=True)
    parent_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class JournalEntry(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "journal_entries"

    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    entry_number: Mapped[str] = mapped_column(String(50), index=True)
    entry_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50))
    reference_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True))
    created_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    lines: Mapped[list["JournalEntryLine"]] = relationship(back_populates="journal_entry")


class JournalEntryLine(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "journal_entry_lines"

    journal_entry_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"), index=True
    )
    account_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"), index=True)
    debit: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    credit: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    description: Mapped[Optional[str]] = mapped_column(String(255))

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="lines")


class DailyClosing(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "daily_closings"

    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    closing_date: Mapped[date] = mapped_column(Date, index=True)
    total_revenue: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_expenses: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_cash: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_receivables: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    closed_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
