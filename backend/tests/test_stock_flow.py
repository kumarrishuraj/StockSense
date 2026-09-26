from helpers import quantity_at, receive, total_quantity


def test_demo_flow_end_to_end(api, layout):
    """The hackathon demo script: receive 100 kg, transfer 30, deliver 20, count 7."""
    steel, store, rack = layout.steel, layout.main_store, layout.rack
    assert total_quantity(api, steel) == 0

    # Step 3-4: receive 100 kg of steel and validate.
    receipt = api.post("/receipts", {
        "supplier": "Tata Steel", "warehouse_id": layout.warehouse_id, "location_id": store,
        "scheduled_date": "2026-09-26", "items": [{"product_id": steel, "quantity": 100}],
    }, expected=201)
    assert receipt["status"] == "draft"
    assert receipt["reference"] == f"MAIN/IN/{receipt['id']:05d}"
    assert total_quantity(api, steel) == 0  # drafts don't touch stock

    receipt = api.post(f"/receipts/{receipt['id']}/validate")
    assert receipt["status"] == "done"
    assert receipt["validated_by_name"] == "Test Manager"
    assert quantity_at(api, steel, store) == 100
    assert total_quantity(api, steel) == 100

    # Step 5: transfer 30 kg Main Store -> Production Rack. Total stays 100.
    transfer = api.post("/transfers", {
        "source_location_id": store, "destination_location_id": rack,
        "items": [{"product_id": steel, "quantity": 30}],
    }, expected=201)
    assert transfer["items"][0]["available"] == 100
    api.post(f"/transfers/{transfer['id']}/validate")
    assert quantity_at(api, steel, store) == 70
    assert quantity_at(api, steel, rack) == 30
    assert total_quantity(api, steel) == 100

    # Step 6-7: deliver 20 kg from the Production Rack: pick -> pack -> validate.
    delivery = api.post("/deliveries", {
        "customer": "Kirloskar Pumps", "location_id": rack,
        "items": [{"product_id": steel, "quantity": 20}],
    }, expected=201)
    assert delivery["is_available"] is True
    assert api.post(f"/deliveries/{delivery['id']}/pick")["status"] == "picked"
    assert api.post(f"/deliveries/{delivery['id']}/pack")["status"] == "packed"
    assert quantity_at(api, steel, rack) == 30  # nothing leaves before validation
    assert api.post(f"/deliveries/{delivery['id']}/validate")["status"] == "done"
    assert quantity_at(api, steel, rack) == 10
    assert total_quantity(api, steel) == 80

    # Step 8: physical count finds 7 kg on the rack -> adjustment of -3 kg.
    adjustment = api.post("/adjustments", {
        "product_id": steel, "warehouse_id": layout.warehouse_id, "location_id": rack,
        "counted_quantity": 7, "reason": "Physical count",
    }, expected=201)
    assert adjustment["system_quantity"] == 10
    assert adjustment["difference"] == -3
    adjustment = api.post(f"/adjustments/{adjustment['id']}/validate")
    assert adjustment["status"] == "done"
    assert quantity_at(api, steel, rack) == 7
    assert quantity_at(api, steel, store) == 70
    assert total_quantity(api, steel) == 77

    # Step 9: the ledger shows all four operations, newest first.
    ledger = api.get("/stock-movements", product_id=steel)
    assert ledger["total"] == 4
    rows = [(m["operation"], m["quantity"], m["direction"], m["source_name"], m["destination_name"])
            for m in ledger["items"]]
    assert rows == [
        ("adjustment", 3, "out", "Main Warehouse / Production Rack", "Inventory adjustment"),
        ("delivery", 20, "out", "Main Warehouse / Production Rack", "Customer: Kirloskar Pumps"),
        ("transfer", 30, "internal", "Main Warehouse / Main Store", "Main Warehouse / Production Rack"),
        ("receipt", 100, "in", "Supplier: Tata Steel", "Main Warehouse / Main Store"),
    ]
    assert all(m["user_name"] == "Test Manager" and m["sku"] == "RM-STL-001" for m in ledger["items"])


def test_receipt_cannot_be_validated_twice(api, layout):
    receipt = receive(api, layout.steel, layout.main_store, 100)
    response = api.raw("POST", f"/receipts/{receipt['id']}/validate")
    assert response.status_code == 409
    assert "cannot be validated while it is Done" in response.json()["detail"]
    assert total_quantity(api, layout.steel) == 100
    assert api.get("/stock-movements")["total"] == 1


