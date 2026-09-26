"""Receipts, delivery orders, internal transfers and inventory adjustments.

These functions own the document workflows (statuses, references, validation
rules). All stock changes are delegated to stock_service. Nothing here commits:
routers commit once per request so a failed validation leaves no partial changes.
"""
from datetime import date

from sqlalchemy import or_, select, update
from sqlalchemy.orm import joinedload, selectinload

from ..models import (
    ADJUSTMENT,
    CANCELLED,
    DELIVERY,
    DONE,
    DRAFT,
    OPEN_STATUSES,
    PACKED,
    PICKED,
    RECEIPT,
    TRANSFER,
    Delivery,
    DeliveryItem,
    InventoryAdjustment,
    Location,
    Product,
    Receipt,
    ReceiptItem,
    Transfer,
    TransferItem,
    utcnow,
)
from . import stock_service
from .stock_service import StockError

MODELS = {
    RECEIPT: Receipt,
    DELIVERY: Delivery,
    TRANSFER: Transfer,
    ADJUSTMENT: InventoryAdjustment,
}
ITEM_MODELS = {
    RECEIPT: (ReceiptItem, ReceiptItem.receipt_id),
    DELIVERY: (DeliveryItem, DeliveryItem.delivery_id),
    TRANSFER: (TransferItem, TransferItem.transfer_id),
}
REFERENCE_CODES = {RECEIPT: "IN", DELIVERY: "OUT", TRANSFER: "INT", ADJUSTMENT: "ADJ"}
LABELS = {RECEIPT: "Receipt", DELIVERY: "Delivery", TRANSFER: "Transfer", ADJUSTMENT: "Adjustment"}
STATUS_LABELS = {
    DRAFT: "Draft", PICKED: "Picked", PACKED: "Packed", DONE: "Done", CANCELLED: "Cancelled",
}


def location_columns(kind):
    model = MODELS[kind]
    if kind == TRANSFER:
        return [model.source_location_id, model.destination_location_id]
    return [model.location_id]


def load_options(kind):
    model = MODELS[kind]
    options = [joinedload(model.created_by), joinedload(model.validated_by)]
    if kind == TRANSFER:
        options += [
            joinedload(model.source_location).joinedload(Location.warehouse),
            joinedload(model.destination_location).joinedload(Location.warehouse),
        ]
    else:
        options.append(joinedload(model.location).joinedload(Location.warehouse))
    if kind == ADJUSTMENT:
        options.append(joinedload(model.product))
    else:
        item_model, _ = ITEM_MODELS[kind]
        options.append(selectinload(model.items).joinedload(item_model.product))
    return options


# --------------------------------------------------------------------- lookups


def get_document(db, kind, document_id):
    model = MODELS[kind]
    document = db.query(model).options(*load_options(kind)).filter(model.id == document_id).one_or_none()
    if document is None:
        raise StockError(f"{LABELS[kind]} not found.", 404)
    return document


def get_location(db, location_id, warehouse_id=None):
    location = db.query(Location).options(joinedload(Location.warehouse)).filter(
        Location.id == location_id
    ).one_or_none()
    if location is None:
        raise StockError("Location not found.", 404)
    if warehouse_id is not None and location.warehouse_id != warehouse_id:
        raise StockError(f"Location '{location.name}' does not belong to the selected warehouse.")
    return location


def get_product(db, product_id):
    product = db.get(Product, product_id)
    if product is None:
        raise StockError("Product not found.", 404)
    if not product.is_active:
        raise StockError(f"{product.name} is inactive and cannot be used in new operations.")
    return product


def _check_products(db, lines):
    product_ids = [line.product_id for line in lines]
    products = {p.id: p for p in db.query(Product).filter(Product.id.in_(product_ids))}
    missing = [pid for pid in product_ids if pid not in products]
    if missing:
        raise StockError(f"Product not found (id {', '.join(map(str, missing))}).", 404)
    inactive = [p.name for p in products.values() if not p.is_active]
    if inactive:
        raise StockError(f"Inactive products cannot be used in new operations: {', '.join(inactive)}.")


def _assign_reference(db, document, kind, location, custom_reference):
    model = type(document)
    if custom_reference:
        if db.query(model.id).filter(model.reference == custom_reference).first():
            raise StockError(f"Reference '{custom_reference}' is already used.", 409)
        document.reference = custom_reference
        db.flush()
    else:
        db.flush()  # assigns the id used in the reference
        document.reference = f"{location.warehouse.code}/{REFERENCE_CODES[kind]}/{document.id:05d}"


