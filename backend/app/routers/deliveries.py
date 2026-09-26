from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from .. import serializers
from ..database import get_db
from ..models import DELIVERY, User
from ..schemas import DeliveryCreate, DeliveryOut
from ..services import operations_service
from ..services.auth_service import get_current_user
from .common import document_filters

router = APIRouter(prefix="/deliveries", tags=["Delivery Orders"], dependencies=[Depends(get_current_user)])


def _detail(db, delivery_id):
    return serializers.document_out(db, DELIVERY, operations_service.get_document(db, DELIVERY, delivery_id))


def _step(db, delivery_id, user, action):
    delivery = operations_service.get_document(db, DELIVERY, delivery_id)
    action(db, delivery, user)
    db.commit()
    return _detail(db, delivery_id)


@router.get("", response_model=list[DeliveryOut])
def list_deliveries(
    filters: dict = Depends(document_filters),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    deliveries = operations_service.query_documents(db, DELIVERY, **filters).limit(limit).all()
    return serializers.deliveries_out(db, deliveries)


@router.post("", response_model=DeliveryOut, status_code=status.HTTP_201_CREATED)
def create_delivery(data: DeliveryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    delivery = operations_service.create_delivery(db, data, user)
    db.commit()
    return _detail(db, delivery.id)


@router.get("/{delivery_id}", response_model=DeliveryOut)
def get_delivery(delivery_id: int, db: Session = Depends(get_db)):
    return _detail(db, delivery_id)


@router.post("/{delivery_id}/pick", response_model=DeliveryOut)
def pick_delivery(delivery_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Draft -> Picked. Fails if the source location doesn't hold enough stock."""
    return _step(db, delivery_id, user, operations_service.pick_delivery)


@router.post("/{delivery_id}/pack", response_model=DeliveryOut)
def pack_delivery(delivery_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Picked -> Packed."""
    return _step(db, delivery_id, user, operations_service.pack_delivery)


@router.post("/{delivery_id}/validate", response_model=DeliveryOut)
def validate_delivery(delivery_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Packed -> Done: removes every line's quantity from the source location."""
    return _step(db, delivery_id, user, operations_service.validate_delivery)


@router.post("/{delivery_id}/cancel", response_model=DeliveryOut)
def cancel_delivery(delivery_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _step(
        db, delivery_id, user,
        lambda db_, delivery, user_: operations_service.cancel_document(db_, delivery, DELIVERY, user_),
    )