def test_delivery_steps_must_happen_in_order(api, layout):
    receive(api, layout.steel, layout.main_store, 50)
    delivery = api.post("/deliveries", {
        "customer": "Acme", "location_id": layout.main_store, "items": [{"product_id": layout.steel, "quantity": 5}],
    }, expected=201)

    for step in ("pack", "validate"):
        response = api.raw("POST", f"/deliveries/{delivery['id']}/{step}")
        assert response.status_code == 409
        assert "Draft → Pick → Pack → Validate" in response.json()["detail"]

    api.post(f"/deliveries/{delivery['id']}/pick")
    assert api.raw("POST", f"/deliveries/{delivery['id']}/validate").status_code == 409
    assert api.raw("POST", f"/deliveries/{delivery['id']}/pick").status_code == 409
    assert total_quantity(api, layout.steel) == 50


def test_delivery_cannot_take_more_than_available(api, layout):
    receive(api, layout.steel, layout.main_store, 100)
    delivery = api.post("/deliveries", {
        "customer": "Acme", "location_id": layout.main_store,
        "items": [{"product_id": layout.steel, "quantity": 120}],
    }, expected=201)
    assert delivery["is_available"] is False
    assert delivery["items"][0]["available"] == 100

    response = api.raw("POST", f"/deliveries/{delivery['id']}/pick")
    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Insufficient stock. Steel Sheet at Main Warehouse / Main Store: available 100 kg, requested 120 kg."
    )
    assert api.get(f"/deliveries/{delivery['id']}")["status"] == "draft"


def test_stock_consumed_after_picking_is_caught_at_validation(api, layout):
    receive(api, layout.steel, layout.main_store, 30)
    first = api.post("/deliveries", {
        "customer": "A", "location_id": layout.main_store, "items": [{"product_id": layout.steel, "quantity": 20}],
    }, expected=201)
    second = api.post("/deliveries", {
        "customer": "B", "location_id": layout.main_store, "items": [{"product_id": layout.steel, "quantity": 20}],
    }, expected=201)
    for delivery in (first, second):
        api.post(f"/deliveries/{delivery['id']}/pick")
        api.post(f"/deliveries/{delivery['id']}/pack")

    api.post(f"/deliveries/{first['id']}/validate")
    response = api.raw("POST", f"/deliveries/{second['id']}/validate")
    assert response.status_code == 400
    assert "available 10 kg, requested 20 kg" in response.json()["detail"]
    assert api.get(f"/deliveries/{second['id']}")["status"] == "packed"
    assert total_quantity(api, layout.steel) == 10


def test_failed_multi_line_validation_changes_nothing(api, layout):
    """If one line is short, no line is applied and no ledger row is written."""
    wire = api.post("/products", {
        "name": "Copper Wire", "sku": "CP-CUW-003", "unit": "m",
        "initial_stock": 5, "initial_location_id": layout.main_store,
    }, expected=201)
    receive(api, layout.steel, layout.main_store, 100)
    ledger_before = api.get("/stock-movements")["total"]

    transfer = api.post("/transfers", {
        "source_location_id": layout.main_store, "destination_location_id": layout.rack,
        "items": [
            {"product_id": layout.steel, "quantity": 40},
            {"product_id": wire["id"], "quantity": 50},
        ],
    }, expected=201)
    response = api.raw("POST", f"/transfers/{transfer['id']}/validate")
    assert response.status_code == 400
    assert "Copper Wire" in response.json()["detail"]

    assert quantity_at(api, layout.steel, layout.main_store) == 100
    assert quantity_at(api, layout.steel, layout.rack) == 0
    assert api.get(f"/transfers/{transfer['id']}")["status"] == "draft"
    assert api.get("/stock-movements")["total"] == ledger_before


def test_transfer_between_warehouses_keeps_total(api, layout):
    receive(api, layout.steel, layout.main_store, 60)
    other = api.post("/warehouses", {"name": "North DC", "code": "NDC"}, expected=201)
    other_store = other["locations"][0]["id"]

    transfer = api.post("/transfers", {
        "source_location_id": layout.main_store, "destination_location_id": other_store,
        "items": [{"product_id": layout.steel, "quantity": 25.5}],
    }, expected=201)
    assert transfer["reference"].startswith("MAIN/INT/")
    assert transfer["destination_location"]["warehouse_name"] == "North DC"
    api.post(f"/transfers/{transfer['id']}/validate")

    stock = api.get(f"/inventory/{layout.steel}")
    assert {w["warehouse_name"]: w["quantity"] for w in stock["by_warehouse"]} == {
        "Main Warehouse": 34.5, "North DC": 25.5,
    }
    assert stock["total_quantity"] == 60


def test_invalid_transfers_are_rejected(api, layout):
    receive(api, layout.steel, layout.main_store, 10)
    same = api.raw("POST", "/transfers", json={
        "source_location_id": layout.main_store, "destination_location_id": layout.main_store,
        "items": [{"product_id": layout.steel, "quantity": 1}],
    })
    assert same.status_code == 422
    assert "must be different" in same.json()["detail"]

    too_much = api.post("/transfers", {
        "source_location_id": layout.main_store, "destination_location_id": layout.rack,
        "items": [{"product_id": layout.steel, "quantity": 11}],
    }, expected=201)
    assert api.raw("POST", f"/transfers/{too_much['id']}/validate").status_code == 400
    assert quantity_at(api, layout.steel, layout.main_store) == 10


