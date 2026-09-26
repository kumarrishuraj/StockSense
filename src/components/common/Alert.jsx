import { AlertCircle, AlertTriangle, CheckCircle2, Info, RotateCw } from 'lucide-react'
import Button from './Button'

const ICONS = { danger: AlertCircle, warning: AlertTriangle, success: CheckCircle2, info: Info }

export default function Alert({ tone = 'info', title, children, action }) {
  const Icon = ICONS[tone]
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div className="alert-content">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <Alert
      tone="danger"
      title="Couldn't load this data"
      action={
        onRetry && (
          <Button size="sm" icon={RotateCw} onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      {error?.message || 'Something went wrong.'}
    </Alert>
  )
}
