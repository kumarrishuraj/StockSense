import { AlertTriangle, CheckCircle2, Warehouse, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { STOCK_STATUS_META } from '../../utils/constants'
import { formatNumber } from '../../utils/format'
import { ErrorState } from '../common/Alert'

const STATUSES = [
  { key: 'in_stock', icon: CheckCircle2 },
  { key: 'low_stock', icon: AlertTriangle },
  { key: 'out_of_stock', icon: XCircle },
]

// Stock summary: product health split (status colours always paired with icon + label),
// then per-warehouse and per-category counts.
export default function StockHealth({ summary, loading, error, onRetry }) {
  const counts = summary?.status_counts || {}
  const total = STATUSES.reduce((sum, { key }) => sum + (counts[key] || 0), 0)

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Stock summary</h2>
          <p>Product health across the selected scope</p>
        </div>
      </div>
      <div className="card-body">
        {error && <ErrorState error={error} onRetry={onRetry} />}
        {!error && loading && !summary && <span className="skeleton skeleton-block" />}
        {summary && (
          <>
            <div className="health-bar" role="img" aria-label={STATUSES.map(({ key }) => `${STOCK_STATUS_META[key].label}: ${counts[key] || 0}`).join(', ')}>
              {total === 0 && <span className="health-empty" />}
              {STATUSES.map(({ key }) =>
                counts[key] ? <span key={key} className={`health-segment ${key}`} style={{ flexGrow: counts[key] }} /> : null,
              )}
            </div>
            <ul className="health-legend">
              {STATUSES.map(({ key, icon: Icon }) => (
                <li key={key}>
                  <Link to={`/products?stock_status=${key}`}>
                    <Icon size={15} className={`health-icon ${key}`} aria-hidden="true" />
                    <span>{STOCK_STATUS_META[key].label}</span>
                    <strong>{formatNumber(counts[key] || 0)}</strong>
                  </Link>
                </li>
              ))}
            </ul>

            <h3 className="subheading">By warehouse</h3>
            <ul className="summary-list">
              {summary.by_warehouse.map((warehouse) => (
                <li key={warehouse.warehouse_id}>
                  <Link to={`/warehouses/${warehouse.warehouse_id}`} className="summary-row">
                    <Warehouse size={16} aria-hidden="true" />
                    <span className="summary-main">
                      <strong>{warehouse.name}</strong>
                      <small>
                        {warehouse.product_count} products in stock · {warehouse.location_count} locations
                      </small>
                    </span>
                    {warehouse.low_stock + warehouse.out_of_stock > 0 && (
                      <span className="summary-alert" title="Low or out of stock here">
                        <AlertTriangle size={14} aria-hidden="true" /> {warehouse.low_stock + warehouse.out_of_stock}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>

            <h3 className="subheading">By category</h3>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Products</th>
                  <th>Low</th>
                  <th>Out</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_category.map((category) => (
                  <tr key={category.category_id ?? 'none'}>
                    <td>{category.name}</td>
                    <td>{category.product_count}</td>
                    <td>{category.low_stock || '–'}</td>
                    <td>{category.out_of_stock || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  )
}
