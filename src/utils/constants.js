import { ArrowDownToLine, ArrowLeftRight, ClipboardCheck, Truck } from 'lucide-react'

// Operation types: labels, routes and the chart colour each one keeps everywhere.
export const DOC_TYPES = {
  receipt: {
    label: 'Receipt',
    plural: 'Receipts',
    path: '/receipts',
    icon: ArrowDownToLine,
    color: 'var(--series-1)',
  },
  delivery: {
    label: 'Delivery',
    plural: 'Delivery Orders',
    path: '/deliveries',
    icon: Truck,
    color: 'var(--series-2)',
  },
  transfer: {
    label: 'Transfer',
    plural: 'Internal Transfers',
    path: '/transfers',
    icon: ArrowLeftRight,
    color: 'var(--series-3)',
  },
  adjustment: {
    label: 'Adjustment',
    plural: 'Inventory Adjustments',
    path: '/adjustments',
    icon: ClipboardCheck,
    color: 'var(--series-4)',
  },
}

export const DOC_TYPE_ORDER = ['receipt', 'delivery', 'transfer', 'adjustment']

export const STATUS_META = {
  draft: { label: 'Draft', tone: 'neutral' },
  picked: { label: 'Picked', tone: 'info' },
  packed: { label: 'Packed', tone: 'accent' },
  done: { label: 'Done', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

// Status filter options per document type. "pending" = any open status.
export const STATUS_OPTIONS = {
  receipt: ['pending', 'draft', 'done', 'cancelled'],
  delivery: ['pending', 'draft', 'picked', 'packed', 'done', 'cancelled'],
  transfer: ['pending', 'draft', 'done', 'cancelled'],
  adjustment: ['pending', 'draft', 'done', 'cancelled'],
  all: ['pending', 'draft', 'picked', 'packed', 'done', 'cancelled'],
}

export const STATUS_FILTER_LABELS = { pending: 'Pending (open)', ...Object.fromEntries(
  Object.entries(STATUS_META).map(([key, meta]) => [key, meta.label]),
) }

export const STOCK_STATUS_META = {
  in_stock: { label: 'In stock', tone: 'success' },
  low_stock: { label: 'Low stock', tone: 'warning' },
  out_of_stock: { label: 'Out of stock', tone: 'danger' },
}

export const ADJUSTMENT_REASONS = [
  'Physical count',
  'Damaged goods',
  'Lost or stolen',
  'Expired',
  'Found stock',
  'Data entry correction',
]

export const UNIT_SUGGESTIONS = ['Units', 'pcs', 'kg', 'g', 'm', 'L', 'boxes', 'rolls', 'sets']

export const ROLE_LABELS = { manager: 'Inventory Manager', staff: 'Warehouse Staff' }
