from helpers import quantity_at, receive, total_quantity


def test_create_and_view_product(api, layout):
    product = api.get(f"/products/{layout.steel}")
    assert product["name"] == "Steel Sheet"
    assert product["sku"] == "RM-STL-001"
    assert product["category_name"] == "Raw Materials"
    assert product["unit"] == "kg"
    assert product["total_on_hand"] == 0
    assert product["stock_status"] == "out_of_stock"
    assert product["stock_by_location"] == []


def test_sku_must_be_unique_ignoring_case(api, layout):
    response = api.raw("POST", "/products", json={"name": "Other", "sku": "rm-stl-001"})
    assert response.status_code == 409
    assert "RM-STL-001" in response.json()["detail"]

    other = api.post("/products", {"name": "Other", "sku": "OTHER-1"}, expected=201)
    response = api.raw("PUT", f"/products/{other['id']}", json={"sku": "RM-STL-001"})
    assert response.status_code == 409


def test_initial_stock_is_booked_through_the_ledger(api, layout):
    product = api.post("/products", {
        "name": "Copper Wire", "sku": "CP-CUW-003", "unit": "m", "reorder_level": 100,
        "initial_stock": 400, "initial_location_id": layout.main_store,
    }, expected=201)
    assert product["total_on_hand"] == 400
    assert quantity_at(api, product["id"], layout.main_store) == 400

    ledger = api.get("/stock-movements", product_id=product["id"])
    assert ledger["total"] == 1
    entry = ledger["items"][0]
    assert entry["operation"] == "adjustment"
    assert entry["direction"] == "in"
    assert entry["quantity"] == 400
    assert entry["note"] == "Initial stock"

    adjustments = api.get("/adjustments", product_id=product["id"])
    assert adjustments[0]["status"] == "done"
    assert adjustments[0]["difference"] == 400


def test_initial_stock_needs_a_location(api, layout):
    response = api.raw("POST", "/products", json={"name": "X", "sku": "X-1", "initial_stock": 5})
    assert response.status_code == 422
    assert "location" in response.json()["detail"].lower()


def test_update_product(api, layout):
    updated = api.put(f"/products/{layout.steel}", {
        "name": "Steel Sheet 2mm", "reorder_level": 30, "category_id": None, "description": "Cold rolled",
    })
    assert updated["name"] == "Steel Sheet 2mm"
    assert updated["reorder_level"] == 30
    assert updated["category_id"] is None
    assert updated["description"] == "Cold rolled"
    assert updated["sku"] == "RM-STL-001"


def test_delete_unused_product_but_deactivate_used_one(api, layout):
    unused = api.post("/products", {"name": "Temp", "sku": "TMP-1"}, expected=201)
    result = api.delete(f"/products/{unused['id']}")
    assert result["deleted"] is True
    api.get(f"/products/{unused['id']}", expected=404)

    receive(api, layout.steel, layout.main_store, 10)
    result = api.delete(f"/products/{layout.steel}")
    assert result == {
        "deleted": False,
        "deactivated": True,
        "message": "Steel Sheet has stock history, so it was deactivated instead of deleted.",
    }
    assert api.get(f"/products/{layout.steel}")["is_active"] is False
    assert all(p["id"] != layout.steel for p in api.get("/products"))
    assert any(p["id"] == layout.steel for p in api.get("/products", include_inactive=True))

    # Inactive products can't be used in new operations.
    response = api.raw("POST", "/receipts", json={
        "supplier": "X", "location_id": layout.main_store, "items": [{"product_id": layout.steel, "quantity": 1}],
    })
    assert response.status_code == 400
    assert "Inactive" in response.json()["detail"]


def test_stock_status_follows_reorder_level(api, layout):
    api.put(f"/products/{layout.steel}", {"reorder_level": 10})
    assert api.get(f"/products/{layout.steel}")["stock_status"] == "out_of_stock"

    receive(api, layout.steel, layout.main_store, 8)   # 8 <= 10
    assert api.get(f"/products/{layout.steel}")["stock_status"] == "low_stock"

    receive(api, layout.steel, layout.main_store, 2)   # 10 <= 10 is still a reorder signal
    assert api.get(f"/products/{layout.steel}")["stock_status"] == "low_stock"

    receive(api, layout.steel, layout.main_store, 1)   # 11 > 10
    assert api.get(f"/products/{layout.steel}")["stock_status"] == "in_stock"


