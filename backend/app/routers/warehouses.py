from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import (
    Delivery,
    InventoryAdjustment,
    Location,
    Receipt,
    Stock,
    StockMovement,
    Transfer,
    Warehouse,
)
from ..schemas import (
    LocationCreate,
    LocationOut,
    LocationUpdate,
    WarehouseCreate,
    WarehouseOut,
    WarehouseUpdate,
)
from ..services.auth_service import get_current_user
from ..services.stock_service import normalize_qty

router = APIRouter(prefix="/warehouses", tags=["Warehouses"], dependencies=[Depends(get_current_user)])
locations_router = APIRouter(prefix="/locations", tags=["Locations"], dependencies=[Depends(get_current_user)])

DEFAULT_LOCATION_NAME = "Main Store"


# ---------------------------------------------------------------------- helpers


def _location_stats(db):
    """{location_id: (products in stock, total quantity)}."""
    rows = db.query(
        Stock.location_id,
        func.count(case((Stock.quantity > 0, 1))),
        func.coalesce(func.sum(Stock.quantity), 0),
    ).group_by(Stock.location_id)
    return {location_id: (count, normalize_qty(total)) for location_id, count, total in rows}


def _warehouse_product_counts(db):
    rows = (
        db.query(Location.warehouse_id, func.count(func.distinct(Stock.product_id)))
        .join(Stock, Stock.location_id == Location.id)
        .filter(Stock.quantity > 0)
        .group_by(Location.warehouse_id)
    )
    return dict(rows)


def _location_out(location, stats):
    count, total = stats.get(location.id, (0, 0.0))
    return LocationOut(
        id=location.id,
        name=location.name,
        full_name=location.full_name,
        description=location.description,
        warehouse_id=location.warehouse_id,
        warehouse_name=location.warehouse.name,
        warehouse_code=location.warehouse.code,
        product_count=count,
        total_quantity=total,
        created_at=location.created_at,
    )


def _warehouse_out(warehouse, stats, product_counts):
    locations = [_location_out(location, stats) for location in warehouse.locations]
    return WarehouseOut(
        id=warehouse.id,
        name=warehouse.name,
        code=warehouse.code,
        address=warehouse.address,
        created_at=warehouse.created_at,
        locations=locations,
        location_count=len(locations),
        product_count=product_counts.get(warehouse.id, 0),
        total_quantity=normalize_qty(sum(location.total_quantity for location in locations)),
    )


def _get_warehouse(db, warehouse_id):
    warehouse = (
        db.query(Warehouse)
        .options(joinedload(Warehouse.locations))
        .filter(Warehouse.id == warehouse_id)
        .one_or_none()
    )
    if warehouse is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Warehouse not found.")
    return warehouse


def _get_location(db, location_id):
    location = (
        db.query(Location).options(joinedload(Location.warehouse)).filter(Location.id == location_id).one_or_none()
    )
    if location is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location not found.")
    return location


def _ensure_unique_warehouse(db, name=None, code=None, exclude_id=None):
    for column, value, label in ((Warehouse.name, name, "name"), (Warehouse.code, code, "code")):
        if not value:
            continue
        query = db.query(Warehouse.id).filter(func.lower(column) == value.lower())
        if exclude_id is not None:
            query = query.filter(Warehouse.id != exclude_id)
        if query.first():
            raise HTTPException(status.HTTP_409_CONFLICT, f"A warehouse with {label} '{value}' already exists.")


def _ensure_unique_location(db, warehouse_id, name, exclude_id=None):
    query = db.query(Location.id).filter(
        Location.warehouse_id == warehouse_id, func.lower(Location.name) == name.lower()
    )
    if exclude_id is not None:
        query = query.filter(Location.id != exclude_id)
    if query.first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"This warehouse already has a location named '{name}'.")


def _locations_in_use(db, location_ids):
    """True if any of the locations holds stock or appears in a document or the ledger."""
    if not location_ids:
        return False
    checks = [
        db.query(Stock.id).filter(Stock.location_id.in_(location_ids), Stock.quantity > 0),
        db.query(Receipt.id).filter(Receipt.location_id.in_(location_ids)),
        db.query(Delivery.id).filter(Delivery.location_id.in_(location_ids)),
        db.query(InventoryAdjustment.id).filter(InventoryAdjustment.location_id.in_(location_ids)),
        db.query(Transfer.id).filter(
            or_(Transfer.source_location_id.in_(location_ids), Transfer.destination_location_id.in_(location_ids))
        ),
        db.query(StockMovement.id).filter(
            or_(
                StockMovement.source_location_id.in_(location_ids),
                StockMovement.destination_location_id.in_(location_ids),
            )
        ),
    ]
    return any(query.first() for query in checks)


