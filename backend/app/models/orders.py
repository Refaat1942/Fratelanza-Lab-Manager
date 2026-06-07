import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    COLLECTED = "collected"
    IN_LAB = "in_lab"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DELIVERED = "delivered"


class ResultStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    VERIFIED = "verified"
    RELEASED = "released"
    AMENDED = "amended"


class LabOrder(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "lab_orders"

    visit_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("patient_visits.id"), index=True)
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    order_number: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.PENDING, index=True)
    ordered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    collected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    referring_doctor_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    items: Mapped[list["LabOrderItem"]] = relationship(back_populates="order")
    results: Mapped[list["LabResult"]] = relationship(back_populates="order")


class LabOrderItem(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "lab_order_items"

    order_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_orders.id", ondelete="CASCADE"), index=True)
    test_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("tests.id"), index=True)
    price: Mapped[float] = mapped_column(Numeric(12, 2))
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.PENDING)

    order: Mapped["LabOrder"] = relationship(back_populates="items")


class LabResult(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "lab_results"

    order_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_orders.id"), index=True)
    order_item_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_order_items.id"), index=True)
    test_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("tests.id"), index=True)
    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    status: Mapped[ResultStatus] = mapped_column(Enum(ResultStatus), default=ResultStatus.PENDING, index=True)
    verified_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    released_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    order: Mapped["LabOrder"] = relationship(back_populates="results")
    values: Mapped[list["LabResultValue"]] = relationship(back_populates="result")


class LabResultValue(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "lab_result_values"

    result_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_results.id", ondelete="CASCADE"), index=True)
    parameter_name: Mapped[str] = mapped_column(String(150))
    value: Mapped[Optional[str]] = mapped_column(String(500))
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    reference_range: Mapped[Optional[str]] = mapped_column(String(255))
    is_abnormal: Mapped[bool] = mapped_column(default=False)
    is_critical: Mapped[bool] = mapped_column(default=False)

    result: Mapped["LabResult"] = relationship(back_populates="values")
