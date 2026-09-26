from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declared_attr, relationship
from sqlalchemy.types import TypeDecorator

from .database import Base

# Document statuses. Receipts, transfers and adjustments go draft -> done;
# deliveries go draft -> picked -> packed -> done. Any open document can be cancelled.
DRAFT = "draft"
PICKED = "picked"
PACKED = "packed"
DONE = "done"
CANCELLED = "cancelled"
OPEN_STATUSES = (DRAFT, PICKED, PACKED)

# Operation types, as recorded in the stock ledger.
RECEIPT = "receipt"
DELIVERY = "delivery"
TRANSFER = "transfer"
ADJUSTMENT = "adjustment"


def utcnow():
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Stores naive UTC in the database and always returns timezone-aware UTC."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="manager")  # manager | staff
    is_active = Column(Boolean, nullable=False, default=True)
    # Tokens issued before this moment are rejected (e.g. after a password reset).
    password_changed_at = Column(UTCDateTime, nullable=False, default=utcnow)
    created_at = Column(UTCDateTime, nullable=False, default=utcnow)


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    otp_hash = Column(String(128), nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    expires_at = Column(UTCDateTime, nullable=False)
    verified_at = Column(UTCDateTime)
    used_at = Column(UTCDateTime)
    created_at = Column(UTCDateTime, nullable=False, default=utcnow)

    user = relationship("User")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), unique=True, nullable=False)
    description = Column(String(255))
    created_at = Column(UTCDateTime, nullable=False, default=utcnow)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    sku = Column(String(40), unique=True, nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    unit = Column(String(20), nullable=False, default="Units")
    reorder_level = Column(Float, nullable=False, default=0)
    description = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(UTCDateTime, nullable=False, default=utcnow)
    updated_at = Column(UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow)

    category = relationship("Category", back_populates="products")
    stock_levels = relationship("Stock", back_populates="product")


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)
    # Short code used as the prefix of document references, e.g. MAIN/IN/00001.
    code = Column(String(10), unique=True, nullable=False)
    address = Column(String(255))
    created_at = Column(UTCDateTime, nullable=False, default=utcnow)

    locations = relationship("Location", back_populates="warehouse", order_by="Location.id")


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "name", name="uq_location_warehouse_name"),
    )

    id = Column(Integer, primary_key=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(String(255))
    created_at = Column(UTCDateTime, nullable=False, default=utcnow)

    warehouse = relationship("Warehouse", back_populates="locations")

    @property
    def full_name(self):
        return f"{self.warehouse.name} / {self.name}"


class Stock(Base):
    """On-hand quantity of one product at one location.

    Only services/stock_service.py writes to this table.
    """

    __tablename__ = "stock"
    __table_args__ = (
        UniqueConstraint("product_id", "location_id", name="uq_stock_product_location"),
        CheckConstraint("quantity >= 0", name="ck_stock_non_negative"),
    )

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=False, default=0)
    updated_at = Column(UTCDateTime, nullable=False, default=utcnow)

    product = relationship("Product", back_populates="stock_levels")
    location = relationship("Location")


class DocumentMixin:
    """Columns shared by receipts, deliveries, transfers and adjustments."""

    id = Column(Integer, primary_key=True, index=True)
    # Assigned right after insert (from the id) unless the user supplies one.
    reference = Column(String(40), unique=True, index=True)
    scheduled_date = Column(Date, nullable=False, default=date.today)
    status = Column(String(20), nullable=False, default=DRAFT, index=True)
    notes = Column(Text)
    created_at = Column(UTCDateTime, nullable=False, default=utcnow)
    updated_at = Column(UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow)
    validated_at = Column(UTCDateTime)

    @declared_attr
    def created_by_id(cls):
        return Column(Integer, ForeignKey("users.id"))

    @declared_attr
    def validated_by_id(cls):
        return Column(Integer, ForeignKey("users.id"))

    @declared_attr
    def created_by(cls):
        return relationship("User", foreign_keys=f"{cls.__name__}.created_by_id")

    @declared_attr
    def validated_by(cls):
        return relationship("User", foreign_keys=f"{cls.__name__}.validated_by_id")


class Receipt(DocumentMixin, Base):
    __tablename__ = "receipts"

    supplier = Column(String(150), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)

    location = relationship("Location")
    items = relationship(
        "ReceiptItem", back_populates="receipt", cascade="all, delete-orphan", order_by="ReceiptItem.id"
    )


class ReceiptItem(Base):
    __tablename__ = "receipt_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_receipt_item_qty"),)

    id = Column(Integer, primary_key=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=False)

    receipt = relationship("Receipt", back_populates="items")
    product = relationship("Product")


class Delivery(DocumentMixin, Base):
    __tablename__ = "deliveries"

    customer = Column(String(150), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    picked_at = Column(UTCDateTime)
    packed_at = Column(UTCDateTime)

    location = relationship("Location")
    items = relationship(
        "DeliveryItem", back_populates="delivery", cascade="all, delete-orphan", order_by="DeliveryItem.id"
    )


class DeliveryItem(Base):
    __tablename__ = "delivery_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_delivery_item_qty"),)

    id = Column(Integer, primary_key=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=False)

    delivery = relationship("Delivery", back_populates="items")
    product = relationship("Product")


class Transfer(DocumentMixin, Base):
    __tablename__ = "transfers"
    __table_args__ = (
        CheckConstraint(
            "source_location_id <> destination_location_id", name="ck_transfer_distinct_locations"
        ),
    )

    source_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    destination_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)

    source_location = relationship("Location", foreign_keys=[source_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    items = relationship(
        "TransferItem", back_populates="transfer", cascade="all, delete-orphan", order_by="TransferItem.id"
    )


class TransferItem(Base):
    __tablename__ = "transfer_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_transfer_item_qty"),)

    id = Column(Integer, primary_key=True)
    transfer_id = Column(Integer, ForeignKey("transfers.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=False)

    transfer = relationship("Transfer", back_populates="items")
    product = relationship("Product")


class InventoryAdjustment(DocumentMixin, Base):
    __tablename__ = "inventory_adjustments"

    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    # Snapshot when drafted; overwritten with the real values at validation.
    system_quantity = Column(Float, nullable=False, default=0)
    counted_quantity = Column(Float, nullable=False)
    difference = Column(Float, nullable=False, default=0)
    reason = Column(String(200), nullable=False)

    product = relationship("Product")
    location = relationship("Location")


class StockMovement(Base):
    """Stock ledger: one immutable row per product moved by a validated operation.

    quantity is always positive; the direction comes from which side has a
    location (receipt: destination only, delivery: source only, transfer: both,
    adjustment: destination for a gain, source for a loss).
    """

    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True)
    reference = Column(String(40), nullable=False, index=True)
    operation = Column(String(20), nullable=False, index=True)
    document_id = Column(Integer)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    source_location_id = Column(Integer, ForeignKey("locations.id"), index=True)
    destination_location_id = Column(Integer, ForeignKey("locations.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String(20), nullable=False, default=DONE)
    # Supplier, customer or adjustment reason, for display in the ledger.
    note = Column(String(255))
    created_at = Column(UTCDateTime, nullable=False, default=utcnow, index=True)

    product = relationship("Product")
    source_location = relationship("Location", foreign_keys=[source_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    user = relationship("User")
