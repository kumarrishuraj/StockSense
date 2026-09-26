import { AlertTriangle, Ban, CheckCircle2, History, PackageCheck, PackageSearch } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { useToast } from '../../hooks/useToast'
import { operationsService } from '../../services/inventoryService'
import { DOC_TYPES } from '../../utils/constants'
import { formatDate, formatDateTime, formatQty, formatSignedQty } from '../../utils/format'
import Alert, { ErrorState } from '../common/Alert'
import { StatusBadge } from '../common/Badge'
import Button from '../common/Button'
import ConfirmDialog from '../common/ConfirmDialog'
import PageLoader from '../common/Loading'
import Modal from '../common/Modal'
import StatusSteps from './StatusSteps'

// The next workflow step for each document type and status.
const NEXT_STEP = {
  receipt: { draft: { action: 'validate', label: 'Validate receipt', icon: CheckCircle2 } },
  delivery: {
    draft: { action: 'pick', label: 'Pick items', icon: PackageSearch },
    picked: { action: 'pack', label: 'Pack order', icon: PackageCheck },
    packed: { action: 'validate', label: 'Validate delivery', icon: CheckCircle2 },
  },
  transfer: { draft: { action: 'validate', label: 'Validate transfer', icon: CheckCircle2 } },
  adjustment: { draft: { action: 'validate', label: 'Apply adjustment', icon: CheckCircle2 } },
}

const OPEN = ['draft', 'picked', 'packed']

function successMessage(type, action, doc) {
  if (action === 'cancel') return `${doc.reference} cancelled.`
  if (action === 'pick') return `${doc.reference} picked. Next: pack the order.`
  if (action === 'pack') return `${doc.reference} packed. Next: validate to ship it.`
  if (type === 'receipt') return `${doc.reference} validated. Stock added to ${doc.location.full_name}.`
  if (type === 'delivery') return `${doc.reference} validated. Stock removed from ${doc.location.full_name}.`
  if (type === 'transfer') return `${doc.reference} validated. Stock moved to ${doc.destination_location.full_name}.`
  return `${doc.reference} applied. ${doc.product_name} at ${doc.location.full_name} is now ${formatQty(doc.counted_quantity, doc.unit)}.`
}

function impactText(type, doc) {
  if (type === 'receipt') return `Validating adds these quantities to ${doc.location.full_name}.`
  if (type === 'delivery') {
    return doc.status === 'draft'
      ? `Picking checks that ${doc.location.full_name} holds enough stock. Stock is removed when the delivery is validated.`
      : `Validating removes these quantities from ${doc.location.full_name}.`
  }
  if (type === 'transfer') {
    return `Validating moves stock from ${doc.source_location.full_name} to ${doc.destination_location.full_name}. Total stock stays the same.`
  }
  const difference = doc.counted_quantity - doc.current_quantity
  return `Validating sets ${doc.product_name} at ${doc.location.full_name} to ${formatQty(doc.counted_quantity, doc.unit)} (${formatSignedQty(difference, doc.unit)} vs. current stock).`
}

