from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class TestCategory(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "test_categories"

    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(255))
    name_ar: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tests: Mapped[list["Test"]] = relationship(back_populates="category")

    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_test_categories_tenant_code"),)


class Test(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tests"

    category_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("test_categories.id"), index=True)
    code: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    name_ar: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    turnaround_hours: Mapped[int] = mapped_column(Integer, default=24)
    sample_type: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    requires_fasting: Mapped[bool] = mapped_column(Boolean, default=False)

    category: Mapped["TestCategory"] = relationship(back_populates="tests")
    reference_ranges: Mapped[list["TestReferenceRange"]] = relationship(back_populates="test")
    result_templates: Mapped[list["TestResultTemplate"]] = relationship(back_populates="test")
    consumables: Mapped[list["TestConsumable"]] = relationship(back_populates="test")

    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_tests_tenant_code"),)


class TestReferenceRange(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "test_reference_ranges"

    test_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("tests.id", ondelete="CASCADE"), index=True)
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    age_min: Mapped[Optional[int]] = mapped_column(Integer)
    age_max: Mapped[Optional[int]] = mapped_column(Integer)
    parameter_name: Mapped[str] = mapped_column(String(150))
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    min_value: Mapped[Optional[float]] = mapped_column(Numeric(12, 4))
    max_value: Mapped[Optional[float]] = mapped_column(Numeric(12, 4))
    normal_text: Mapped[Optional[str]] = mapped_column(String(255))
    critical_low: Mapped[Optional[float]] = mapped_column(Numeric(12, 4))
    critical_high: Mapped[Optional[float]] = mapped_column(Numeric(12, 4))

    test: Mapped["Test"] = relationship(back_populates="reference_ranges")


class TestResultTemplate(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "test_result_templates"

    test_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("tests.id", ondelete="CASCADE"), index=True)
    parameter_name: Mapped[str] = mapped_column(String(150))
    parameter_name_ar: Mapped[Optional[str]] = mapped_column(String(150))
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    field_type: Mapped[str] = mapped_column(String(50), default="numeric")
    options: Mapped[Optional[dict]] = mapped_column(JSONB)

    test: Mapped["Test"] = relationship(back_populates="result_templates")


class TestConsumable(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "test_consumables"

    test_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("tests.id", ondelete="CASCADE"), index=True)
    inventory_item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), index=True
    )
    quantity: Mapped[float] = mapped_column(Numeric(12, 4), default=1)

    test: Mapped["Test"] = relationship(back_populates="consumables")
