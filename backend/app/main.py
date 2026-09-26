from fastapi import FastAPI
from .database import Base, engine
from . import models
from .routers.dashboard import router as dashboard_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="StockSense API")

app.include_router(dashboard_router)


@app.get("/")
def root():
    return {"message": "StockSense API running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