function Meta({ label, children }) {
  return (
    <div className="meta-item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Lines({ doc, showAvailability }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th style={{ textAlign: 'right' }}>Quantity</th>
            {showAvailability && <th style={{ textAlign: 'right' }}>Available at source</th>}
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item) => {
            const short = showAvailability && item.available < item.quantity
            return (
              <tr key={item.id}>
                <td>
                  <div className="cell-stack">
                    <Link to={`/products/${item.product_id}`}>{item.product_name}</Link>
                    <small className="mono">{item.sku}</small>
                  </div>
                </td>
                <td className="num">
                  <strong>{formatQty(item.quantity, item.unit)}</strong>
                </td>
                {showAvailability && (
                  <td className={`num${short ? ' text-danger' : ''}`}>
                    {short && <AlertTriangle size={13} aria-hidden="true" />} {formatQty(item.available, item.unit)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function OperationDetail({ type, id, onClose, onChanged }) {
  const toast = useToast()
  const { data: doc, error, reload, setData } = useAsync(() => operationsService.get(type, id), [type, id])
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const run = async (action) => {
    setBusy(action)
    setActionError('')
    try {
      const updated = await operationsService.act(type, id, action)
      setData(updated)
      toast.success(successMessage(type, action, updated))
      onChanged?.()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(null)
      setConfirmingCancel(false)
    }
  }

  const meta = DOC_TYPES[type]
  const next = doc && NEXT_STEP[type][doc.status]
  const open = doc && OPEN.includes(doc.status)

  return (
    <Modal
      open
      size="lg"
      onClose={busy ? undefined : onClose}
      title={doc ? doc.reference : `${meta.label}`}
      subtitle={
        doc && (
          <span className="modal-subtitle-row">
            {meta.label} · <StatusBadge status={doc.status} />
          </span>
        )
      }
      footer={
        doc && (
          <>
            {open && (
              <Button variant="ghost" icon={Ban} onClick={() => setConfirmingCancel(true)} disabled={Boolean(busy)} className="footer-left">
                Cancel {meta.label.toLowerCase()}
              </Button>
            )}
            <Button onClick={onClose} disabled={Boolean(busy)}>
              Close
            </Button>
            {next && (
              <Button variant="primary" icon={next.icon} loading={busy === next.action} disabled={Boolean(busy)} onClick={() => run(next.action)}>
                {next.label}
              </Button>
            )}
          </>
        )
      }
    >
      {error && <ErrorState error={error} onRetry={reload} />}
      {!doc && !error && <PageLoader />}
      {doc && (
        <div className="detail">
          <StatusSteps type={type} status={doc.status} />
          {actionError && <Alert tone="danger">{actionError}</Alert>}
          {open && doc.is_available === false && !actionError && (
            <Alert tone="warning" title="Not enough stock at the source location">
              Receive or transfer more stock before continuing, or reduce the quantities.
            </Alert>
          )}

          <dl className="meta-grid">
            {type === 'receipt' && (
              <>
                <Meta label="Supplier">{doc.supplier}</Meta>
                <Meta label="Destination">{doc.location.full_name}</Meta>
              </>
            )}
            {type === 'delivery' && (
              <>
                <Meta label="Customer">{doc.customer}</Meta>
                <Meta label="Source location">{doc.location.full_name}</Meta>
              </>
            )}
            {type === 'transfer' && (
              <>
                <Meta label="From">{doc.source_location.full_name}</Meta>
                <Meta label="To">{doc.destination_location.full_name}</Meta>
              </>
            )}
            {type === 'adjustment' && (
              <>
                <Meta label="Product">
                  <Link to={`/products/${doc.product_id}`}>{doc.product_name}</Link> <span className="mono muted">{doc.sku}</span>
                </Meta>
                <Meta label="Location">{doc.location.full_name}</Meta>
                <Meta label="Reason">{doc.reason}</Meta>
              </>
            )}
            <Meta label="Scheduled date">{formatDate(doc.scheduled_date)}</Meta>
            <Meta label="Created">
              {doc.created_by_name || '—'} · {formatDateTime(doc.created_at)}
            </Meta>
            {type === 'delivery' && doc.picked_at && <Meta label="Picked">{formatDateTime(doc.picked_at)}</Meta>}
            {type === 'delivery' && doc.packed_at && <Meta label="Packed">{formatDateTime(doc.packed_at)}</Meta>}
            {doc.validated_at && (
              <Meta label="Validated">
                {doc.validated_by_name || '—'} · {formatDateTime(doc.validated_at)}
              </Meta>
            )}
          </dl>

          {type === 'adjustment' ? (
            <div className="adjustment-figures">
              <div>
                <span>{doc.status === 'draft' ? 'Current system qty' : 'System qty'}</span>
                <strong>{formatQty(doc.status === 'draft' ? doc.current_quantity : doc.system_quantity, doc.unit)}</strong>
              </div>
              <div>
                <span>Counted qty</span>
                <strong>{formatQty(doc.counted_quantity, doc.unit)}</strong>
              </div>
              <div>
                <span>Difference</span>
                {(() => {
                  const difference = doc.status === 'draft' ? doc.counted_quantity - doc.current_quantity : doc.difference
                  return (
                    <strong className={difference < 0 ? 'text-danger' : difference > 0 ? 'text-success' : ''}>
                      {formatSignedQty(difference, doc.unit)}
                    </strong>
                  )
                })()}
              </div>
            </div>
          ) : (
            <Lines doc={doc} showAvailability={open && (type === 'delivery' || type === 'transfer')} />
          )}

          {doc.notes && <p className="detail-notes">{doc.notes}</p>}

          {open && <p className="impact-hint">{impactText(type, doc)}</p>}
          {doc.status === 'done' && (
            <Link to={`/move-history?search=${encodeURIComponent(doc.reference)}`} className="text-link">
              <History size={14} aria-hidden="true" /> View ledger entries
            </Link>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmingCancel}
        title={`Cancel ${doc?.reference}?`}
        message="A cancelled document can't be validated later. Stock is not affected."
        confirmLabel="Cancel document"
        busy={busy === 'cancel'}
        onConfirm={() => run('cancel')}
        onClose={() => setConfirmingCancel(false)}
      />
    </Modal>
  )
}
