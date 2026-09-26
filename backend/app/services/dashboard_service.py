"""Dashboard KPIs, alerts and summaries, computed from live stock and documents."""
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from .. import schemas, serializers
from ..models import (
    ADJUSTMENT,
    DELIVERY,
    DONE,
    RECEIPT,
    TRANSFER,
    Category,
    Location,
    Product,
    Warehouse,
)
from . import operations_service, stock_service
from .stock_service import IN_STOCK, LOW_STOCK, OUT_OF_STOCK

DOCUMENT_KINDS = (RECEIPT, DELIVERY, TRANSFER, ADJUSTMENT)


def product_levels(db, warehouse_id=None, location_id=None, category_id=None):
    """[(product, quantity, stock_status)] for active products.

    Without a warehouse/location this uses global totals. With one, it covers
    the products that have been stocked there and compares their quantity in
    that scope with the reorder level.
    """
    query = db.query(Product).options(joinedload(Product.category)).filter(Product.is_active.is_(True))
    if category_id:
        query = query.filter(Product.category_id == category_id)
    scoped = warehouse_id is not None or location_id is not None
    totals = stock_service.product_totals(db, warehouse_id=warehouse_id, location_id=location_id)

    levels = []
    for product in query.order_by(Product.name):
        if scoped and product.id not in totals:
            continue
        quantity = totals.get(product.id, 0.0)
        levels.append((product, quantity, stock_service.stock_status(quantity, product.reorder_level)))
    return levels


def stats(db, warehouse_id=None, location_id=None, category_id=None):
    levels = product_levels(db, warehouse_id, location_id, category_id)
    counts = Counter(status for _, _, status in levels)
    scope = dict(warehouse_id=warehouse_id, location_id=location_id, category_id=category_id)

    def pending(kind):
        return operations_service.count_documents(db, kind, status="pending", **scope)

    return schemas.DashboardStats(
        total_products=len(levels),
        in_stock=counts[IN_STOCK],
        low_stock=counts[LOW_STOCK],
        out_of_stock=counts[OUT_OF_STOCK],
        pending_receipts=pending(RECEIPT),
        pending_deliveries=pending(DELIVERY),
        pending_transfers=pending(TRANSFER),
        pending_adjustments=pending(ADJUSTMENT),
        completed_transfers=operations_service.count_documents(db, TRANSFER, status=DONE, **scope),
        warehouses=db.query(func.count(Warehouse.id)).scalar(),
        locations=db.query(func.count(Location.id)).scalar(),
    )


def recent_operations(db, document_type=None, status=None, warehouse_id=None,
                      location_id=None, category_id=None, search=None, limit=10):
    kinds = [document_type] if document_type else DOCUMENT_KINDS
    rows = []
    for kind in kinds:
        documents = operations_service.query_documents(
            db, kind, status=status, warehouse_id=warehouse_id, location_id=location_id,
            category_id=category_id, search=search,
        ).limit(limit)
        rows.extend((document.updated_at, kind, document) for document in documents)
    rows.sort(key=lambda row: row[0], reverse=True)
    return [serializers.recent_operation(document, kind) for _, kind, document in rows[:limit]]


def low_stock(db, warehouse_id=None, location_id=None, category_id=None, limit=20):
    alerts = [
        (product, quantity, status)
        for product, quantity, status in product_levels(db, warehouse_id, location_id, category_id)
        if status != IN_STOCK
    ]
    # Out of stock first, then the lowest cover relative to the reorder level.
    alerts.sort(key=lambda row: (row[2] != OUT_OF_STOCK, row[1] / (row[0].reorder_level or 1), row[0].name))
    return [
        schemas.LowStockItem(
            product_id=product.id,
            name=product.name,
            sku=product.sku,
            category_name=product.category.name if product.category else None,
            unit=product.unit,
            on_hand=quantity,
            reorder_level=product.reorder_level,
            stock_status=status,
        )
        for product, quantity, status in alerts[:limit]
    ]


def stock_summary(db, warehouse_id=None, location_id=None, category_id=None):
    levels = product_levels(db, warehouse_id, location_id, category_id)
    status_counts = Counter(status for _, _, status in levels)

    warehouses = db.query(Warehouse).options(joinedload(Warehouse.locations)).order_by(Warehouse.id)
    if location_id:
        location = db.get(Location, location_id)
        warehouses = warehouses.filter(Warehouse.id == (location.warehouse_id if location else -1))
    elif warehouse_id:
        warehouses = warehouses.filter(Warehouse.id == warehouse_id)

    by_warehouse = []
    for warehouse in warehouses.all():
        warehouse_counts = Counter(
            status for _, _, status in product_levels(db, warehouse.id, location_id, category_id)
        )
        by_warehouse.append(schemas.WarehouseSummary(
            warehouse_id=warehouse.id,
            name=warehouse.name,
            code=warehouse.code,
            location_count=len(warehouse.locations),
            product_count=warehouse_counts[IN_STOCK] + warehouse_counts[LOW_STOCK],
            low_stock=warehouse_counts[LOW_STOCK],
            out_of_stock=warehouse_counts[OUT_OF_STOCK],
        ))

    per_category = defaultdict(Counter)
    for product, _, status in levels:
        per_category[product.category_id][status] += 1
    names = dict(db.query(Category.id, Category.name))
    by_category = [
        schemas.CategorySummary(
            category_id=category,
            name=names.get(category, "Uncategorized"),
            product_count=sum(counter.values()),
            low_stock=counter[LOW_STOCK],
            out_of_stock=counter[OUT_OF_STOCK],
        )
        for category, counter in per_category.items()
    ]
    by_category.sort(key=lambda row: (-row.product_count, row.name))

    return schemas.StockSummary(
        status_counts={status: status_counts[status] for status in (IN_STOCK, LOW_STOCK, OUT_OF_STOCK)},
        by_warehouse=by_warehouse,
        by_category=by_category,
    )


def activity(db, days=14, tz_offset_minutes=0, warehouse_id=None, location_id=None):
    """Validated operations per day for the last `days` days, in the viewer's time zone.

    tz_offset_minutes follows JavaScript's Date.getTimezoneOffset() (UTC - local).
    """
    offset = timedelta(minutes=tz_offset_minutes)
    today = (datetime.now(timezone.utc) - offset).date()
    first_day = today - timedelta(days=days - 1)
    since = datetime.combine(first_day, datetime.min.time(), tzinfo=timezone.utc) + offset

    buckets = {first_day + timedelta(days=i): Counter() for i in range(days)}
    for kind in DOCUMENT_KINDS:
        model = operations_service.MODELS[kind]
        query = operations_service.filter_documents(
            db.query(model.validated_at), kind, status=DONE,
            warehouse_id=warehouse_id, location_id=location_id,
        ).filter(model.validated_at >= since)
        for (validated_at,) in query:
            day = (validated_at - offset).date()
            if day in buckets:
                buckets[day][kind] += 1

    return [
        schemas.ActivityDay(date=day, **{kind: counter[kind] for kind in DOCUMENT_KINDS})
        for day, counter in buckets.items()
    ]
