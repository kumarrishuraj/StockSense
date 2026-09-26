import re
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

# ------------------------------------------------------------------ field types


def _positive_qty(value):
    value = round(value, 3) + 0.0
    if value <= 0:
        raise ValueError("Quantity must be greater than zero")
    return value


def _non_negative_qty(value):
    value = round(value, 3) + 0.0
    if value < 0:
        raise ValueError("Quantity cannot be negative")
    return value


def _password(value):
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain at least one letter and one number")
    return value


def _blank_to_none(value):
    return value or None


PositiveQty = Annotated[float, Field(le=1_000_000_000, allow_inf_nan=False), AfterValidator(_positive_qty)]
NonNegativeQty = Annotated[float, Field(le=1_000_000_000, allow_inf_nan=False), AfterValidator(_non_negative_qty)]
Password = Annotated[str, AfterValidator(_password)]
OptionalText = Annotated[str | None, Field(max_length=1000), AfterValidator(_blank_to_none)]
OptionalReference = Annotated[str | None, Field(max_length=40), AfterValidator(_blank_to_none)]


class InputModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")


class OutputModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    message: str


# ------------------------------------------------------------------------- auth


class _EmailModel(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower(cls, value):
        return value.lower()


class SignupRequest(_EmailModel):
    name: str = Field(min_length=2, max_length=120)
    password: Password
    role: Literal["manager", "staff"] = "manager"

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value):
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must be at least 2 characters")
        return value


class LoginRequest(_EmailModel):
    password: str = Field(min_length=1, max_length=200)


