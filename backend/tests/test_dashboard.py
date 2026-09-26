from collections import defaultdict
from datetime import datetime, timedelta, timezone

from app.models import Stock, StockMovement
from app.seed import seed_demo_data
from helpers import receive


def test_dashboard_stats_reflect_live_data(api, layout):
    stats = api.get("/dashboard/stats")
    assert stats["total_products"] == 1
    assert stats["out_of_stock"] == 1
    assert stats["low_stock"] == 0
    assert stats["pending_receipts"] == 0

    api.post("/receipts", {
        "supplier": "X", "location_id": layout.main_store, "items": [{"product_id": layout.steel, "quantity": 5}],
    }, expected=201)
    receive(api, layout.steel, layout.main_store, 20)  # 20 <= reorder level 25
    api.post("/deliveries", {
        "customer": "Y", "location_id": layout.main_store, "items": [{"product_id": layout.steel, "quantity": 1}],
    }, expected=201)
    api.post("/transfers", {
        "source_location_id": layout.main_store, "destination_location_id": layout.rack,
        "items": [{"product_id": layout.steel, "quantity": 1}],
    }, expected=201)

    stats = api.get("/dashboard/stats")
    assert stats["out_of_stock"] == 0
    assert stats["low_stock"] == 1
    assert stats["pending_receipts"] == 1
    assert stats["pending_deliveries"] == 1
    assert stats["pending_transfers"] == 1
    assert stats["warehouses"] == 1 and stats["locations"] == 3

    # Scoped to the rack, where the steel has never been stocked.
    rack_stats = api.get("/dashboard/stats", location_id=layout.rack)
    assert rack_stats["total_products"] == 0
    assert rack_stats["pending_transfers"] == 1  # the rack is the transfer's destination
    assert rack_stats["pending_receipts"] == 0


def test_low_stock_and_recent_operations(api, layout):
    receive(api, layout.steel, layout.main_store, 5)
    low = api.get("/dashboard/low-stock")
    assert [(item["name"], item["on_hand"], item["stock_status"]) for item in low] == [("Steel Sheet", 5, "low_stock")]

    delivery = api.post("/deliveries", {
        "customer": "Acme", "location_id": layout.main_store, "items": [{"product_id": layout.steel, "quantity": 1}],
    }, expected=201)
    recent = api.get("/dashboard/recent-operations")
    assert [(op["document_type"], op["status"]) for op in recent] == [("delivery", "draft"), ("receipt", "done")]
    assert recent[0]["reference"] == delivery["reference"]
    assert recent[0]["partner"] == "Acme"
    assert recent[0]["summary"] == "Steel Sheet"

    assert len(api.get("/dashboard/recent-operations", document_type="receipt")) == 1
    assert len(api.get("/dashboard/recent-operations", status="pending")) == 1
    assert api.get("/dashboard/recent-operations", category_id=layout.category_id + 99) == []


def test_activity_counts_validated_operations_per_day(api, layout):
    receive(api, layout.steel, layout.main_store, 5)
    days = api.get("/dashboard/activity", days=7)
    assert len(days) == 7
    assert days[-1]["date"] == datetime.now(timezone.utc).date().isoformat()
    assert sum(day["receipt"] for day in days) == 1


def test_stock_movement_filters_sorting_and_pagination(api, layout):
    for quantity in (10, 20, 30):
        receive(api, layout.steel, layout.main_store, quantity)
    transfer = api.post("/transfers", {
        "source_location_id": layout.main_store, "destination_location_id": layout.rack,
        "items": [{"product_id": layout.steel, "quantity": 5}],
    }, expected=201)
    api.post(f"/transfers/{transfer['id']}/validate")

    assert api.get("/stock-movements")["total"] == 4
    assert api.get("/stock-movements", operation="transfer")["total"] == 1
    assert api.get("/stock-movements", location_id=layout.rack)["total"] == 1
    assert api.get("/stock-movements", warehouse_id=layout.warehouse_id)["total"] == 4
    assert api.get("/stock-movements", search="tata")["total"] == 3
    assert api.get("/stock-movements", search=transfer["reference"])["total"] == 1

    ascending = api.get("/stock-movements", sort="quantity", order="asc")
    assert [m["quantity"] for m in ascending["items"]] == [5, 10, 20, 30]

    page = api.get("/stock-movements", page=2, page_size=3)
    assert page["total"] == 4 and len(page["items"]) == 1

    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    assert api.get("/stock-movements", date_from=future)["total"] == 0
    assert api.get("/stock-movements", date_to=future)["total"] == 4


def test_global_search(api, layout):
    receive(api, layout.steel, layout.main_store, 5, supplier="JSW Steel")
    results = api.get("/search", q="steel")
    assert [p["name"] for p in results["products"]] == ["Steel Sheet"]
    assert results["operations"][0]["partner"] == "JSW Steel"


def test_seed_data_is_consistent_with_the_ledger(db, client):
    assert seed_demo_data(db) is True
    assert seed_demo_data(db) is False  # only seeds an empty database

    # Every stock row equals the sum of what the ledger moved in and out of it.
    expected = defaultdict(float)
    for movement in db.query(StockMovement):
        if movement.destination_location_id:
            expected[(movement.product_id, movement.destination_location_id)] += movement.quantity
        if movement.source_location_id:
            expected[(movement.product_id, movement.source_location_id)] -= movement.quantity
    for row in db.query(Stock):
        assert round(expected[(row.product_id, row.location_id)], 3) == round(row.quantity, 3)

    login = client.post("/auth/login", json={"email": "admin@stocksense.io", "password": "Demo@1234"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    stats = client.get("/dashboard/stats", headers=headers).json()
    assert stats == {
        "total_products": 9, "in_stock": 5, "low_stock": 2, "out_of_stock": 2,
        "pending_receipts": 2, "pending_deliveries": 2, "pending_transfers": 1,
        "pending_adjustments": 1, "completed_transfers": 2, "warehouses": 2, "locations": 5,
    }
    steel = next(p for p in client.get("/products", headers=headers).json() if p["sku"] == "RM-STL-001")
    assert steel["total_on_hand"] == 0  # the demo starts from an empty steel shelf
