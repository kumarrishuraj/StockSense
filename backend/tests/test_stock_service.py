import pytest

from app.models import DELIVERY, RECEIPT, Location, Product, StockMovement, Warehouse
from app.services import stock_service
from app.services.stock_service import InsufficientStockError, StockError


@pytest.fixture
def world(db):
    warehouse = Warehouse(name="Main Warehouse", code="MAIN")
    store, rack = Location(name="Main Store"), Location(name="Production Rack")
    warehouse.locations = [store, rack]
    steel = Product(name="Steel Sheet", sku="RM-STL-001", unit="kg", reorder_level=25)
    db.add_all([warehouse, steel])
    db.commit()
    return steel, store, rack


def test_increase_and_decrease(db, world):
    steel, store, _ = world
    stock_service.increase_stock(db, product=steel, location=store, quantity=100, operation=RECEIPT, reference="R1")
    stock_service.decrease_stock(db, product=steel, location=store, quantity=20, operation=DELIVERY, reference="D1")
    db.commit()
    assert stock_service.get_quantity(db, steel.id, store.id) == 80
    assert db.query(StockMovement).count() == 2


def test_decrease_never_goes_negative(db, world):
    steel, store, _ = world
    stock_service.increase_stock(db, product=steel, location=store, quantity=10, operation=RECEIPT, reference="R1")
    with pytest.raises(InsufficientStockError, match="available 10 kg, requested 10.5 kg"):
        stock_service.decrease_stock(db, product=steel, location=store, quantity=10.5, operation=DELIVERY, reference="D1")
    assert stock_service.get_quantity(db, steel.id, store.id) == 10


def test_transfer_keeps_total_unchanged(db, world):
    steel, store, rack = world
    stock_service.increase_stock(db, product=steel, location=store, quantity=100, operation=RECEIPT, reference="R1")
    movement = stock_service.transfer_stock(db, product=steel, source=store, destination=rack, quantity=30, reference="T1")
    db.commit()
    assert stock_service.get_quantity(db, steel.id, store.id) == 70
    assert stock_service.get_quantity(db, steel.id, rack.id) == 30
    assert stock_service.product_total(db, steel.id) == 100
    assert (movement.source_location_id, movement.destination_location_id) == (store.id, rack.id)


def test_transfer_rejects_same_location_and_shortage(db, world):
    steel, store, rack = world
    with pytest.raises(StockError, match="must be different"):
        stock_service.transfer_stock(db, product=steel, source=store, destination=store, quantity=1, reference="T1")
    with pytest.raises(InsufficientStockError):
        stock_service.transfer_stock(db, product=steel, source=store, destination=rack, quantity=1, reference="T2")


def test_adjust_sets_counted_quantity(db, world):
    steel, store, _ = world
    stock_service.increase_stock(db, product=steel, location=store, quantity=10, operation=RECEIPT, reference="R1")
    movement, system, difference = stock_service.adjust_stock(
        db, product=steel, location=store, counted_quantity=7, reference="A1"
    )
    assert (system, difference) == (10, -3)
    assert movement.quantity == 3 and movement.source_location_id == store.id
    assert stock_service.get_quantity(db, steel.id, store.id) == 7

    movement, system, difference = stock_service.adjust_stock(
        db, product=steel, location=store, counted_quantity=7, reference="A2"
    )
    assert movement is None and difference == 0


def test_zero_and_negative_quantities_are_rejected(db, world):
    steel, store, _ = world
    for quantity in (0, -1, 0.0001):
        with pytest.raises(StockError, match="greater than zero"):
            stock_service.increase_stock(db, product=steel, location=store, quantity=quantity,
                                         operation=RECEIPT, reference="R")


def test_ensure_available_lists_every_shortage(db, world):
    steel, store, rack = world
    stock_service.increase_stock(db, product=steel, location=store, quantity=5, operation=RECEIPT, reference="R1")
    with pytest.raises(InsufficientStockError) as error:
        stock_service.ensure_available(db, [(steel, store, 4), (steel, store, 4), (steel, rack, 1)])
    message = str(error.value)
    assert "Main Store: available 5 kg, requested 8 kg" in message
    assert "Production Rack: available 0 kg, requested 1 kg" in message


@pytest.mark.parametrize("quantity, status", [
    (0, "out_of_stock"),
    (8, "low_stock"),
    (10, "low_stock"),
    (10.5, "in_stock"),
])
def test_stock_status(quantity, status):
    assert stock_service.stock_status(quantity, reorder_level=10) == status
