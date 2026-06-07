import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Patient(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "patients"

    branch_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    patient_code: Mapped[str] = mapped_column(String(50), index=True)
    national_id: Mapped[Optional[str]] = mapped_column(String(20), index=True)
    full_name: Mapped[str] = mapped_column(String(255), index=True)
    full_name_ar: Mapped[Optional[str]] = mapped_column(String(255))
    gender: Mapped[Optional[Gender]] = mapped_column(Enum(Gender))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    phone: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    phone_secondary: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    governorate: Mapped[Optional[str]] = mapped_column(String(100))
    blood_type: Mapped[Optional[str]] = mapped_column(String(10))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    visits: Mapped[list["PatientVisit"]] = relationship(back_populates="patient")

    __table_args__ = (UniqueConstraint("tenant_id", "patient_code", name="uq_patients_tenant_code"),)


class VisitStatus(str, enum.Enum):
    REGISTERED = "registered"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PatientVisit(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "patient_visits"

    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    visit_number: Mapped[str] = mapped_column(String(50), index=True)
    visit_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[VisitStatus] = mapped_column(Enum(VisitStatus), default=VisitStatus.REGISTERED)
    referring_doctor_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    patient: Mapped["Patient"] = relationship(back_populates="visits")
