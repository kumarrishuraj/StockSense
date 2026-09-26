def calculate_receipt(current, quantity):
    return current + quantity


def calculate_delivery(current, quantity):
    return current - quantity


def calculate_adjustment(counted_quantity):
    return counted_quantity


def calculate_transfer(source_stock, destination_stock, quantity):
    return (
        source_stock - quantity,
        destination_stock + quantity
    )