class UserOut(OutputModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(InputModel):
    name: str = Field(min_length=2, max_length=120)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: Password


class ForgotPasswordRequest(_EmailModel):
    pass


class ForgotPasswordResponse(BaseModel):
    message: str
    expires_in_minutes: int
    dev_mode: bool
    # Only filled in development mode, where no email/SMS provider is configured.
    dev_otp: str | None = None


class VerifyOtpRequest(_EmailModel):
    otp: str = Field(pattern=r"^\d{6}$")


class VerifyOtpResponse(BaseModel):
    reset_token: str
    expires_in_minutes: int


class ResetPasswordRequest(BaseModel):
    reset_token: str = Field(min_length=10)
    new_password: Password


# ------------------------------------------------------------------- categories


class CategoryCreate(InputModel):
    name: str = Field(min_length=1, max_length=80)
    description: Annotated[str | None, Field(max_length=255), AfterValidator(_blank_to_none)] = None


class CategoryUpdate(InputModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: Annotated[str | None, Field(max_length=255), AfterValidator(_blank_to_none)] = None


class CategoryOut(OutputModel):
    id: int
    name: str
    description: str | None
    product_count: int = 0
    created_at: datetime


# ------------------------------------------------------- warehouses & locations


class WarehouseCreate(InputModel):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=2, max_length=10, pattern=r"^[A-Za-z0-9-]+$")
    address: Annotated[str | None, Field(max_length=255), AfterValidator(_blank_to_none)] = None
    # Most warehouses need at least one place to put stock.
    create_default_location: bool = True

    @field_validator("code")
    @classmethod
    def _upper(cls, value):
        return value.upper()


class WarehouseUpdate(InputModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, min_length=2, max_length=10, pattern=r"^[A-Za-z0-9-]+$")
    address: Annotated[str | None, Field(max_length=255), AfterValidator(_blank_to_none)] = None

    @field_validator("code")
    @classmethod
    def _upper(cls, value):
        return value.upper() if value else value


class LocationCreate(InputModel):
    warehouse_id: int
    name: str = Field(min_length=1, max_length=120)
    description: Annotated[str | None, Field(max_length=255), AfterValidator(_blank_to_none)] = None


class LocationUpdate(InputModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: Annotated[str | None, Field(max_length=255), AfterValidator(_blank_to_none)] = None


class LocationOut(BaseModel):
    id: int
    name: str
    full_name: str
    description: str | None = None
    warehouse_id: int
    warehouse_name: str
    warehouse_code: str
    product_count: int = 0
    total_quantity: float = 0
    created_at: datetime | None = None


class WarehouseOut(BaseModel):
    id: int
    name: str
    code: str
    address: str | None
    created_at: datetime
    locations: list[LocationOut]
    location_count: int
    product_count: int
    total_quantity: float


# --------------------------------------------------------------------- products

SKU_PATTERN = r"^[A-Za-z0-9._/-]+$"


class ProductCreate(InputModel):
    name: str = Field(min_length=1, max_length=150)
    sku: str = Field(min_length=1, max_length=40, pattern=SKU_PATTERN)
    category_id: int | None = None
    unit: str = Field(default="Units", min_length=1, max_length=20)
    reorder_level: NonNegativeQty = 0
    description: OptionalText = None
    is_active: bool = True
    initial_stock: NonNegativeQty = 0
    initial_location_id: int | None = None

    @field_validator("sku")
    @classmethod
    def _upper(cls, value):
        return value.upper()

    @model_validator(mode="after")
    def _initial_location(self):
        if self.initial_stock > 0 and not self.initial_location_id:
            raise ValueError("Choose a location for the initial stock")
        return self


class ProductUpdate(InputModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    sku: str | None = Field(default=None, min_length=1, max_length=40, pattern=SKU_PATTERN)
    category_id: int | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    reorder_level: NonNegativeQty | None = None
    description: OptionalText = None
    is_active: bool | None = None

    @field_validator("sku")
    @classmethod
    def _upper(cls, value):
        return value.upper() if value else value


class ProductOut(BaseModel):
    id: int
    name: str
    sku: str
    category_id: int | None
    category_name: str | None
    unit: str
    reorder_level: float
    description: str | None
    is_active: bool
    # on_hand is the quantity in the requested warehouse/location scope;
    # total_on_hand is always the global quantity.
    on_hand: float
    total_on_hand: float
    stock_status: str
    created_at: datetime
    updated_at: datetime


class StockLocationOut(BaseModel):
    location_id: int
    location_name: str
    full_name: str
    warehouse_id: int
    warehouse_name: str
    quantity: float
    updated_at: datetime | None = None


class MovementOut(BaseModel):
    id: int
    created_at: datetime
    reference: str
    operation: str
    document_id: int | None
    product_id: int
    product_name: str
    sku: str
    unit: str
    quantity: float
    # in: stock entered the company, out: stock left it, internal: moved between locations.
    direction: Literal["in", "out", "internal"]
    source_location_id: int | None
    source_name: str
    destination_location_id: int | None
    destination_name: str
    user_name: str | None
    status: str
    note: str | None


class ProductDetailOut(ProductOut):
    stock_by_location: list[StockLocationOut]
    recent_movements: list[MovementOut]


class ProductDeleteResult(BaseModel):
    deleted: bool
    deactivated: bool
    message: str


# -------------------------------------------------------------------- inventory


class InventoryRow(BaseModel):
    product_id: int
    product_name: str
    sku: str
    category_name: str | None
    unit: str
    location_id: int
    location_name: str
    full_name: str
    warehouse_id: int
    warehouse_name: str
    quantity: float
    reorder_level: float
    stock_status: str
    updated_at: datetime | None


class WarehouseStockOut(BaseModel):
    warehouse_id: int
    warehouse_name: str
    quantity: float


class ProductInventoryOut(BaseModel):
    product_id: int
    product_name: str
    sku: str
    unit: str
    reorder_level: float
    total_quantity: float
    stock_status: str
    by_location: list[StockLocationOut]
    by_warehouse: list[WarehouseStockOut]


class MovementPage(BaseModel):
    items: list[MovementOut]
    total: int
    page: int
    page_size: int


# ------------------------------------------------------------------- operations


class LineIn(BaseModel):
    product_id: int
    quantity: PositiveQty


def _unique_products(items):
    product_ids = [item.product_id for item in items]
    if len(product_ids) != len(set(product_ids)):
        raise ValueError("Each product can appear only once per document; combine the quantities into one line")
    return items


Lines = Annotated[list[LineIn], Field(min_length=1, max_length=200), AfterValidator(_unique_products)]


class ReceiptCreate(InputModel):
    supplier: str = Field(min_length=1, max_length=150)
    reference: OptionalReference = None
    warehouse_id: int | None = None
    location_id: int
    scheduled_date: date | None = None
    notes: OptionalText = None
    items: Lines


class DeliveryCreate(InputModel):
    customer: str = Field(min_length=1, max_length=150)
    reference: OptionalReference = None
    warehouse_id: int | None = None
    location_id: int
    scheduled_date: date | None = None
    notes: OptionalText = None
    items: Lines


class TransferCreate(InputModel):
    reference: OptionalReference = None
    source_location_id: int
    destination_location_id: int
    scheduled_date: date | None = None
    notes: OptionalText = None
    items: Lines

    @model_validator(mode="after")
    def _distinct(self):
        if self.source_location_id == self.destination_location_id:
            raise ValueError("Source and destination locations must be different")
        return self


class AdjustmentCreate(InputModel):
    reference: OptionalReference = None
    product_id: int
    warehouse_id: int | None = None
    location_id: int
    counted_quantity: NonNegativeQty
    reason: str = Field(min_length=1, max_length=200)
    scheduled_date: date | None = None
    notes: OptionalText = None


class LineOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    unit: str
    quantity: float
    # Stock at the source location (deliveries and transfers only).
    available: float | None = None


class LocationRef(BaseModel):
    id: int
    name: str
    full_name: str
    warehouse_id: int
    warehouse_name: str
    warehouse_code: str


class DocumentOut(BaseModel):
    id: int
    document_type: str
    reference: str
    status: str
    scheduled_date: date
    notes: str | None
    created_by_name: str | None
    validated_by_name: str | None
    created_at: datetime
    updated_at: datetime
    validated_at: datetime | None


class ItemizedDocumentOut(DocumentOut):
    items: list[LineOut]
    item_count: int
    total_quantity: float


class ReceiptOut(ItemizedDocumentOut):
    supplier: str
    location: LocationRef


class DeliveryOut(ItemizedDocumentOut):
    customer: str
    location: LocationRef
    picked_at: datetime | None
    packed_at: datetime | None
    is_available: bool | None


class TransferOut(ItemizedDocumentOut):
    source_location: LocationRef
    destination_location: LocationRef
    is_available: bool | None


class AdjustmentOut(DocumentOut):
    product_id: int
    product_name: str
    sku: str
    unit: str
    location: LocationRef
    system_quantity: float
    counted_quantity: float
    difference: float
    # Live on-hand quantity, so a draft shows what validating would change now.
    current_quantity: float
    reason: str


# -------------------------------------------------------------------- dashboard


class DashboardStats(BaseModel):
    total_products: int
    in_stock: int
    low_stock: int
    out_of_stock: int
    pending_receipts: int
    pending_deliveries: int
    pending_transfers: int
    pending_adjustments: int
    completed_transfers: int
    warehouses: int
    locations: int


class RecentOperation(BaseModel):
    id: int
    document_type: str
    reference: str
    status: str
    partner: str | None
    source_name: str | None
    destination_name: str | None
    warehouse_name: str
    scheduled_date: date
    updated_at: datetime
    item_count: int
    total_quantity: float
    # Shared unit of all lines, or None when the lines mix units.
    unit: str | None
    summary: str


class LowStockItem(BaseModel):
    product_id: int
    name: str
    sku: str
    category_name: str | None
    unit: str
    on_hand: float
    reorder_level: float
    stock_status: str


class WarehouseSummary(BaseModel):
    warehouse_id: int
    name: str
    code: str
    location_count: int
    product_count: int
    low_stock: int
    out_of_stock: int


class CategorySummary(BaseModel):
    category_id: int | None
    name: str
    product_count: int
    low_stock: int
    out_of_stock: int


class StockSummary(BaseModel):
    status_counts: dict[str, int]
    by_warehouse: list[WarehouseSummary]
    by_category: list[CategorySummary]


class ActivityDay(BaseModel):
    date: date
    receipt: int
    delivery: int
    transfer: int
    adjustment: int


class SearchResults(BaseModel):
    products: list[ProductOut]
    operations: list[RecentOperation]
