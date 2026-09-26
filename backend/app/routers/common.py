from datetime import date
from typing import Literal

DocumentStatus = Literal["draft", "picked", "packed", "done", "cancelled", "pending"]


def document_filters(
    status: DocumentStatus | None = None,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    product_id: int | None = None,
    category_id: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """Query parameters shared by the receipt/delivery/transfer/adjustment lists.

    status=pending matches every open status (draft, picked, packed).
    """
    return dict(
        status=status,
        warehouse_id=warehouse_id,
        location_id=location_id,
        product_id=product_id,
        category_id=category_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
