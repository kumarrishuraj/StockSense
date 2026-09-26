import { Bell } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { useClickOutside } from '../../hooks/useClickOutside'
import { dashboardService } from '../../services/dashboardService'
import { formatQty } from '../../utils/format'
import { StockBadge } from '../common/Badge'

// Low-stock alerts and open work, refreshed whenever the user navigates.
export default function NotificationsMenu() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  const { data } = useAsync(
    () => Promise.all([dashboardService.lowStock({ limit: 8 }), dashboardService.stats()]),
    [pathname, open],
  )
  const [alerts = [], stats] = data || []
  const pending = stats
    ? [
        { count: stats.pending_receipts, label: 'receipts to validate', to: '/receipts?status=pending' },
        { count: stats.pending_deliveries, label: 'deliveries in progress', to: '/deliveries?status=pending' },
        { count: stats.pending_transfers, label: 'transfers to validate', to: '/transfers?status=pending' },
        { count: stats.pending_adjustments, label: 'adjustments to apply', to: '/adjustments?status=pending' },
      ].filter((item) => item.count > 0)
    : []
  const count = stats ? stats.low_stock + stats.out_of_stock : 0

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="icon-btn navbar-btn"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${count ? ` (${count} stock alerts)` : ''}`}
        aria-expanded={open}
      >
        <Bell size={19} />
        {count > 0 && <span className="notification-dot">{count}</span>}
      </button>

      {open && (
        <div className="dropdown dropdown-right notifications">
          <div className="dropdown-header">
            <strong>Notifications</strong>
          </div>
          <div className="dropdown-section">
            <div className="dropdown-label">Stock alerts</div>
            {alerts.length === 0 && <div className="dropdown-state">All products are above their reorder level.</div>}
            {alerts.map((item) => (
              <Link key={item.product_id} to={`/products/${item.product_id}`} className="dropdown-item" onClick={() => setOpen(false)}>
                <span className="dropdown-item-main">
                  <strong>{item.name}</strong>
                  <small>
                    {formatQty(item.on_hand, item.unit)} on hand · reorder at {formatQty(item.reorder_level, item.unit)}
                  </small>
                </span>
                <StockBadge status={item.stock_status} />
              </Link>
            ))}
          </div>
          {pending.length > 0 && (
            <div className="dropdown-section">
              <div className="dropdown-label">Waiting for action</div>
              {pending.map((item) => (
                <Link key={item.to} to={item.to} className="dropdown-item" onClick={() => setOpen(false)}>
                  <span className="count-pill">{item.count}</span>
                  <span className="dropdown-item-main">{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
