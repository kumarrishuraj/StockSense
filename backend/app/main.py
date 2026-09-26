from fastapi import FastAPI

app = FastAPI(title="StockSense API")


@app.get("/")
def root():
    return {"message": "StockSense API running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
