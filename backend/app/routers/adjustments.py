from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from .. import serializers
from ..database import get_db
from ..models import ADJUSTMENT, User
from ..schemas import AdjustmentCreate, AdjustmentOut
from ..services import operations_service
from ..services.auth_service import get_current_user
from .common import document_filters

router = APIRouter(prefix="/adjustments", tags=["Inventory Adjustments"], dependencies=[Depends(get_current_user)])


def _detail(db, adjustment_id):
    return serializers.document_out(
        db, ADJUSTMENT, operations_service.get_document(db, ADJUSTMENT, adjustment_id)
    )


@router.get("", response_model=list[AdjustmentOut])
def list_adjustments(
    filters: dict = Depends(document_filters),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    adjustments = operations_service.query_documents(db, ADJUSTMENT, **filters).limit(limit).all()
    return serializers.adjustments_out(db, adjustments)


@router.post("", response_model=AdjustmentOut, status_code=status.HTTP_201_CREATED)
def create_adjustment(data: AdjustmentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Draft a physical count. difference = counted_quantity - system quantity."""
    adjustment = operations_service.create_adjustment(db, data, user)
    db.commit()
    return _detail(db, adjustment.id)


@router.get("/{adjustment_id}", response_model=AdjustmentOut)
def get_adjustment(adjustment_id: int, db: Session = Depends(get_db)):
    return _detail(db, adjustment_id)


@router.post("/{adjustment_id}/validate", response_model=AdjustmentOut)
def validate_adjustment(adjustment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Draft -> Done: sets the stock at the location to the counted quantity."""
    adjustment = operations_service.get_document(db, ADJUSTMENT, adjustment_id)
    operations_service.validate_adjustment(db, adjustment, user)
    db.commit()
    return _detail(db, adjustment_id)


@router.post("/{adjustment_id}/cancel", response_model=AdjustmentOut)
def cancel_adjustment(adjustment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    adjustment = operations_service.get_document(db, ADJUSTMENT, adjustment_id)
    operations_service.cancel_document(db, adjustment, ADJUSTMENT, user)
    db.commit()
    return _detail(db, adjustment_id)
