import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from . import models  # noqa: F401  (registers the tables on Base.metadata)
from .config import AUTO_SEED, CORS_ORIGINS, DEFAULT_JWT_SECRET, JWT_SECRET, OTP_DEV_MODE
from .database import Base, SessionLocal, engine
from .routers.adjustments import router as adjustments_router
from .routers.auth import router as auth_router
from .routers.categories import router as categories_router
from .routers.dashboard import router as dashboard_router
from .routers.dashboard import search_router
from .routers.deliveries import router as deliveries_router
from .routers.inventory import router as inventory_router
from .routers.products import router as products_router
from .routers.receipts import router as receipts_router
from .routers.transfers import router as transfers_router
from .routers.warehouses import locations_router
from .routers.warehouses import router as warehouses_router
from .services.stock_service import StockError

logger = logging.getLogger("stocksense")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     [%(name)s] %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(bind=engine)
    if AUTO_SEED:
        from .seed import seed_demo_data

        with SessionLocal() as db:
            if seed_demo_data(db):
                logger.info("Empty database: loaded demo data (login: admin@stocksense.io / Demo@1234)")
    if JWT_SECRET == DEFAULT_JWT_SECRET:
        logger.warning("JWT_SECRET is not set; using an insecure development secret.")
    if OTP_DEV_MODE:
        logger.info("OTP_DEV_MODE is on: password reset codes are shown in the app and logged here.")
    yield


app = FastAPI(
    title="StockSense API",
    version="1.0.0",
    description="Modular inventory management: products, warehouses, receipts, deliveries, "
    "transfers, adjustments and a complete stock ledger.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth_router,
    dashboard_router,
    search_router,
    categories_router,
    products_router,
    warehouses_router,
    locations_router,
    inventory_router,
    receipts_router,
    deliveries_router,
    transfers_router,
    adjustments_router,
):
    app.include_router(router)


# ------------------------------------------------------------- error handling


@app.exception_handler(StockError)
async def stock_error_handler(request: Request, exc: StockError):
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.warning("Integrity error on %s %s: %s", request.method, request.url.path, exc.orig)
    return JSONResponse(
        status_code=409,
        content={"detail": "This change conflicts with existing data (for example a duplicate "
                           "name, SKU or reference). Please review it and try again."},
    )


FRIENDLY_MESSAGES = {
    "missing": "This field is required",
    "too_short": "Add at least one product line",
    "string_too_short": "This field cannot be empty",
    "int_parsing": "Choose a valid option",
    "float_parsing": "Enter a valid number",
    "date_from_datetime_parsing": "Enter a valid date",
    "date_parsing": "Enter a valid date",
}


def _field_label(location):
    parts = []
    for part in location:
        if part in ("body", "query", "path", "items"):
            continue
        parts.append(f"line {part + 1}" if isinstance(part, int) else str(part).replace("_", " "))
    label = " ".join(parts)
    return label[:1].upper() + label[1:]


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        message = FRIENDLY_MESSAGES.get(error.get("type"), error.get("msg", "Invalid value"))
        message = message.removeprefix("Value error, ")
        errors.append({"field": _field_label(error.get("loc", ())), "message": message})
    first = errors[0] if errors else {"field": "", "message": "Invalid request"}
    detail = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
    return JSONResponse(status_code=422, content={"detail": detail, "errors": errors})


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    # The traceback is still logged by the server; users only see a plain message.
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})


# ------------------------------------------------------------------- health


@app.get("/")
def root():
    return {"message": "StockSense API running"}


@app.get("/health")
def health():
    database = "ok"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database = "unavailable"
    return {
        "status": "healthy" if database == "ok" else "degraded",
        "database": database,
        "otp_dev_mode": OTP_DEV_MODE,
        "version": app.version,
    }
