from fastapi import APIRouter

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def dashboard_stats():
    return {
        "total_products": 1248,
        "low_stock": 24,
        "out_of_stock": 8,
        "pending_receipts": 12,
        "pending_deliveries": 18,
        "internal_transfers": 7
    }
