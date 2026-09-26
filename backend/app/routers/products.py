from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from .. import serializers
from ..database import get_db
from ..models import (
    Category,
    DeliveryItem,
    InventoryAdjustment,
    Product,
    ReceiptItem,
    Stock,
    StockMovement,
    TransferItem,
    User,
)
from ..schemas import ProductCreate, ProductDeleteResult, ProductDetailOut, ProductOut, ProductUpdate
from ..services import operations_service, stock_service
from ..services.auth_service import get_current_user

router = APIRouter(prefix="/products", tags=["Products"], dependencies=[Depends(get_current_user)])

StockStatus = Literal["in_stock", "low_stock", "out_of_stock"]


def _get(db, product_id):
    product = (
        db.query(Product).options(joinedload(Product.category)).filter(Product.id == product_id).one_or_none()
    )
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
    return product


def _ensure_unique_sku(db, sku, exclude_id=None):
    query = db.query(Product.id).filter(func.upper(Product.sku) == sku.upper())
    if exclude_id is not None:
        query = query.filter(Product.id != exclude_id)
    if query.first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"SKU '{sku}' is already used by another product.")


def _ensure_category(db, category_id):
    if category_id is not None and db.get(Category, category_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found.")


@router.get("", response_model=list[ProductOut])
def list_products(
    search: str | None = None,
    category_id: int | None = None,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    stock_status: StockStatus | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    """Products with live stock. A warehouse/location filter keeps only products
    that are currently in stock there and reports that quantity as on_hand."""
    query = db.query(Product).options(joinedload(Product.category))
    if not include_inactive:
        query = query.filter(Product.is_active.is_(True))
    if search and search.strip():
        like = f"%{search.strip()}%"
        query = query.filter(or_(Product.name.ilike(like), Product.sku.ilike(like)))
    if category_id:
        query = query.filter(Product.category_id == category_id)

    totals = stock_service.product_totals(db)
    scoped = None
    if warehouse_id or location_id:
        scoped = stock_service.product_totals(db, warehouse_id=warehouse_id, location_id=location_id)

    results = []
    for product in query.order_by(Product.name):
        if scoped is not None and scoped.get(product.id, 0) <= 0:
            continue
        total = totals.get(product.id, 0.0)
        out = serializers.product_out(product, total, None if scoped is None else scoped[product.id])
        if stock_status and out.stock_status != stock_status:
            continue
        results.append(out)
    return results


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_unique_sku(db, data.sku)
    _ensure_category(db, data.category_id)
    location = None
    if data.initial_stock > 0:
        location = operations_service.get_location(db, data.initial_location_id)

    product = Product(
        name=data.name,
        sku=data.sku,
        category_id=data.category_id,
        unit=data.unit,
        reorder_level=data.reorder_level,
        description=data.description,
        is_active=data.is_active,
    )
    db.add(product)
    db.flush()
    if location is not None:
        operations_service.record_initial_stock(db, product, location, data.initial_stock, user)
    db.commit()

    product = _get(db, product.id)
    return serializers.product_out(product, stock_service.product_total(db, product.id))


@router.get("/{product_id}", response_model=ProductDetailOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = _get(db, product_id)
    total = stock_service.product_total(db, product.id)
    stock_rows = stock_service.stock_by_location(db, product.id)
    movements = (
        db.query(StockMovement)
        .filter(StockMovement.product_id == product.id)
        .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
        .limit(10)
    )
    return ProductDetailOut(
        **serializers.product_out(product, total).model_dump(),
        stock_by_location=[serializers.stock_location_out(row) for row in stock_rows],
        recent_movements=[serializers.movement_out(movement) for movement in movements],
    )


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db)):
    product = _get(db, product_id)
    changes = data.model_dump(exclude_unset=True)

    if changes.get("sku") and changes["sku"] != product.sku:
        _ensure_unique_sku(db, changes["sku"], exclude_id=product.id)
    if "category_id" in changes:
        _ensure_category(db, changes["category_id"])

    for field in ("name", "sku", "unit", "reorder_level", "is_active"):
        if changes.get(field) is not None:
            setattr(product, field, changes[field])
    for field in ("category_id", "description"):  # these may be cleared
        if field in changes:
            setattr(product, field, changes[field])

    db.commit()
    product = _get(db, product.id)
    return serializers.product_out(product, stock_service.product_total(db, product.id))


@router.delete("/{product_id}", response_model=ProductDeleteResult)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Delete a product that was never used; otherwise deactivate it to keep history intact."""
    product = _get(db, product_id)
    used = any(
        db.query(model.id).filter(model.product_id == product.id).first()
        for model in (StockMovement, ReceiptItem, DeliveryItem, TransferItem, InventoryAdjustment)
    ) or db.query(Stock.id).filter(Stock.product_id == product.id, Stock.quantity > 0).first()

    if used:
        product.is_active = False
        db.commit()
        return ProductDeleteResult(
            deleted=False,
            deactivated=True,
            message=f"{product.name} has stock history, so it was deactivated instead of deleted.",
        )

    db.query(Stock).filter(Stock.product_id == product.id).delete(synchronize_session=False)
    db.delete(product)
    db.commit()
    return ProductDeleteResult(deleted=True, deactivated=False, message=f"{product.name} was deleted.")
