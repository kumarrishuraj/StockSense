import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ClipboardCheck,
  Package,
  RotateCw,
  Truck,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../components/common/Button'
import PageHeader from '../../components/common/PageHeader'
import ActivityChart from '../../components/dashboard/ActivityChart'
import FilterBar from '../../components/dashboard/FilterBar'
import LowStockList from '../../components/dashboard/LowStockList'
import RecentOperations from '../../components/dashboard/RecentOperations'
import StatCard from '../../components/dashboard/StatCard'
import StockHealth from '../../components/dashboard/StockHealth'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { dashboardService } from '../../services/dashboardService'
import { formatNumber } from '../../utils/format'

const EMPTY_FILTERS = { document_type: '', status: '', warehouse_id: '', location_id: '', category_id: '' }

const QUICK_ACTIONS = [
  { to: '/receipts?new=1', label: 'Receive goods', icon: ArrowDownToLine },
  { to: '/deliveries?new=1', label: 'New delivery', icon: Truck },
  { to: '/transfers?new=1', label: 'Transfer stock', icon: ArrowLeftRight },
  { to: '/adjustments?new=1', label: 'Adjust stock', icon: ClipboardCheck },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuth()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const scope = { warehouse_id: filters.warehouse_id, location_id: filters.location_id, category_id: filters.category_id }

  const stats = useAsync(() => dashboardService.stats(scope), [scope])
  const recent = useAsync(() => dashboardService.recentOperations({ ...filters, limit: 8 }), [filters])
  const lowStock = useAsync(() => dashboardService.lowStock({ ...scope, limit: 6 }), [scope])
  const summary = useAsync(() => dashboardService.stockSummary(scope), [scope])
  const activity = useAsync(
    () => dashboardService.activity({ days: 14, warehouse_id: scope.warehouse_id, location_id: scope.location_id }),
    [scope.warehouse_id, scope.location_id],
  )

  const refreshAll = () => [stats, recent, lowStock, summary, activity].forEach((resource) => resource.reload())
  const s = stats.data

  return (
    <div className="page">
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0] || 'there'}`}
        description="Live stock levels and operations across your warehouses."
        actions={
          <>
            {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="btn btn-secondary">
                <Icon size={16} aria-hidden="true" /> {label}
              </Link>
            ))}
            <Button icon={RotateCw} onClick={refreshAll} aria-label="Refresh dashboard" title="Refresh" />
          </>
        }
      />

      <FilterBar filters={filters} onChange={setFilters} onClear={() => setFilters(EMPTY_FILTERS)} />

      {stats.error && <p className="inline-error">Couldn't load KPIs: {stats.error.message}</p>}
      <div className="stats-grid">
        <StatCard
          label="Total products"
          value={s?.total_products}
          caption={s ? `${formatNumber(s.in_stock)} in stock` : ' '}
          icon={Package}
          to="/products"
          loading={stats.loading}
        />
        <StatCard
          label="Low stock"
          value={s?.low_stock}
          caption="At or below reorder level"
          icon={AlertTriangle}
          tone="warning"
          to="/products?stock_status=low_stock"
          loading={stats.loading}
        />
        <StatCard
          label="Out of stock"
          value={s?.out_of_stock}
          caption="Nothing left on hand"
          icon={XCircle}
          tone="danger"
          to="/products?stock_status=out_of_stock"
          loading={stats.loading}
        />
        <StatCard
          label="Pending receipts"
          value={s?.pending_receipts}
          caption="Drafts awaiting validation"
          icon={ArrowDownToLine}
          tone="series-1"
          to="/receipts?status=pending"
          loading={stats.loading}
        />
        <StatCard
          label="Pending deliveries"
          value={s?.pending_deliveries}
          caption="Draft, picked or packed"
          icon={Truck}
          tone="series-2"
          to="/deliveries?status=pending"
          loading={stats.loading}
        />
        <StatCard
          label="Internal transfers"
          value={s?.pending_transfers}
          caption={s ? `Scheduled · ${formatNumber(s.completed_transfers)} completed` : ' '}
          icon={ArrowLeftRight}
          tone="series-3"
          to="/transfers?status=pending"
          loading={stats.loading}
        />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <RecentOperations
            operations={recent.data}
            loading={recent.loading}
            error={recent.error}
            onRetry={recent.reload}
            documentType={filters.document_type}
            onDocumentTypeChange={(documentType) => setFilters((current) => ({ ...current, document_type: documentType }))}
          />
          <ActivityChart days={activity.data} loading={activity.loading} error={activity.error} onRetry={activity.reload} />
        </div>
        <div className="dashboard-side">
          <LowStockList items={lowStock.data} loading={lowStock.loading} error={lowStock.error} onRetry={lowStock.reload} />
          <StockHealth summary={summary.data} loading={summary.loading} error={summary.error} onRetry={summary.reload} />
        </div>
      </div>
    </div>
  )
}
