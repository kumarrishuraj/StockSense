"""Demo data for StockSense.

    python -m app.seed           # seed an empty database
    python -m app.seed --reset   # wipe everything and seed again

Stock is created by running real receipts, transfers, deliveries and adjustments
through operations_service, so the ledger always matches the stock levels.
Steel Sheet starts at 0 kg on purpose: the demo script receives it from scratch.
"""
import argparse
from datetime import date, datetime, time, timedelta, timezone

from .database import Base, SessionLocal, engine
from .models import (
    Category,
    Delivery,
    Location,
    Product,
    StockMovement,
    User,
    Warehouse,
)
from .schemas import AdjustmentCreate, DeliveryCreate, LineIn, ReceiptCreate, TransferCreate
from .services import operations_service
from .services.auth_service import hash_password

DEMO_PASSWORD = "Demo@1234"
DEMO_USERS = [
    ("Aditi Rao", "admin@stocksense.io", "manager"),
    ("Rohan Mehta", "staff@stocksense.io", "staff"),
]

CATEGORIES = [
    ("Raw Materials", "Metals and base materials used in production"),
    ("Finished Goods", "Assembled products ready for dispatch"),
    ("Components", "Parts consumed by the assembly line"),
    ("Packaging", "Boxes, tape and other packing supplies"),
]

WAREHOUSES = [
    ("Main Warehouse", "MAIN", "Plot 14, Focal Point, Jalandhar", ["Main Store", "Production Rack", "Dispatch"]),
    ("North Distribution Center", "NDC", "GT Road, Phagwara", ["Main Store", "Finished Goods"]),
]

# sku, name, category, unit, reorder level, description
PRODUCTS = [
    ("RM-STL-001", "Steel Sheet", "Raw Materials", "kg", 25, "Cold-rolled steel sheet, 2 mm"),
    ("RM-ALU-002", "Aluminum Rod", "Raw Materials", "kg", 40, "6061 aluminium rod, 20 mm"),
    ("CP-CUW-003", "Copper Wire", "Components", "m", 100, "Enamelled copper winding wire"),
    ("FG-MTR-004", "Motor Assembly", "Finished Goods", "units", 10, "0.5 HP single-phase motor"),
    ("PK-BOX-005", "Packaging Box", "Packaging", "pcs", 200, "5-ply corrugated box, 40x30x30 cm"),
    ("CP-BRG-006", "Ball Bearing 6204", "Components", "pcs", 50, "Deep-groove ball bearing"),
    ("FG-PMP-007", "Water Pump Unit", "Finished Goods", "units", 5, "1 HP domestic water pump"),
    ("PK-TPE-008", "Packing Tape", "Packaging", "rolls", 30, "48 mm BOPP tape"),
    ("CP-SEL-009", "Hydraulic Seal Kit", "Components", "pcs", 20, "Seal kit for 40 mm cylinders"),
]


def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _at(days_ago, hour):
    """A UTC timestamp `days_ago` days back, at roughly `hour` o'clock India time."""
    day = datetime.now(timezone.utc).date() - timedelta(days=days_ago)
    return datetime.combine(day, time(hour=hour), tzinfo=timezone.utc) - timedelta(hours=5, minutes=30)


def _backdate(db, document, when):
    """Make a validated seed document look like it happened `when`."""
    db.flush()  # the ledger rows must be in the database before we re-date them
    document.scheduled_date = when.date()
    document.created_at = when - timedelta(hours=3)
    document.updated_at = when
    document.validated_at = when
    if isinstance(document, Delivery):
        document.picked_at = when - timedelta(hours=2)
        document.packed_at = when - timedelta(hours=1)
    db.query(StockMovement).filter(StockMovement.reference == document.reference).update(
        {"created_at": when}, synchronize_session=False
    )


