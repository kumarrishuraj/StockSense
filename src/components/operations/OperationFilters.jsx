import { FilterX, Search } from 'lucide-react'
import { useReferenceData } from '../../hooks/useReferenceData'
import { STATUS_FILTER_LABELS, STATUS_OPTIONS } from '../../utils/constants'
import Button from '../common/Button'

const PLACEHOLDERS = {
  receipt: 'Search reference, supplier or product…',
  delivery: 'Search reference, customer or product…',
  transfer: 'Search reference or product…',
  adjustment: 'Search reference, reason or product…',
}

export default function OperationFilters({ type, filters, onChange, onClear }) {
  const { warehouses, products, locationsFor } = useReferenceData()
  const set = (field) => (event) =>
    onChange({ ...filters, [field]: event.target.value, ...(field === 'warehouse_id' ? { location_id: '' } : {}) })
  const active = Object.values(filters).some(Boolean)

  return (
    <div className="filter-bar" role="group" aria-label="Filters">
      <div className="search-input">
        <Search size={16} aria-hidden="true" />
        <input className="input" type="search" placeholder={PLACEHOLDERS[type]} value={filters.search} onChange={set('search')} aria-label="Search" />
      </div>
      <select className="input" value={filters.status} onChange={set('status')} aria-label="Status">
        <option value="">All statuses</option>
        {STATUS_OPTIONS[type].map((status) => (
          <option key={status} value={status}>
            {STATUS_FILTER_LABELS[status]}
          </option>
        ))}
      </select>
      <select className="input" value={filters.warehouse_id} onChange={set('warehouse_id')} aria-label="Warehouse">
        <option value="">All warehouses</option>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name}
          </option>
        ))}
      </select>
      <select className="input" value={filters.location_id} onChange={set('location_id')} aria-label="Location">
        <option value="">All locations</option>
        {locationsFor(filters.warehouse_id).map((location) => (
          <option key={location.id} value={location.id}>
            {filters.warehouse_id ? location.name : location.full_name}
          </option>
        ))}
      </select>
      <select className="input" value={filters.product_id} onChange={set('product_id')} aria-label="Product">
        <option value="">All products</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>
      <div className="date-range">
        <input className="input" type="date" value={filters.date_from} onChange={set('date_from')} aria-label="From date" />
        <span aria-hidden="true">–</span>
        <input className="input" type="date" value={filters.date_to} onChange={set('date_to')} aria-label="To date" />
      </div>
      {active && (
        <Button variant="ghost" icon={FilterX} onClick={onClear}>
          Clear
        </Button>
      )}
    </div>
  )
}
