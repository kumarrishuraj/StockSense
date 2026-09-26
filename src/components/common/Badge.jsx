import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { DOC_TYPES, STATUS_META, STOCK_STATUS_META } from '../../utils/constants'

export function Badge({ tone = 'neutral', icon: Icon, children }) {
  return (
    <span className={`badge badge-${tone}`}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: 'neutral' }
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

const STOCK_ICONS = { in_stock: CheckCircle2, low_stock: AlertTriangle, out_of_stock: XCircle }

// Stock state is never colour alone: every badge carries an icon and a label.
export function StockBadge({ status }) {
  const meta = STOCK_STATUS_META[status]
  if (!meta) return null
  return (
    <Badge tone={meta.tone} icon={STOCK_ICONS[status]}>
      {meta.label}
    </Badge>
  )
}

// iconOnly: just the coloured icon, with the label kept for screen readers.
export function DocTypeLabel({ type, iconOnly = false }) {
  const meta = DOC_TYPES[type]
  if (!meta) return type
  const Icon = meta.icon
  return (
    <span className="doc-type" title={iconOnly ? meta.label : undefined}>
      <span className="doc-type-icon" style={{ '--doc-color': meta.color }}>
        <Icon size={13} aria-hidden="true" />
      </span>
      {iconOnly ? <span className="sr-only">{meta.label}</span> : meta.label}
    </span>
  )
}
