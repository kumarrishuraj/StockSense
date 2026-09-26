"""Shared test helpers for driving the API."""


def quantity_at(api, product_id, location_id):
    rows = api.get("/inventory", product_id=product_id, location_id=location_id, include_zero=True)
    return rows[0]["quantity"] if rows else 0.0


def total_quantity(api, product_id):
    return api.get(f"/inventory/{product_id}")["total_quantity"]


def receive(api, product_id, location_id, quantity, supplier="Tata Steel"):
    receipt = api.post("/receipts", {
        "supplier": supplier, "location_id": location_id,
        "items": [{"product_id": product_id, "quantity": quantity}],
    }, expected=201)
    return api.post(f"/receipts/{receipt['id']}/validate")
