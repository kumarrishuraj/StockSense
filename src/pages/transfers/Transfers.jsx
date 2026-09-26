import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Badge, StatusBadge } from '../../components/common/Badge'
import OperationList from '../../components/operations/OperationList'
import { formatDate, formatDateTime, formatQty } from '../../utils/format'
import { summarizeItems } from '../../utils/lines'
import TransferForm from './TransferForm'

function Place({ location }) {
  return (
    <div className="cell-stack">
      <span>{location.name}</span>
      <small>{location.warehouse_name}</small>
    </div>
  )
}

const columns = [
  {
    key: 'reference',
    header: 'Reference',
    render: (transfer) => (
      <div className="cell-stack">
        <strong className="mono">{transfer.reference}</strong>
        <small>Created {formatDateTime(transfer.created_at)}</small>
      </div>
    ),
  },
  {
    key: 'route',
    header: 'From → To',
    render: (transfer) => (
      <div className="route">
        <Place location={transfer.source_location} />
        <ArrowRight size={14} aria-label="to" />
        <Place location={transfer.destination_location} />
      </div>
    ),
  },
  { key: 'scheduled_date', header: 'Scheduled', render: (transfer) => formatDate(transfer.scheduled_date) },
  {
    key: 'products',
    header: 'Products',
    render: (transfer) => (
      <div className="cell-stack">
        <span>{summarizeItems(transfer.items)}</span>
        <small>{transfer.item_count === 1 ? formatQty(transfer.items[0].quantity, transfer.items[0].unit) : `${transfer.item_count} lines`}</small>
      </div>
    ),
  },
  {
    key: 'availability',
    header: 'Stock',
    render: (transfer) =>
      transfer.is_available === null ? (
        <span className="muted">—</span>
      ) : transfer.is_available ? (
        <Badge tone="success" icon={CheckCircle2}>
          Ready
        </Badge>
      ) : (
        <Badge tone="danger" icon={AlertTriangle}>
          Short
        </Badge>
      ),
  },
  { key: 'status', header: 'Status', render: (transfer) => <StatusBadge status={transfer.status} /> },
]

export default function Transfers() {
  return (
    <OperationList
      type="transfer"
      description="Move stock between locations and warehouses. Total stock stays the same."
      columns={columns}
      FormComponent={TransferForm}
      newLabel="New transfer"
    />
  )
}
