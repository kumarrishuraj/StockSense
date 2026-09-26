import { StatusBadge } from '../../components/common/Badge'
import OperationList from '../../components/operations/OperationList'
import { formatDate, formatDateTime, formatQty } from '../../utils/format'
import { summarizeItems } from '../../utils/lines'
import ReceiptForm from './ReceiptForm'

const columns = [
  {
    key: 'reference',
    header: 'Reference',
    render: (receipt) => (
      <div className="cell-stack">
        <strong className="mono">{receipt.reference}</strong>
        <small>Created {formatDateTime(receipt.created_at)}</small>
      </div>
    ),
  },
  { key: 'supplier', header: 'Supplier' },
  {
    key: 'location',
    header: 'Destination',
    render: (receipt) => (
      <div className="cell-stack">
        <span>{receipt.location.name}</span>
        <small>{receipt.location.warehouse_name}</small>
      </div>
    ),
  },
  { key: 'scheduled_date', header: 'Scheduled', render: (receipt) => formatDate(receipt.scheduled_date) },
  {
    key: 'products',
    header: 'Products',
    render: (receipt) => (
      <div className="cell-stack">
        <span>{summarizeItems(receipt.items)}</span>
        <small>{receipt.item_count === 1 ? formatQty(receipt.items[0].quantity, receipt.items[0].unit) : `${receipt.item_count} lines`}</small>
      </div>
    ),
  },
  { key: 'status', header: 'Status', render: (receipt) => <StatusBadge status={receipt.status} /> },
]

export default function Receipts() {
  return (
    <OperationList
      type="receipt"
      description="Incoming goods from suppliers. Validating a receipt adds its quantities to stock."
      columns={columns}
      FormComponent={ReceiptForm}
      newLabel="New receipt"
    />
  )
}
