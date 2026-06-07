import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class InventoryCategory(str, enum.Enum):
    REAGENT = "reagent"
    KIT = "kit"
    TUBE = "tube"
    GLOVE = "glove"
    SYRINGE = "syringe"
    CONTROL = "control"
    CALIBRATOR = "calibrator"
    CONSUMABLE = "consumable"
    OTHER = "other"


class TransactionType(str, enum.Enum):
    PURCHASE = "purchase"
    CONSUMPTION = "consumption"
    ADJUSTMENT = "adjustment"
    TRANSFER = "transfer"
    EXPIRED = "expired"
    RETURN = "return"


class POStatus(str, enum.Enum):
    DRAFT = "draft"
    ORDERED = "ordered"
    PARTIALLY_RECEIVED = "partially_received"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class Supplier(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "suppliers"

    code: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    name_ar: Mapped[Optional[str]] = mapped_column(String(255))
    contact_person: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    tax_number: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)


class InventoryItem(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "inventory_items"

    branch_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    sku: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    name_ar: Mapped[str] = mapped_column(String(255))
    category: Mapped[InventoryCategory] = mapped_column(Enum(InventoryCategory), index=True)
    unit: Mapped[str] = mapped_column(String(50), default="piece")
    reorder_level: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[Optional[str]] = mapped_column(Text)

    batches: Mapped[list["InventoryBatch"]] = relationship(back_populates="item")
    transactions: Mapped[list["InventoryTransaction"]] = relationship(back_populates="item")


class InventoryBatch(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "inventory_batches"

    item_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), index=True)
    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    batch_number: Mapped[str] = mapped_column(String(100), index=True)
    quantity: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, index=True)
    received_date: Mapped[Optional[date]] = mapped_column(Date)
    supplier_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 4), default=0)

    item: Mapped["InventoryItem"] = relationship(back_populates="batches")


class InventoryTransaction(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "inventory_transactions"

    item_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), index=True)
    batch_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_batches.id"))
    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), index=True)
    quantity: Mapped[float] = mapped_column(Numeric(12, 4))
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50))
    reference_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    item: Mapped["InventoryItem"] = relationship(back_populates="transactions")


class PurchaseOrder(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "purchase_orders"

    branch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), index=True)
    supplier_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"), index=True)
    po_number: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[POStatus] = mapped_column(Enum(POStatus), default=POStatus.DRAFT, index=True)
    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expected_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    items: Mapped[list["PurchaseOrderItem"]] = relationship(back_populates="purchase_order")


class PurchaseOrderItem(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "purchase_order_items"

    purchase_order_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True
    )
    inventory_item_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), index=True)
    quantity: Mapped[float] = mapped_column(Numeric(12, 4))
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 4))
    received_quantity: Mapped[float] = mapped_column(Numeric(12, 4), default=0)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="items")