def test_product_search_and_filters(api, layout):
    other_category = api.post("/categories", {"name": "Packaging"}, expected=201)
    box = api.post("/products", {
        "name": "Packaging Box", "sku": "PK-BOX-005", "unit": "pcs", "reorder_level": 200,
        "category_id": other_category["id"], "initial_stock": 50, "initial_location_id": layout.dispatch,
    }, expected=201)
    receive(api, layout.steel, layout.main_store, 100)

    def names(**params):
        return sorted(p["name"] for p in api.get("/products", **params))

    assert names(search="steel") == ["Steel Sheet"]
    assert names(search="pk-box") == ["Packaging Box"]
    assert names(category_id=other_category["id"]) == ["Packaging Box"]
    assert names(stock_status="low_stock") == ["Packaging Box"]   # 50 <= 200
    assert names(stock_status="in_stock") == ["Steel Sheet"]
    assert names(location_id=layout.dispatch) == ["Packaging Box"]
    assert names(warehouse_id=layout.warehouse_id) == ["Packaging Box", "Steel Sheet"]

    scoped = api.get("/products", location_id=layout.dispatch)[0]
    assert scoped["on_hand"] == 50 and scoped["total_on_hand"] == 50
    assert box["stock_status"] == "low_stock"


def test_product_detail_shows_stock_by_location(api, layout):
    receive(api, layout.steel, layout.main_store, 100)
    transfer = api.post("/transfers", {
        "source_location_id": layout.main_store, "destination_location_id": layout.rack,
        "items": [{"product_id": layout.steel, "quantity": 30}],
    }, expected=201)
    api.post(f"/transfers/{transfer['id']}/validate")

    detail = api.get(f"/products/{layout.steel}")
    by_location = {row["location_name"]: row["quantity"] for row in detail["stock_by_location"]}
    assert by_location == {"Main Store": 70, "Production Rack": 30}
    assert detail["total_on_hand"] == 100
    assert [m["operation"] for m in detail["recent_movements"]] == ["transfer", "receipt"]


def test_categories_crud_and_safe_delete(api, layout):
    categories = api.get("/categories")
    assert categories[0]["name"] == "Raw Materials"
    assert categories[0]["product_count"] == 1

    duplicate = api.raw("POST", "/categories", json={"name": "raw materials"})
    assert duplicate.status_code == 409

    renamed = api.put(f"/categories/{layout.category_id}", {"name": "Metals", "description": "Steel etc."})
    assert renamed["name"] == "Metals"

    blocked = api.raw("DELETE", f"/categories/{layout.category_id}")
    assert blocked.status_code == 409
    assert "used by 1 product" in blocked.json()["detail"]

    empty = api.post("/categories", {"name": "Spare"}, expected=201)
    api.delete(f"/categories/{empty['id']}", expected=204)


def test_warehouses_and_locations(api, layout):
    warehouses = api.get("/warehouses")
    assert len(warehouses) == 1
    main = warehouses[0]
    assert main["code"] == "MAIN"
    assert [loc["name"] for loc in main["locations"]] == ["Main Store", "Production Rack", "Dispatch"]
    assert main["locations"][0]["full_name"] == "Main Warehouse / Main Store"

    second = api.post("/warehouses", {
        "name": "North Distribution Center", "code": "ndc", "create_default_location": False,
    }, expected=201)
    assert second["code"] == "NDC" and second["locations"] == []
    assert api.raw("POST", "/warehouses", json={"name": "Other", "code": "MAIN"}).status_code == 409

    finished = api.post("/locations", {"warehouse_id": second["id"], "name": "Finished Goods"}, expected=201)
    assert api.raw("POST", "/locations", json={"warehouse_id": second["id"], "name": "finished goods"}).status_code == 409
    renamed = api.put(f"/locations/{finished['id']}", {"name": "FG Bay"})
    assert renamed["full_name"] == "North Distribution Center / FG Bay"
    updated = api.put(f"/warehouses/{second['id']}", {"address": "GT Road"})
    assert updated["address"] == "GT Road"

    # Locations/warehouses with stock history can't be deleted; unused ones can.
    receive(api, layout.steel, layout.main_store, 5)
    assert api.raw("DELETE", f"/locations/{layout.main_store}").status_code == 409
    assert api.raw("DELETE", f"/warehouses/{layout.warehouse_id}").status_code == 409
    api.delete(f"/locations/{finished['id']}", expected=204)
    api.delete(f"/warehouses/{second['id']}", expected=204)

    main = api.get(f"/warehouses/{layout.warehouse_id}")
    assert main["product_count"] == 1
    assert main["locations"][0]["product_count"] == 1
    assert total_quantity(api, layout.steel) == 5


def test_location_must_belong_to_the_chosen_warehouse(api, layout):
    other = api.post("/warehouses", {"name": "Other WH", "code": "OTH"}, expected=201)
    response = api.raw("POST", "/receipts", json={
        "supplier": "X", "warehouse_id": other["id"], "location_id": layout.main_store,
        "items": [{"product_id": layout.steel, "quantity": 1}],
    })
    assert response.status_code == 400
    assert "does not belong" in response.json()["detail"]
