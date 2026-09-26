"""Centralized stock engine.

Every stock change in StockSense goes through this module: receipts, deliveries,
transfers, adjustments and initial stock all call the functions below, which

* update the product + location row in the ``stock`` table, and
* append a row to the ``stock_movements`` ledger,

inside the caller's session. Nothing here commits: the caller commits once, so
the stock change, the ledger entry and the document status are saved together or
not at all.
"""
from collections import defaultdict

from sqlalchemy import func, update

from ..models import (
    ADJUSTMENT,
    DONE,
    TRANSFER,
    Location,
    Stock,
    StockMovement,
    utcnow,
)

# Quantities are stored with 3 decimals; this absorbs float noise in comparisons.
EPSILON = 1e-6

IN_STOCK = "in_stock"
LOW_STOCK = "low_stock"
OUT_OF_STOCK = "out_of_stock"


class StockError(Exception):
    """A stock operation broke a business rule. Carries the HTTP status to return."""

    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


class InsufficientStockError(StockError):
    pass


def normalize_qty(value):
    # + 0.0 turns -0.0 into 0.0
    return round(float(value), 3) + 0.0


def format_qty(value, unit=""):
    text = f"{normalize_qty(value):g}"
    return f"{text} {unit}".strip()


def stock_status(quantity, reorder_level):
    if quantity <= EPSILON:
        return OUT_OF_STOCK
    if quantity <= reorder_level + EPSILON:
        return LOW_STOCK
    return IN_STOCK


# --------------------------------------------------------------------------- reads


def get_quantity(db, product_id, location_id):
    quantity = (
        db.query(Stock.quantity)
        .filter(Stock.product_id == product_id, Stock.location_id == location_id)
        .scalar()
    )
    return normalize_qty(quantity or 0)


def product_totals(db, warehouse_id=None, location_id=None, product_ids=None):
    """{product_id: quantity} summed over all locations, or over one warehouse/location.

    Products with a stock row in scope are included even when the quantity is 0,
    so callers can tell "ran out here" apart from "never stocked here".
    """
    query = db.query(Stock.product_id, func.sum(Stock.quantity)).join(
        Location, Location.id == Stock.location_id
    )
    if location_id is not None:
        query = query.filter(Stock.location_id == location_id)
    elif warehouse_id is not None:
        query = query.filter(Location.warehouse_id == warehouse_id)
    if product_ids is not None:
        query = query.filter(Stock.product_id.in_(list(product_ids)))
    return {
        product_id: normalize_qty(total or 0)
        for product_id, total in query.group_by(Stock.product_id)
    }


def product_total(db, product_id):
    return product_totals(db, product_ids=[product_id]).get(product_id, 0.0)


def quantities_at(db, pairs):
    """{(product_id, location_id): quantity} for the given pairs, in one query."""
    pairs = set(pairs)
    if not pairs:
        return {}
    product_ids = {product_id for product_id, _ in pairs}
    location_ids = {location_id for _, location_id in pairs}
    rows = db.query(Stock.product_id, Stock.location_id, Stock.quantity).filter(
        Stock.product_id.in_(product_ids), Stock.location_id.in_(location_ids)
    )
    found = {(p, l): normalize_qty(q) for p, l, q in rows}
    return {pair: found.get(pair, 0.0) for pair in pairs}


def stock_by_location(db, product_id):
    return (
        db.query(Stock)
        .join(Location, Location.id == Stock.location_id)
        .filter(Stock.product_id == product_id)
        .order_by(Location.warehouse_id, Location.id)
        .all()
    )


def ensure_available(db, lines):
    """Raise one InsufficientStockError listing every shortfall.

    lines: iterable of (product, location, quantity). Quantities for the same
    product and location are added up before checking.
    """
    needed = defaultdict(float)
    objects = {}
    for product, location, quantity in lines:
        key = (product.id, location.id)
        needed[key] += quantity
        objects[key] = (product, location)

    available = quantities_at(db, needed.keys())
    shortages = []
    for key, quantity in needed.items():
        if available[key] + EPSILON < quantity:
            product, location = objects[key]
            shortages.append(
                f"{product.name} at {location.full_name}: available "
                f"{format_qty(available[key], product.unit)}, requested "
                f"{format_qty(quantity, product.unit)}"
            )
    if shortages:
        raise InsufficientStockError("Insufficient stock. " + "; ".join(shortages) + ".")


