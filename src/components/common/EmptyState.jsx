import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false }) {
  return (
    <div className={`empty-state${compact ? ' empty-state-compact' : ''}`}>
      <span className="empty-state-icon">
        <Icon size={compact ? 20 : 26} aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