def test_quantities_must_be_positive(api, layout):
    for quantity in (0, -5):
        response = api.raw("POST", "/receipts", json={
            "supplier": "X", "location_id": layout.main_store,
            "items": [{"product_id": layout.steel, "quantity": quantity}],
        })
        assert response.status_code == 422
        assert response.json()["detail"] == "Line 1 quantity: Quantity must be greater than zero"

    no_lines = api.raw("POST", "/receipts", json={"supplier": "X", "location_id": layout.main_store, "items": []})
    assert no_lines.status_code == 422
    assert no_lines.json()["detail"] == "Add at least one product line"

    negative_count = api.raw("POST", "/adjustments", json={
        "product_id": layout.steel, "location_id": layout.main_store, "counted_quantity": -1, "reason": "x",
    })
    assert negative_count.status_code == 422


def test_duplicate_product_lines_are_rejected(api, layout):
    response = api.raw("POST", "/receipts", json={
        "supplier": "X", "location_id": layout.main_store,
        "items": [{"product_id": layout.steel, "quantity": 1}, {"product_id": layout.steel, "quantity": 2}],
    })
    assert response.status_code == 422
    assert "only once per document" in response.json()["detail"]


def test_missing_product_or_location_returns_404(api, layout):
    missing_product = api.raw("POST", "/receipts", json={
        "supplier": "X", "location_id": layout.main_store, "items": [{"product_id": 999, "quantity": 1}],
    })
    assert missing_product.status_code == 404
    missing_location = api.raw("POST", "/deliveries", json={
        "customer": "X", "location_id": 999, "items": [{"product_id": layout.steel, "quantity": 1}],
    })
    assert missing_location.status_code == 404
    assert api.raw("GET", "/receipts/999").status_code == 404


def test_cancelled_documents_cannot_be_validated(api, layout):
    receipt = api.post("/receipts", {
        "supplier": "X", "location_id": layout.main_store, "items": [{"product_id": layout.steel, "quantity": 5}],
    }, expected=201)
    assert api.post(f"/receipts/{receipt['id']}/cancel")["status"] == "cancelled"
    assert api.raw("POST", f"/receipts/{receipt['id']}/validate").status_code == 409
    assert api.raw("POST", f"/receipts/{receipt['id']}/cancel").status_code == 409
    assert total_quantity(api, layout.steel) == 0


def test_adjustment_uses_stock_at_validation_time(api, layout):
    receive(api, layout.steel, layout.rack, 10)
    adjustment = api.post("/adjustments", {
        "product_id": layout.steel, "location_id": layout.rack, "counted_quantity": 12, "reason": "Recount",
    }, expected=201)
    assert adjustment["difference"] == 2

    receive(api, layout.steel, layout.rack, 5)  # stock moves on while the count is a draft
    assert api.get(f"/adjustments/{adjustment['id']}")["current_quantity"] == 15

    adjustment = api.post(f"/adjustments/{adjustment['id']}/validate")
    assert adjustment["system_quantity"] == 15
    assert adjustment["difference"] == -3
    assert quantity_at(api, layout.steel, layout.rack) == 12


def test_adjustment_matching_the_system_writes_no_ledger_row(api, layout):
    receive(api, layout.steel, layout.rack, 10)
    adjustment = api.post("/adjustments", {
        "product_id": layout.steel, "location_id": layout.rack, "counted_quantity": 10, "reason": "Cycle count",
    }, expected=201)
    api.post(f"/adjustments/{adjustment['id']}/validate")
    assert api.get("/stock-movements", operation="adjustment")["total"] == 0
    assert quantity_at(api, layout.steel, layout.rack) == 10


def test_custom_references_must_be_unique(api, layout):
    api.post("/receipts", {
        "supplier": "X", "reference": "PO-7788", "location_id": layout.main_store,
        "items": [{"product_id": layout.steel, "quantity": 1}],
    }, expected=201)
    response = api.raw("POST", "/receipts", json={
        "supplier": "Y", "reference": "PO-7788", "location_id": layout.main_store,
        "items": [{"product_id": layout.steel, "quantity": 1}],
    })
    assert response.status_code == 409


def test_fractional_quantities_stay_exact(api, layout):
    for quantity in (0.1, 0.2, 0.3):
        receive(api, layout.steel, layout.main_store, quantity)
    assert quantity_at(api, layout.steel, layout.main_store) == 0.6

    delivery = api.post("/deliveries", {
        "customer": "A", "location_id": layout.main_store, "items": [{"product_id": layout.steel, "quantity": 0.6}],
    }, expected=201)
    for step in ("pick", "pack", "validate"):
        api.post(f"/deliveries/{delivery['id']}/{step}")
    assert quantity_at(api, layout.steel, layout.main_store) == 0