def _claim(db, document, kind, allowed, new_status, action, **values):
    """Atomically move a document from one of `allowed` statuses to `new_status`.

    The status check is part of the UPDATE, so if two requests race to validate
    the same document only one wins; the other gets an error and changes nothing.
    """
    model = type(document)
    now = utcnow()
    result = db.execute(
        update(model)
        .where(model.id == document.id, model.status.in_(allowed))
        .values(status=new_status, updated_at=now, **values)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.refresh(document)
        current = STATUS_LABELS.get(document.status, document.status)
        hint = ""
        if kind == DELIVERY and document.status in OPEN_STATUSES:
            hint = " Deliveries go Draft → Pick → Pack → Validate."
        raise StockError(
            f"{LABELS[kind]} {document.reference} cannot be {action} while it is {current}.{hint}", 409
        )
    db.expire(document, ["status", "updated_at", *values.keys()])


def cancel_document(db, document, kind, user):
    _claim(db, document, kind, OPEN_STATUSES, CANCELLED, "cancelled")
    return document


# --------------------------------------------------------------------- receipts


def create_receipt(db, data, user):
    location = get_location(db, data.location_id, data.warehouse_id)
    _check_products(db, data.items)
    receipt = Receipt(
        supplier=data.supplier,
        location=location,
        scheduled_date=data.scheduled_date or date.today(),
        notes=data.notes,
        created_by=user,
        status=DRAFT,
        items=[ReceiptItem(product_id=line.product_id, quantity=line.quantity) for line in data.items],
    )
    db.add(receipt)
    _assign_reference(db, receipt, RECEIPT, location, data.reference)
    return receipt


def validate_receipt(db, receipt, user):
    """Draft -> Done. Stock increases at the destination location."""
    _claim(db, receipt, RECEIPT, (DRAFT,), DONE, "validated",
           validated_by_id=user.id if user else None, validated_at=utcnow())
    for item in receipt.items:
        stock_service.increase_stock(
            db, product=item.product, location=receipt.location, quantity=item.quantity,
            operation=RECEIPT, reference=receipt.reference, document_id=receipt.id,
            user=user, note=receipt.supplier,
        )
    return receipt


# ------------------------------------------------------------------- deliveries


def create_delivery(db, data, user):
    location = get_location(db, data.location_id, data.warehouse_id)
    _check_products(db, data.items)
    delivery = Delivery(
        customer=data.customer,
        location=location,
        scheduled_date=data.scheduled_date or date.today(),
        notes=data.notes,
        created_by=user,
        status=DRAFT,
        items=[DeliveryItem(product_id=line.product_id, quantity=line.quantity) for line in data.items],
    )
    db.add(delivery)
    _assign_reference(db, delivery, DELIVERY, location, data.reference)
    return delivery


def _delivery_lines(delivery):
    return [(item.product, delivery.location, item.quantity) for item in delivery.items]


def pick_delivery(db, delivery, user):
    """Draft -> Picked. Refuses to pick what is not on the shelf."""
    _claim(db, delivery, DELIVERY, (DRAFT,), PICKED, "picked", picked_at=utcnow())
    stock_service.ensure_available(db, _delivery_lines(delivery))
    return delivery


def pack_delivery(db, delivery, user):
    """Picked -> Packed."""
    _claim(db, delivery, DELIVERY, (PICKED,), PACKED, "packed", packed_at=utcnow())
    return delivery


def validate_delivery(db, delivery, user):
    """Packed -> Done. Stock decreases at the source location."""
    _claim(db, delivery, DELIVERY, (PACKED,), DONE, "validated",
           validated_by_id=user.id if user else None, validated_at=utcnow())
    stock_service.ensure_available(db, _delivery_lines(delivery))
    for item in delivery.items:
        stock_service.decrease_stock(
            db, product=item.product, location=delivery.location, quantity=item.quantity,
            operation=DELIVERY, reference=delivery.reference, document_id=delivery.id,
            user=user, note=delivery.customer,
        )
    return delivery


# -------------------------------------------------------------------- transfers


def create_transfer(db, data, user):
    source = get_location(db, data.source_location_id)
    destination = get_location(db, data.destination_location_id)
    if source.id == destination.id:
        raise StockError("Source and destination locations must be different.")
    _check_products(db, data.items)
    transfer = Transfer(
        source_location=source,
        destination_location=destination,
        scheduled_date=data.scheduled_date or date.today(),
        notes=data.notes,
        created_by=user,
        status=DRAFT,
        items=[TransferItem(product_id=line.product_id, quantity=line.quantity) for line in data.items],
    )
    db.add(transfer)
    _assign_reference(db, transfer, TRANSFER, source, data.reference)
    return transfer


def validate_transfer(db, transfer, user):
    """Draft -> Done. Source decreases, destination increases, total unchanged."""
    _claim(db, transfer, TRANSFER, (DRAFT,), DONE, "validated",
           validated_by_id=user.id if user else None, validated_at=utcnow())
    stock_service.ensure_available(
        db, [(item.product, transfer.source_location, item.quantity) for item in transfer.items]
    )
    for item in transfer.items:
        stock_service.transfer_stock(
            db, product=item.product, source=transfer.source_location,
            destination=transfer.destination_location, quantity=item.quantity,
            reference=transfer.reference, document_id=transfer.id, user=user,
        )
    return transfer


# ------------------------------------------------------------------ adjustments


def new_adjustment(db, *, product, location, counted_quantity, reason, user,
                   reference=None, scheduled_date=None, notes=None):
    system_quantity = stock_service.get_quantity(db, product.id, location.id)
    adjustment = InventoryAdjustment(
        product=product,
        location=location,
        system_quantity=system_quantity,
        counted_quantity=counted_quantity,
        difference=stock_service.normalize_qty(counted_quantity - system_quantity),
        reason=reason,
        scheduled_date=scheduled_date or date.today(),
        notes=notes,
        created_by=user,
        status=DRAFT,
    )
    db.add(adjustment)
    _assign_reference(db, adjustment, ADJUSTMENT, location, reference)
    return adjustment


def create_adjustment(db, data, user):
    location = get_location(db, data.location_id, data.warehouse_id)
    product = get_product(db, data.product_id)
    return new_adjustment(
        db, product=product, location=location, counted_quantity=data.counted_quantity,
        reason=data.reason, user=user, reference=data.reference,
        scheduled_date=data.scheduled_date, notes=data.notes,
    )


def validate_adjustment(db, adjustment, user):
    """Draft -> Done. Stock at the location becomes the counted quantity.

    The difference is recalculated against the stock at validation time, so
    operations validated after the draft was created are taken into account.
    """
    _claim(db, adjustment, ADJUSTMENT, (DRAFT,), DONE, "validated",
           validated_by_id=user.id if user else None, validated_at=utcnow())
    _, system_quantity, difference = stock_service.adjust_stock(
        db, product=adjustment.product, location=adjustment.location,
        counted_quantity=adjustment.counted_quantity, reference=adjustment.reference,
        document_id=adjustment.id, user=user, note=adjustment.reason,
    )
    adjustment.system_quantity = system_quantity
    adjustment.difference = difference
    return adjustment


def record_initial_stock(db, product, location, quantity, user):
    """Initial stock of a new product, booked as a validated adjustment for the ledger."""
    adjustment = new_adjustment(
        db, product=product, location=location, counted_quantity=quantity,
        reason="Initial stock", user=user,
    )
    return validate_adjustment(db, adjustment, user)


# ---------------------------------------------------------------------- queries


def query_documents(db, kind, **filters):
    """Documents of one kind, newest activity first, with everything serializers need loaded."""
    model = MODELS[kind]
    query = filter_documents(db.query(model).options(*load_options(kind)), kind, **filters)
    return query.order_by(model.updated_at.desc(), model.id.desc())


def filter_documents(query, kind, *, status=None, warehouse_id=None, location_id=None,
                     product_id=None, category_id=None, search=None,
                     date_from=None, date_to=None):
    """Apply the shared list/dashboard filters. status="pending" means any open status."""
    model = MODELS[kind]

    if status == "pending":
        query = query.filter(model.status.in_(OPEN_STATUSES))
    elif status:
        query = query.filter(model.status == status)

    columns = location_columns(kind)
    if location_id:
        query = query.filter(or_(*[column == location_id for column in columns]))
    if warehouse_id:
        warehouse_locations = select(Location.id).where(Location.warehouse_id == warehouse_id)
        query = query.filter(or_(*[column.in_(warehouse_locations) for column in columns]))

    product_filter = select(Product.id)
    if product_id:
        product_filter = product_filter.where(Product.id == product_id)
    if category_id:
        product_filter = product_filter.where(Product.category_id == category_id)
    if product_id or category_id:
        query = query.filter(_has_product_in(kind, product_filter))

    if search:
        like = f"%{search.strip()}%"
        matching_products = select(Product.id).where(or_(Product.name.ilike(like), Product.sku.ilike(like)))
        conditions = [model.reference.ilike(like), _has_product_in(kind, matching_products)]
        if kind == RECEIPT:
            conditions.append(model.supplier.ilike(like))
        elif kind == DELIVERY:
            conditions.append(model.customer.ilike(like))
        elif kind == ADJUSTMENT:
            conditions.append(model.reason.ilike(like))
        query = query.filter(or_(*conditions))

    if date_from:
        query = query.filter(model.scheduled_date >= date_from)
    if date_to:
        query = query.filter(model.scheduled_date <= date_to)

    return query


def count_documents(db, kind, **filters):
    model = MODELS[kind]
    return filter_documents(db.query(model.id), kind, **filters).count()


def _has_product_in(kind, product_ids):
    model = MODELS[kind]
    if kind == ADJUSTMENT:
        return model.product_id.in_(product_ids)
    item_model, document_fk = ITEM_MODELS[kind]
    return model.id.in_(select(document_fk).where(item_model.product_id.in_(product_ids)))
