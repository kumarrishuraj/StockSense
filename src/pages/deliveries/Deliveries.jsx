import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge, StatusBadge } from '../../components/common/Badge'
import OperationList from '../../components/operations/OperationList'
import { formatDate, formatDateTime, formatQty } from '../../utils/format'
import { summarizeItems } from '../../utils/lines'
import DeliveryForm from './DeliveryForm'

function Availability({ delivery }) {
  if (delivery.is_available === null) return <span className="muted">—</span>
  return delivery.is_available ? (
    <Badge tone="success" icon={CheckCircle2}>
      Ready
    </Badge>
  ) : (
    <Badge tone="danger" icon={AlertTriangle}>
      Short
    </Badge>
  )
}

const columns = [
  {
    key: 'reference',
    header: 'Reference',
    render: (delivery) => (
      <div className="cell-stack">
        <strong className="mono">{delivery.reference}</strong>
        <small>Created {formatDateTime(delivery.created_at)}</small>
      </div>
    ),
  },
  { key: 'customer', header: 'Customer' },
  {
    key: 'location',
    header: 'Source',
    render: (delivery) => (
      <div className="cell-stack">
        <span>{delivery.location.name}</span>
        <small>{delivery.location.warehouse_name}</small>
      </div>
    ),
  },
  { key: 'scheduled_date', header: 'Scheduled', render: (delivery) => formatDate(delivery.scheduled_date) },
  {
    key: 'products',
    header: 'Products',
    render: (delivery) => (
      <div className="cell-stack">
        <span>{summarizeItems(delivery.items)}</span>
        <small>{delivery.item_count === 1 ? formatQty(delivery.items[0].quantity, delivery.items[0].unit) : `${delivery.item_count} lines`}</small>
      </div>
    ),
  },
  { key: 'availability', header: 'Stock', render: (delivery) => <Availability delivery={delivery} /> },
  { key: 'status', header: 'Status', render: (delivery) => <StatusBadge status={delivery.status} /> },
]

export default function Deliveries() {
  return (
    <OperationList
      type="delivery"
      description="Outgoing orders to customers: Draft → Pick → Pack → Validate. Validating removes the stock."
      columns={columns}
      FormComponent={DeliveryForm}
      newLabel="New delivery"
    />
  )
}
