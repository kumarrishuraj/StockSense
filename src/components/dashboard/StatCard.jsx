import { Link } from 'react-router-dom'
import { formatNumber } from '../../utils/format'

// A KPI tile: label, one number, an optional caption. The whole tile links to the filtered list.
export default function StatCard({ label, value, caption, icon: Icon, tone = 'primary', to, loading }) {
  const content = (
    <>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon tone-${tone}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <div className="stat-value">{loading && value === undefined ? <span className="skeleton skeleton-lg" /> : formatNumber(value)}</div>
      {caption && <div className="stat-caption">{caption}</div>}
    </>
  )
  return to ? (
    <Link to={to} className="stat-card">
      {content}
    </Link>
  ) : (
    <div className="stat-card">{content}</div>
  )
}
