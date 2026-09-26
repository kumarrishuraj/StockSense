import os
import tempfile
from pathlib import Path
from types import SimpleNamespace

# Point the app at a throwaway database before it is imported.
_TMP_DIR = Path(tempfile.mkdtemp(prefix="stocksense-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP_DIR / 'test.db').as_posix()}"
os.environ["AUTO_SEED"] = "false"
os.environ["OTP_DEV_MODE"] = "true"
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["JWT_SECRET"] = "test-secret-not-for-production-0123456789"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


class Api:
    """Thin authenticated wrapper around TestClient that asserts status codes."""

    def __init__(self, client, headers):
        self.client = client
        self.headers = headers

    def raw(self, method, url, **kwargs):
        return self.client.request(method, url, headers=self.headers, **kwargs)

    def call(self, method, url, expected, **kwargs):
        response = self.raw(method, url, **kwargs)
        assert response.status_code == expected, f"{method} {url} -> {response.status_code}: {response.text}"
        return response.json() if response.content else None

    def get(self, url, expected=200, **params):
        return self.call("GET", url, expected, params=params)

    def post(self, url, json=None, expected=200):
        return self.call("POST", url, expected, json=json)

    def put(self, url, json, expected=200):
        return self.call("PUT", url, expected, json=json)

    def delete(self, url, expected=200):
        return self.call("DELETE", url, expected)


def signup(client, email="manager@test.io", password="Secret123", name="Test Manager"):
    response = client.post("/auth/signup", json={"name": name, "email": email, "password": password})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def api(client):
    token = signup(client)["access_token"]
    return Api(client, {"Authorization": f"Bearer {token}"})


@pytest.fixture
def layout(api):
    """Main Warehouse (Main Store, Production Rack, Dispatch) and a Steel Sheet product at 0 kg."""
    category = api.post("/categories", {"name": "Raw Materials"}, expected=201)
    warehouse = api.post("/warehouses", {"name": "Main Warehouse", "code": "MAIN"}, expected=201)
    main_store = warehouse["locations"][0]
    rack = api.post("/locations", {"warehouse_id": warehouse["id"], "name": "Production Rack"}, expected=201)
    dispatch = api.post("/locations", {"warehouse_id": warehouse["id"], "name": "Dispatch"}, expected=201)
    steel = api.post("/products", {
        "name": "Steel Sheet", "sku": "RM-STL-001", "category_id": category["id"],
        "unit": "kg", "reorder_level": 25,
    }, expected=201)
    return SimpleNamespace(
        category_id=category["id"],
        warehouse_id=warehouse["id"],
        main_store=main_store["id"],
        rack=rack["id"],
        dispatch=dispatch["id"],
        steel=steel["id"],
    )
