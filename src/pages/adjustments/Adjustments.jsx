import { StatusBadge } from '../../components/common/Badge'
import OperationList from '../../components/operations/OperationList'
import { formatDate, formatQty, formatSignedQty } from '../../utils/format'
import AdjustmentForm from './AdjustmentForm'

const columns = [
  {
    key: 'reference',
    header: 'Reference',
    render: (adjustment) => (
      <div className="cell-stack">
        <strong className="mono">{adjustment.reference}</strong>
        <small>{formatDate(adjustment.scheduled_date)}</small>
      </div>
    ),
  },
  {
    key: 'product',
    header: 'Product',
    render: (adjustment) => (
      <div className="cell-stack">
        <span>{adjustment.product_name}</span>
        <small className="mono">{adjustment.sku}</small>
      </div>
    ),
  },
  {
    key: 'location',
    header: 'Location',
    render: (adjustment) => (
      <div className="cell-stack">
        <span>{adjustment.location.name}</span>
        <small>{adjustment.location.warehouse_name}</small>
      </div>
    ),
  },
  {
    key: 'counted',
    header: 'System → Counted',
    render: (adjustment) => {
      const system = adjustment.status === 'draft' ? adjustment.current_quantity : adjustment.system_quantity
      return (
        <span className="nowrap">
          {formatQty(system)} → {formatQty(adjustment.counted_quantity, adjustment.unit)}
        </span>
      )
    },
  },
  {
    key: 'difference',
    header: 'Difference',
    align: 'right',
    render: (adjustment) => {
      const difference =
        adjustment.status === 'draft' ? adjustment.counted_quantity - adjustment.current_quantity : adjustment.difference
      return (
        <strong className={`nowrap ${difference < 0 ? 'text-danger' : difference > 0 ? 'text-success' : ''}`}>
          {formatSignedQty(difference, adjustment.unit)}
        </strong>
      )
    },
  },
  { key: 'reason', header: 'Reason' },
  { key: 'status', header: 'Status', render: (adjustment) => <StatusBadge status={adjustment.status} /> },
]

export default function Adjustments() {
  return (
    <OperationList
      type="adjustment"
      description="Correct the system to match a physical count. Difference = counted − system quantity."
      columns={columns}
      FormComponent={AdjustmentForm}
      newLabel="New adjustment"
    />
  )
}
