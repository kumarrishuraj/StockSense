"""ORM objects -> API response models."""
from . import schemas
from .models import ADJUSTMENT, DELIVERY, OPEN_STATUSES, RECEIPT, TRANSFER
from .services import stock_service
from .services.stock_service import EPSILON, normalize_qty


def location_ref(location):
    return schemas.LocationRef(
        id=location.id,
        name=location.name,
        full_name=location.full_name,
        warehouse_id=location.warehouse_id,
        warehouse_name=location.warehouse.name,
        warehouse_code=location.warehouse.code,
    )


def product_out(product, total, on_hand=None):
    return schemas.ProductOut(
        id=product.id,
        name=product.name,
        sku=product.sku,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        unit=product.unit,
        reorder_level=product.reorder_level,
        description=product.description,
        is_active=product.is_active,
        on_hand=total if on_hand is None else on_hand,
        total_on_hand=total,
        stock_status=stock_service.stock_status(total, product.reorder_level),
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


def stock_location_out(stock):
    location = stock.location
    return schemas.StockLocationOut(
        location_id=location.id,
        location_name=location.name,
        full_name=location.full_name,
        warehouse_id=location.warehouse_id,
        warehouse_name=location.warehouse.name,
        quantity=normalize_qty(stock.quantity),
        updated_at=stock.updated_at,
    )


def _external_party(operation, note):
    if operation == RECEIPT:
        return f"Supplier: {note}" if note else "Supplier"
    if operation == DELIVERY:
        return f"Customer: {note}" if note else "Customer"
    if operation == ADJUSTMENT:
        return "Inventory adjustment"
    return "-"


def movement_out(movement):
    source, destination = movement.source_location, movement.destination_location
    if source and destination:
        direction = "internal"
    elif destination:
        direction = "in"
    else:
        direction = "out"
    product = movement.product
    return schemas.MovementOut(
        id=movement.id,
        created_at=movement.created_at,
        reference=movement.reference,
        operation=movement.operation,
        document_id=movement.document_id,
        product_id=product.id,
        product_name=product.name,
        sku=product.sku,
        unit=product.unit,
        quantity=normalize_qty(movement.quantity),
        direction=direction,
        source_location_id=movement.source_location_id,
        source_name=source.full_name if source else _external_party(movement.operation, movement.note),
        destination_location_id=movement.destination_location_id,
        destination_name=(
            destination.full_name if destination else _external_party(movement.operation, movement.note)
        ),
        user_name=movement.user.name if movement.user else None,
        status=movement.status,
        note=movement.note,
    )


# -------------------------------------------------------------------- documents


def _document_fields(document, document_type):
    return dict(
        id=document.id,
        document_type=document_type,
        reference=document.reference,
        status=document.status,
        scheduled_date=document.scheduled_date,
        notes=document.notes,
        created_by_name=document.created_by.name if document.created_by else None,
        validated_by_name=document.validated_by.name if document.validated_by else None,
        created_at=document.created_at,
        updated_at=document.updated_at,
        validated_at=document.validated_at,
    )


def _items(document, available=None):
    lines = [
        schemas.LineOut(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name,
            sku=item.product.sku,
            unit=item.product.unit,
            quantity=normalize_qty(item.quantity),
            available=None if available is None else available[(item.product_id, _source_id(document))],
        )
        for item in document.items
    ]
    return dict(
        items=lines,
        item_count=len(lines),
        total_quantity=normalize_qty(sum(line.quantity for line in lines)),
    )


def _source_id(document):
    return document.source_location_id if hasattr(document, "source_location_id") else document.location_id


def _availability(db, documents):
    """Stock at each open document's source location, fetched in one query."""
    pairs = {
        (item.product_id, _source_id(document))
        for document in documents
        if document.status in OPEN_STATUSES
        for item in document.items
    }
    return stock_service.quantities_at(db, pairs)


def _is_available(document, available):
    if document.status not in OPEN_STATUSES:
        return None
    return all(
        available[(item.product_id, _source_id(document))] + EPSILON >= item.quantity
        for item in document.items
    )


def receipts_out(db, receipts):
    return [
        schemas.ReceiptOut(
            **_document_fields(receipt, RECEIPT),
            **_items(receipt),
            supplier=receipt.supplier,
            location=location_ref(receipt.location),
        )
        for receipt in receipts
    ]


def deliveries_out(db, deliveries):
    available = _availability(db, deliveries)
    return [
        schemas.DeliveryOut(
            **_document_fields(delivery, DELIVERY),
            **_items(delivery, available if delivery.status in OPEN_STATUSES else None),
            customer=delivery.customer,
            location=location_ref(delivery.location),
            picked_at=delivery.picked_at,
            packed_at=delivery.packed_at,
            is_available=_is_available(delivery, available),
        )
        for delivery in deliveries
    ]


def transfers_out(db, transfers):
    available = _availability(db, transfers)
    return [
        schemas.TransferOut(
            **_document_fields(transfer, TRANSFER),
            **_items(transfer, available if transfer.status in OPEN_STATUSES else None),
            source_location=location_ref(transfer.source_location),
            destination_location=location_ref(transfer.destination_location),
            is_available=_is_available(transfer, available),
        )
        for transfer in transfers
    ]


def adjustments_out(db, adjustments):
    current = stock_service.quantities_at(db, {(a.product_id, a.location_id) for a in adjustments})
    return [
        schemas.AdjustmentOut(
            **_document_fields(adjustment, ADJUSTMENT),
            product_id=adjustment.product_id,
            product_name=adjustment.product.name,
            sku=adjustment.product.sku,
            unit=adjustment.product.unit,
            location=location_ref(adjustment.location),
            system_quantity=normalize_qty(adjustment.system_quantity),
            counted_quantity=normalize_qty(adjustment.counted_quantity),
            difference=normalize_qty(adjustment.difference),
            current_quantity=current[(adjustment.product_id, adjustment.location_id)],
            reason=adjustment.reason,
        )
        for adjustment in adjustments
    ]


DOCUMENT_SERIALIZERS = {
    RECEIPT: receipts_out,
    DELIVERY: deliveries_out,
    TRANSFER: transfers_out,
    ADJUSTMENT: adjustments_out,
}


def document_out(db, kind, document):
    return DOCUMENT_SERIALIZERS[kind](db, [document])[0]


def _summary(names):
    if not names:
        return "-"
    if len(names) == 1:
        return names[0]
    return f"{names[0]} +{len(names) - 1} more"


def recent_operation(document, kind):
    """One row of the unified operations feed used by the dashboard and search."""
    if kind == ADJUSTMENT:
        location = document.location
        return schemas.RecentOperation(
            id=document.id,
            document_type=kind,
            reference=document.reference,
            status=document.status,
            partner=document.reason,
            source_name=location.full_name,
            destination_name=None,
            warehouse_name=location.warehouse.name,
            scheduled_date=document.scheduled_date,
            updated_at=document.updated_at,
            item_count=1,
            total_quantity=normalize_qty(document.difference),
            summary=document.product.name,
        )

    if kind == TRANSFER:
        partner = None
        source_name = document.source_location.full_name
        destination_name = document.destination_location.full_name
        warehouse_name = document.source_location.warehouse.name
    elif kind == RECEIPT:
        partner = document.supplier
        source_name = None
        destination_name = document.location.full_name
        warehouse_name = document.location.warehouse.name
    else:
        partner = document.customer
        source_name = document.location.full_name
        destination_name = None
        warehouse_name = document.location.warehouse.name

    return schemas.RecentOperation(
        id=document.id,
        document_type=kind,
        reference=document.reference,
        status=document.status,
        partner=partner,
        source_name=source_name,
        destination_name=destination_name,
        warehouse_name=warehouse_name,
        scheduled_date=document.scheduled_date,
        updated_at=document.updated_at,
        item_count=len(document.items),
        total_quantity=normalize_qty(sum(item.quantity for item in document.items)),
        summary=_summary([item.product.name for item in document.items]),
    )