def seed_demo_data(db):
    """Load the demo dataset. Returns False (and does nothing) if users already exist."""
    if db.query(User.id).first():
        return False

    manager, staff = [
        User(name=name, email=email, role=role, password_hash=hash_password(DEMO_PASSWORD))
        for name, email, role in DEMO_USERS
    ]
    db.add_all([manager, staff])

    categories = {name: Category(name=name, description=description) for name, description in CATEGORIES}
    db.add_all(categories.values())

    locations = {}
    for name, code, address, location_names in WAREHOUSES:
        warehouse = Warehouse(name=name, code=code, address=address)
        warehouse.locations = [Location(name=location_name) for location_name in location_names]
        db.add(warehouse)
        for location in warehouse.locations:
            locations[(code, location.name)] = location

    products = {}
    for sku, name, category, unit, reorder_level, description in PRODUCTS:
        products[sku] = Product(
            sku=sku, name=name, category=categories[category], unit=unit,
            reorder_level=reorder_level, description=description,
        )
    db.add_all(products.values())
    db.flush()

    def loc(code, name):
        return locations[(code, name)].id

    def lines(*pairs):
        return [LineIn(product_id=products[sku].id, quantity=quantity) for sku, quantity in pairs]

    ops = operations_service

    # ---- history: validated operations over the last two weeks -------------
    receipts = [
        (12, "Hindalco Industries", ("MAIN", "Main Store"), [("RM-ALU-002", 150)]),
        (11, "Polycab Wires", ("MAIN", "Main Store"), [("CP-CUW-003", 400), ("CP-BRG-006", 120)]),
        (10, "Smurfit Packaging", ("MAIN", "Main Store"), [("PK-BOX-005", 600), ("PK-TPE-008", 40)]),
        (9, "Assembly Line 2", ("NDC", "Finished Goods"), [("FG-MTR-004", 30), ("FG-PMP-007", 12)]),
    ]
    for days_ago, supplier, (code, name), items in receipts:
        receipt = ops.create_receipt(db, ReceiptCreate(
            supplier=supplier, location_id=loc(code, name), items=lines(*items),
        ), manager)
        ops.validate_receipt(db, receipt, manager)
        _backdate(db, receipt, _at(days_ago, 10))

    transfers = [
        (8, ("MAIN", "Main Store"), ("MAIN", "Production Rack"), [("RM-ALU-002", 60), ("CP-CUW-003", 250)]),
        (6, ("MAIN", "Main Store"), ("NDC", "Main Store"), [("PK-BOX-005", 150)]),
    ]
    for days_ago, source, destination, items in transfers:
        transfer = ops.create_transfer(db, TransferCreate(
            source_location_id=loc(*source), destination_location_id=loc(*destination), items=lines(*items),
        ), staff)
        ops.validate_transfer(db, transfer, staff)
        _backdate(db, transfer, _at(days_ago, 12))

    deliveries = [
        (5, "Crompton Greaves", ("NDC", "Finished Goods"), [("FG-MTR-004", 18), ("FG-PMP-007", 8)]),
        (3, "Bajaj Electricals", ("MAIN", "Main Store"), [("PK-BOX-005", 420)]),
    ]
    for days_ago, customer, (code, name), items in deliveries:
        delivery = ops.create_delivery(db, DeliveryCreate(
            customer=customer, location_id=loc(code, name), items=lines(*items),
        ), staff)
        ops.pick_delivery(db, delivery, staff)
        ops.pack_delivery(db, delivery, staff)
        ops.validate_delivery(db, delivery, staff)
        _backdate(db, delivery, _at(days_ago, 15))

    adjustment = ops.create_adjustment(db, AdjustmentCreate(
        product_id=products["CP-CUW-003"].id, location_id=loc("MAIN", "Production Rack"),
        counted_quantity=245, reason="Damaged during handling",
    ), manager)
    ops.validate_adjustment(db, adjustment, manager)
    _backdate(db, adjustment, _at(2, 17))

    # ---- open work: what the team still has to do ---------------------------
    today = date.today()
    ops.create_receipt(db, ReceiptCreate(
        supplier="Hindalco Industries", location_id=loc("MAIN", "Main Store"),
        scheduled_date=today + timedelta(days=1), items=lines(("RM-ALU-002", 100)),
    ), manager)
    ops.create_receipt(db, ReceiptCreate(
        supplier="Smurfit Packaging", location_id=loc("NDC", "Main Store"),
        scheduled_date=today + timedelta(days=2), items=lines(("PK-BOX-005", 500)),
    ), manager)
    ops.create_delivery(db, DeliveryCreate(
        customer="Tata Motors", location_id=loc("MAIN", "Production Rack"),
        scheduled_date=today, items=lines(("RM-ALU-002", 20)),
    ), staff)
    picked = ops.create_delivery(db, DeliveryCreate(
        customer="Havells India", location_id=loc("NDC", "Finished Goods"),
        scheduled_date=today + timedelta(days=1), items=lines(("FG-MTR-004", 5)),
    ), staff)
    ops.pick_delivery(db, picked, staff)
    ops.create_transfer(db, TransferCreate(
        source_location_id=loc("MAIN", "Main Store"), destination_location_id=loc("MAIN", "Dispatch"),
        scheduled_date=today, items=lines(("CP-BRG-006", 40)),
    ), staff)
    ops.create_adjustment(db, AdjustmentCreate(
        product_id=products["PK-TPE-008"].id, location_id=loc("MAIN", "Main Store"),
        counted_quantity=38, reason="Cycle count",
    ), staff)

    db.commit()
    return True


def main():
    parser = argparse.ArgumentParser(description="Load StockSense demo data.")
    parser.add_argument("--reset", action="store_true", help="drop all tables and reseed from scratch")
    args = parser.parse_args()

    if args.reset:
        reset_database()
    else:
        Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        if seed_demo_data(db):
            print("Demo data loaded.")
            for name, email, role in DEMO_USERS:
                print(f"  {role:<8} {email} / {DEMO_PASSWORD}  ({name})")
        else:
            print("Database already has users; nothing to do. Use --reset to start over.")


if __name__ == "__main__":
    main()
