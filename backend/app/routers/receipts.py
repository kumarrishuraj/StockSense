from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from .. import serializers
from ..database import get_db
from ..models import RECEIPT, User
from ..schemas import ReceiptCreate, ReceiptOut
from ..services import operations_service
from ..services.auth_service import get_current_user
from .common import document_filters

router = APIRouter(prefix="/receipts", tags=["Receipts"], dependencies=[Depends(get_current_user)])


def _detail(db, receipt_id):
    return serializers.document_out(db, RECEIPT, operations_service.get_document(db, RECEIPT, receipt_id))


@router.get("", response_model=list[ReceiptOut])
def list_receipts(
    filters: dict = Depends(document_filters),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    receipts = operations_service.query_documents(db, RECEIPT, **filters).limit(limit).all()
    return serializers.receipts_out(db, receipts)


@router.post("", response_model=ReceiptOut, status_code=status.HTTP_201_CREATED)
def create_receipt(data: ReceiptCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    receipt = operations_service.create_receipt(db, data, user)
    db.commit()
    return _detail(db, receipt.id)


@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    return _detail(db, receipt_id)


@router.post("/{receipt_id}/validate", response_model=ReceiptOut)
def validate_receipt(receipt_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Draft -> Done: adds every line's quantity to the destination location."""
    receipt = operations_service.get_document(db, RECEIPT, receipt_id)
    operations_service.validate_receipt(db, receipt, user)
    db.commit()
    return _detail(db, receipt_id)


@router.post("/{receipt_id}/cancel", response_model=ReceiptOut)
def cancel_receipt(receipt_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    receipt = operations_service.get_document(db, RECEIPT, receipt_id)
    operations_service.cancel_document(db, receipt, RECEIPT, user)
    db.commit()
    return _detail(db, receipt_id)
