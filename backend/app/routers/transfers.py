from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from .. import serializers
from ..database import get_db
from ..models import TRANSFER, User
from ..schemas import TransferCreate, TransferOut
from ..services import operations_service
from ..services.auth_service import get_current_user
from .common import document_filters

router = APIRouter(prefix="/transfers", tags=["Internal Transfers"], dependencies=[Depends(get_current_user)])


def _detail(db, transfer_id):
    return serializers.document_out(db, TRANSFER, operations_service.get_document(db, TRANSFER, transfer_id))


@router.get("", response_model=list[TransferOut])
def list_transfers(
    filters: dict = Depends(document_filters),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    transfers = operations_service.query_documents(db, TRANSFER, **filters).limit(limit).all()
    return serializers.transfers_out(db, transfers)


@router.post("", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
def create_transfer(data: TransferCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    transfer = operations_service.create_transfer(db, data, user)
    db.commit()
    return _detail(db, transfer.id)


@router.get("/{transfer_id}", response_model=TransferOut)
def get_transfer(transfer_id: int, db: Session = Depends(get_db)):
    return _detail(db, transfer_id)


@router.post("/{transfer_id}/validate", response_model=TransferOut)
def validate_transfer(transfer_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Draft -> Done: moves stock from the source to the destination location."""
    transfer = operations_service.get_document(db, TRANSFER, transfer_id)
    operations_service.validate_transfer(db, transfer, user)
    db.commit()
    return _detail(db, transfer_id)


@router.post("/{transfer_id}/cancel", response_model=TransferOut)
def cancel_transfer(transfer_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    transfer = operations_service.get_document(db, TRANSFER, transfer_id)
    operations_service.cancel_document(db, transfer, TRANSFER, user)
    db.commit()
    return _detail(db, transfer_id)
