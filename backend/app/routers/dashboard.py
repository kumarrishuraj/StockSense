from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from .. import serializers
from ..database import get_db
from ..models import Product
from ..schemas import (
    ActivityDay,
    DashboardStats,
    LowStockItem,
    RecentOperation,
    SearchResults,
    StockSummary,
)
from ..services import dashboard_service, stock_service
from ..services.auth_service import get_current_user
from .common import DocumentStatus

router = APIRouter(prefix="/dashboard", tags=["Dashboard"], dependencies=[Depends(get_current_user)])
search_router = APIRouter(tags=["Search"], dependencies=[Depends(get_current_user)])

DocumentType = Literal["receipt", "delivery", "transfer", "adjustment"]


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(
    warehouse_id: int | None = None,
    location_id: int | None = None,
    category_id: int | None = None,
    db: Session = Depends(get_db),
):
    return dashboard_service.stats(db, warehouse_id, location_id, category_id)


@router.get("/recent-operations", response_model=list[RecentOperation])
def recent_operations(
    document_type: DocumentType | None = None,
    status: DocumentStatus | None = None,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    category_id: int | None = None,
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return dashboard_service.recent_operations(
        db, document_type, status, warehouse_id, location_id, category_id, limit=limit
    )


@router.get("/low-stock", response_model=list[LowStockItem])
def low_stock(
    warehouse_id: int | None = None,
    location_id: int | None = None,
    category_id: int | None = None,
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return dashboard_service.low_stock(db, warehouse_id, location_id, category_id, limit)


@router.get("/stock-summary", response_model=StockSummary)
def stock_summary(
    warehouse_id: int | None = None,
    location_id: int | None = None,
    category_id: int | None = None,
    db: Session = Depends(get_db),
):
    return dashboard_service.stock_summary(db, warehouse_id, location_id, category_id)


@router.get("/activity", response_model=list[ActivityDay])
def activity(
    days: int = Query(14, ge=1, le=90),
    tz_offset: int = Query(0, ge=-840, le=840, description="JavaScript Date.getTimezoneOffset()"),
    warehouse_id: int | None = None,
    location_id: int | None = None,
    db: Session = Depends(get_db),
):
    return dashboard_service.activity(db, days, tz_offset, warehouse_id, location_id)


@search_router.get("/search", response_model=SearchResults)
def search(q: str = Query(..., min_length=1, max_length=100), db: Session = Depends(get_db)):
    """Global search across products (name/SKU) and operations (reference, partner, product)."""
    like = f"%{q.strip()}%"
    products = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.is_active.is_(True), or_(Product.name.ilike(like), Product.sku.ilike(like)))
        .order_by(Product.name)
        .limit(6)
        .all()
    )
    totals = stock_service.product_totals(db, product_ids=[product.id for product in products])
    return SearchResults(
        products=[serializers.product_out(product, totals.get(product.id, 0.0)) for product in products],
        operations=dashboard_service.recent_operations(db, search=q.strip(), limit=6),
    )
