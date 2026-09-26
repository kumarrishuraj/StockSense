import { ArrowRight, PackagePlus, PartyPopper } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatQty } from '../../utils/format'
import { StockBadge } from '../common/Badge'
import { ErrorState } from '../common/Alert'
import EmptyState from '../common/EmptyState'

export default function LowStockList({ items, loading, error, onRetry }) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Low-stock items</h2>
          <p>At or below their reorder level</p>
        </div>
        <Link to="/products?stock_status=low_stock" className="text-link">
          View all <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className="card-body low-stock-list">
        {error && <ErrorState error={error} onRetry={onRetry} />}
        {!error && loading && !items && <span className="skeleton skeleton-block" />}
        {!error && items?.length === 0 && (
          <EmptyState compact icon={PartyPopper} title="Everything is well stocked" description="No product is at or below its reorder level." />
        )}
        {items?.map((item) => {
          const cover = item.reorder_level > 0 ? Math.min(100, (item.on_hand / item.reorder_level) * 100) : 0
          return (
            <div key={item.product_id} className="low-stock-item">
              <div className="low-stock-main">
                <Link to={`/products/${item.product_id}`} className="low-stock-name">
                  {item.name}
                </Link>
                <small className="mono">{item.sku}</small>
              </div>
              <div className="low-stock-level">
                <div className="meter" aria-hidden="true">
                  <span className={`meter-fill ${item.stock_status}`} style={{ width: `${cover}%` }} />
                </div>
                <small className="nowrap">
                  {formatQty(item.on_hand, item.unit)} of {formatQty(item.reorder_level, item.unit)} reorder level
                </small>
              </div>
              <StockBadge status={item.stock_status} />
              <Link
                to={`/receipts?new=1&product=${item.product_id}`}
                className="icon-btn"
                title={`Receive more ${item.name}`}
                aria-label={`Receive more ${item.name}`}
              >
                <PackagePlus size={16} />
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
