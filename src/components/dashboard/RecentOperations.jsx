import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DOC_TYPE_ORDER, DOC_TYPES } from '../../utils/constants'
import { formatDate, formatQty, formatSignedQty } from '../../utils/format'
import { DocTypeLabel, StatusBadge } from '../common/Badge'
import { ErrorState } from '../common/Alert'
import EmptyState from '../common/EmptyState'
import Table from '../common/Table'

const TABS = [{ value: '', label: 'All' }, ...DOC_TYPE_ORDER.map((type) => ({ value: type, label: DOC_TYPES[type].plural.replace('Inventory ', '').replace('Internal ', '') }))]

function route(operation) {
  if (operation.document_type === 'transfer') return `${operation.source_name} → ${operation.destination_name}`
  if (operation.document_type === 'receipt') return `${operation.partner} → ${operation.destination_name}`
  if (operation.document_type === 'delivery') return `${operation.source_name} → ${operation.partner}`
  return `${operation.source_name} · ${operation.partner}`
}

function quantity(operation) {
  if (operation.document_type === 'adjustment') return formatSignedQty(operation.total_quantity, operation.unit)
  if (operation.unit) return formatQty(operation.total_quantity, operation.unit)
  return `${operation.item_count} lines`
}

export default function RecentOperations({ operations, loading, error, onRetry, documentType, onDocumentTypeChange }) {
  const navigate = useNavigate()

  const columns = [
    {
      key: 'reference',
      header: 'Reference',
      render: (op) => (
        <div className="op-ref">
          <DocTypeLabel type={op.document_type} iconOnly />
          <div className="cell-stack">
            <strong className="mono nowrap">{op.reference}</strong>
            <small className="nowrap">
              {DOC_TYPES[op.document_type].label} · {formatDate(op.scheduled_date)}
            </small>
          </div>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (op) => (
        <div className="cell-stack">
          <span>{op.summary}</span>
          <small className="truncate">{route(op)}</small>
        </div>
      ),
    },
    { key: 'quantity', header: 'Qty', align: 'right', render: (op) => <span className="nowrap">{quantity(op)}</span> },
    { key: 'status', header: 'Status', render: (op) => <StatusBadge status={op.status} /> },
  ]

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Recent operations</h2>
          <p>Latest receipts, deliveries, transfers and adjustments</p>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Document type">
        {TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            role="tab"
            aria-selected={documentType === tab.value}
            className={`tab${documentType === tab.value ? ' active' : ''}`}
            onClick={() => onDocumentTypeChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="card-body">
          <ErrorState error={error} onRetry={onRetry} />
        </div>
      ) : (
        <Table
          columns={columns}
          rows={operations}
          rowKey={(op) => `${op.document_type}-${op.id}`}
          loading={loading}
          onRowClick={(op) => navigate(`${DOC_TYPES[op.document_type].path}?id=${op.id}`)}
          empty={<EmptyState compact title="No operations match these filters" />}
        />
      )}
      {documentType && (
        <div className="card-footer">
          <button type="button" className="text-link" onClick={() => navigate(DOC_TYPES[documentType].path)}>
            Open {DOC_TYPES[documentType].plural} <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  )
}
