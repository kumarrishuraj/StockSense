from fastapi import FastAPI
from .database import Base, engine
from . import models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="StockSense API")


@app.get("/")
def root():
    return {"message": "StockSense API running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
