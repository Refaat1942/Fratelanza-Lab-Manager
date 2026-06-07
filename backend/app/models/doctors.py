from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Doctor(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "doctors"

    code: Mapped[str] = mapped_column(String(50), index=True)
    full_name: Mapped[str] = mapped_column(String(255), index=True)
    full_name_ar: Mapped[Optional[str]] = mapped_column(String(255))
    specialty: Mapped[Optional[str]] = mapped_column(String(150))
    specialty_ar: Mapped[Optional[str]] = mapped_column(String(150))
    phone: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    clinic_name: Mapped[Optional[str]] = mapped_column(String(255))
    clinic_address: Mapped[Optional[str]] = mapped_column(Text)
    commission_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    referrals: Mapped[list["Referral"]] = relationship(back_populates="doctor")
    commissions: Mapped[list["DoctorCommission"]] = relationship(back_populates="doctor")

    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_doctors_tenant_code"),)


class Referral(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "referrals"

    doctor_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"), index=True)
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    visit_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("patient_visits.id"))
    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    referral_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    doctor: Mapped["Doctor"] = relationship(back_populates="referrals")


class DoctorCommission(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "doctor_commissions"

    doctor_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"), index=True)
    invoice_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"))
    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    commission_rate: Mapped[float] = mapped_column(Numeric(5, 2))
    period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    doctor: Mapped["Doctor"] = relationship(back_populates="commissions")