# -------------------------------------------------------------------------- writes


def _stock_row(db, product_id, location_id):
    row = (
        db.query(Stock)
        .filter(Stock.product_id == product_id, Stock.location_id == location_id)
        .one_or_none()
    )
    if row is None:
        row = Stock(product_id=product_id, location_id=location_id, quantity=0)
        db.add(row)
        db.flush()
    return row


def _apply_delta(db, product, location, delta):
    row = _stock_row(db, product.id, location.id)
    statement = (
        update(Stock)
        .where(Stock.id == row.id)
        .values(quantity=func.round(Stock.quantity + delta, 3), updated_at=utcnow())
        .execution_options(synchronize_session=False)
    )
    if delta < 0:
        # The availability check lives in the UPDATE itself, so two concurrent
        # requests can never both spend the same stock.
        statement = statement.where(Stock.quantity + EPSILON >= -delta)

    if db.execute(statement).rowcount != 1:
        db.expire(row)
        raise InsufficientStockError(
            f"Insufficient stock for {product.name} at {location.full_name}: available "
            f"{format_qty(row.quantity, product.unit)}, requested "
            f"{format_qty(-delta, product.unit)}."
        )
    db.expire(row)


def _record(db, *, operation, reference, document_id, product, quantity, source, destination, user, note):
    movement = StockMovement(
        reference=reference,
        operation=operation,
        document_id=document_id,
        product_id=product.id,
        quantity=quantity,
        source_location_id=source.id if source else None,
        destination_location_id=destination.id if destination else None,
        user_id=user.id if user else None,
        status=DONE,
        note=note,
    )
    db.add(movement)
    return movement


def _positive(quantity):
    quantity = normalize_qty(quantity)
    if quantity <= 0:
        raise StockError("Quantity must be greater than zero.")
    return quantity


def increase_stock(db, *, product, location, quantity, operation, reference,
                   document_id=None, user=None, note=None):
    quantity = _positive(quantity)
    _apply_delta(db, product, location, quantity)
    return _record(db, operation=operation, reference=reference, document_id=document_id,
                   product=product, quantity=quantity, source=None, destination=location,
                   user=user, note=note)


def decrease_stock(db, *, product, location, quantity, operation, reference,
                   document_id=None, user=None, note=None):
    quantity = _positive(quantity)
    _apply_delta(db, product, location, -quantity)
    return _record(db, operation=operation, reference=reference, document_id=document_id,
                   product=product, quantity=quantity, source=location, destination=None,
                   user=user, note=note)


def transfer_stock(db, *, product, source, destination, quantity, reference,
                   document_id=None, user=None, note=None):
    """Move stock between locations. The global total for the product is unchanged."""
    quantity = _positive(quantity)
    if source.id == destination.id:
        raise StockError("Source and destination locations must be different.")
    _apply_delta(db, product, source, -quantity)
    _apply_delta(db, product, destination, quantity)
    return _record(db, operation=TRANSFER, reference=reference, document_id=document_id,
                   product=product, quantity=quantity, source=source, destination=destination,
                   user=user, note=note)


def adjust_stock(db, *, product, location, counted_quantity, reference,
                 document_id=None, user=None, note=None):
    """Set the stock at a location to a physically counted quantity.

    Returns (movement or None, system_quantity, difference) where
    difference = counted_quantity - system_quantity. No ledger row is written
    when the count matches the system.
    """
    counted_quantity = normalize_qty(counted_quantity)
    if counted_quantity < 0:
        raise StockError("Counted quantity cannot be negative.")

    system_quantity = get_quantity(db, product.id, location.id)
    difference = normalize_qty(counted_quantity - system_quantity)
    if difference == 0:
        return None, system_quantity, difference

    _apply_delta(db, product, location, difference)
    movement = _record(
        db,
        operation=ADJUSTMENT,
        reference=reference,
        document_id=document_id,
        product=product,
        quantity=abs(difference),
        source=location if difference < 0 else None,
        destination=location if difference > 0 else None,
        user=user,
        note=note,
    )
    return movement, system_quantity, difference