# ------------------------------------------------------------------- warehouses


@router.get("", response_model=list[WarehouseOut])
def list_warehouses(db: Session = Depends(get_db)):
    stats = _location_stats(db)
    product_counts = _warehouse_product_counts(db)
    warehouses = db.query(Warehouse).options(joinedload(Warehouse.locations)).order_by(Warehouse.id)
    return [_warehouse_out(warehouse, stats, product_counts) for warehouse in warehouses]


@router.post("", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED)
def create_warehouse(data: WarehouseCreate, db: Session = Depends(get_db)):
    _ensure_unique_warehouse(db, name=data.name, code=data.code)
    warehouse = Warehouse(name=data.name, code=data.code, address=data.address)
    if data.create_default_location:
        warehouse.locations.append(Location(name=DEFAULT_LOCATION_NAME))
    db.add(warehouse)
    db.commit()
    return get_warehouse(warehouse.id, db)


@router.get("/{warehouse_id}", response_model=WarehouseOut)
def get_warehouse(warehouse_id: int, db: Session = Depends(get_db)):
    warehouse = _get_warehouse(db, warehouse_id)
    return _warehouse_out(warehouse, _location_stats(db), _warehouse_product_counts(db))


@router.put("/{warehouse_id}", response_model=WarehouseOut)
def update_warehouse(warehouse_id: int, data: WarehouseUpdate, db: Session = Depends(get_db)):
    warehouse = _get_warehouse(db, warehouse_id)
    changes = data.model_dump(exclude_unset=True)
    _ensure_unique_warehouse(db, name=changes.get("name"), code=changes.get("code"), exclude_id=warehouse.id)
    for field in ("name", "code"):
        if changes.get(field):
            setattr(warehouse, field, changes[field])
    if "address" in changes:
        warehouse.address = changes["address"]
    db.commit()
    return get_warehouse(warehouse.id, db)


@router.delete("/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(warehouse_id: int, db: Session = Depends(get_db)):
    warehouse = _get_warehouse(db, warehouse_id)
    location_ids = [location.id for location in warehouse.locations]
    if _locations_in_use(db, location_ids):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{warehouse.name} has stock or operation history and cannot be deleted.",
        )
    if location_ids:
        db.query(Stock).filter(Stock.location_id.in_(location_ids)).delete(synchronize_session=False)
    for location in list(warehouse.locations):
        db.delete(location)
    db.delete(warehouse)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -------------------------------------------------------------------- locations


@locations_router.get("", response_model=list[LocationOut])
def list_locations(warehouse_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Location).options(joinedload(Location.warehouse))
    if warehouse_id:
        query = query.filter(Location.warehouse_id == warehouse_id)
    stats = _location_stats(db)
    return [_location_out(location, stats) for location in query.order_by(Location.warehouse_id, Location.id)]


@locations_router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(data: LocationCreate, db: Session = Depends(get_db)):
    if db.get(Warehouse, data.warehouse_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Warehouse not found.")
    _ensure_unique_location(db, data.warehouse_id, data.name)
    location = Location(warehouse_id=data.warehouse_id, name=data.name, description=data.description)
    db.add(location)
    db.commit()
    return get_location(location.id, db)


@locations_router.get("/{location_id}", response_model=LocationOut)
def get_location(location_id: int, db: Session = Depends(get_db)):
    return _location_out(_get_location(db, location_id), _location_stats(db))


@locations_router.put("/{location_id}", response_model=LocationOut)
def update_location(location_id: int, data: LocationUpdate, db: Session = Depends(get_db)):
    location = _get_location(db, location_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("name"):
        _ensure_unique_location(db, location.warehouse_id, changes["name"], exclude_id=location.id)
        location.name = changes["name"]
    if "description" in changes:
        location.description = changes["description"]
    db.commit()
    return get_location(location.id, db)


@locations_router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(location_id: int, db: Session = Depends(get_db)):
    location = _get_location(db, location_id)
    if _locations_in_use(db, [location.id]):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{location.full_name} has stock or operation history and cannot be deleted.",
        )
    db.query(Stock).filter(Stock.location_id == location.id).delete(synchronize_session=False)
    db.delete(location)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
