from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from .. import serializers
from ..database import get_db
from ..models import Location, Product, Stock, StockMovement
from ..schemas import (
    InventoryRow,
    MovementPage,
    ProductInventoryOut,
    WarehouseStockOut,
)
from ..services import stock_service
from ..services.auth_service import get_current_user

router = APIRouter(tags=["Inventory"], dependencies=[Depends(get_current_user)])

MOVEMENT_SORTS = {
    "date": StockMovement.created_at,
    "reference": StockMovement.reference,
    "product": Product.name,
    "quantity": StockMovement.quantity,
    "operation": StockMovement.operation,
}


@router.get("/inventory", response_model=list[InventoryRow])
def list_inventory(
    product_id: int | None = None,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    category_id: int | None = None,
    search: str | None = None,
    include_zero: bool = False,
    db: Session = Depends(get_db),
):
    """Stock per product and location."""
    query = (
        db.query(Stock)
        .join(Product, Product.id == Stock.product_id)
        .join(Location, Location.id == Stock.location_id)
        .options(
            joinedload(Stock.product).joinedload(Product.category),
            joinedload(Stock.location).joinedload(Location.warehouse),
        )
    )
    if product_id:
        query = query.filter(Stock.product_id == product_id)
    if location_id:
        query = query.filter(Stock.location_id == location_id)
    if warehouse_id:
        query = query.filter(Location.warehouse_id == warehouse_id)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if search and search.strip():
        like = f"%{search.strip()}%"
        query = query.filter(or_(Product.name.ilike(like), Product.sku.ilike(like)))
    if not include_zero:
        query = query.filter(Stock.quantity > 0)

    totals = stock_service.product_totals(db)
    rows = []
    for stock in query.order_by(Product.name, Location.warehouse_id, Location.id):
        product, location = stock.product, stock.location
        rows.append(InventoryRow(
            product_id=product.id,
            product_name=product.name,
            sku=product.sku,
            category_name=product.category.name if product.category else None,
            unit=product.unit,
            location_id=location.id,
            location_name=location.name,
            full_name=location.full_name,
            warehouse_id=location.warehouse_id,
            warehouse_name=location.warehouse.name,
            quantity=stock_service.normalize_qty(stock.quantity),
            reorder_level=product.reorder_level,
            stock_status=stock_service.stock_status(totals.get(product.id, 0.0), product.reorder_level),
            updated_at=stock.updated_at,
        ))
    return rows


@router.get("/inventory/{product_id}", response_model=ProductInventoryOut)
def product_inventory(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")

    by_location = [serializers.stock_location_out(row) for row in stock_service.stock_by_location(db, product.id)]
    by_warehouse = {}
    for row in by_location:
        entry = by_warehouse.setdefault(row.warehouse_id, [row.warehouse_name, 0.0])
        entry[1] += row.quantity
    total = stock_service.product_total(db, product.id)

    return ProductInventoryOut(
        product_id=product.id,
        product_name=product.name,
        sku=product.sku,
        unit=product.unit,
        reorder_level=product.reorder_level,
        total_quantity=total,
        stock_status=stock_service.stock_status(total, product.reorder_level),
        by_location=by_location,
        by_warehouse=[
            WarehouseStockOut(warehouse_id=warehouse_id, warehouse_name=name, quantity=stock_service.normalize_qty(qty))
            for warehouse_id, (name, qty) in by_warehouse.items()
        ],
    )


@router.get("/stock-movements", response_model=MovementPage)
def list_stock_movements(
    search: str | None = None,
    operation: Literal["receipt", "delivery", "transfer", "adjustment"] | None = None,
    product_id: int | None = None,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    date_from: datetime | None = Query(None, description="Inclusive start (ISO datetime)"),
    date_to: datetime | None = Query(None, description="Exclusive end (ISO datetime)"),
    sort: Literal["date", "reference", "product", "quantity", "operation"] = "date",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """The stock ledger: every validated stock movement, filterable and sortable."""
    query = db.query(StockMovement).join(Product, Product.id == StockMovement.product_id)
    if search and search.strip():
        like = f"%{search.strip()}%"
        query = query.filter(or_(
            StockMovement.reference.ilike(like),
            StockMovement.note.ilike(like),
            Product.name.ilike(like),
            Product.sku.ilike(like),
        ))
    if operation:
        query = query.filter(StockMovement.operation == operation)
    if product_id:
        query = query.filter(StockMovement.product_id == product_id)
    if location_id:
        query = query.filter(or_(
            StockMovement.source_location_id == location_id,
            StockMovement.destination_location_id == location_id,
        ))
    if warehouse_id:
        warehouse_locations = select(Location.id).where(Location.warehouse_id == warehouse_id)
        query = query.filter(or_(
            StockMovement.source_location_id.in_(warehouse_locations),
            StockMovement.destination_location_id.in_(warehouse_locations),
        ))
    if date_from:
        query = query.filter(StockMovement.created_at >= date_from)
    if date_to:
        query = query.filter(StockMovement.created_at < date_to)

    total = query.count()
    column = MOVEMENT_SORTS[sort]
    direction = (lambda c: c.asc()) if order == "asc" else (lambda c: c.desc())
    movements = (
        query.options(
            joinedload(StockMovement.product),
            joinedload(StockMovement.user),
            joinedload(StockMovement.source_location).joinedload(Location.warehouse),
            joinedload(StockMovement.destination_location).joinedload(Location.warehouse),
        )
        .order_by(direction(column), direction(StockMovement.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return MovementPage(
        items=[serializers.movement_out(movement) for movement in movements],
        total=total,
        page=page,
        page_size=page_size,
    )
