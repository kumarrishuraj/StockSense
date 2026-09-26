import { FilterX, Search } from 'lucide-react'
import { useReferenceData } from '../../hooks/useReferenceData'
import { STOCK_STATUS_META } from '../../utils/constants'
import Button from '../common/Button'

// Search by name/SKU plus category, warehouse, location and stock-status filters.
export default function ProductSearch({ filters, onChange, onClear }) {
  const { categories, warehouses, locationsFor } = useReferenceData()
  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    onChange({ ...filters, [field]: value, ...(field === 'warehouse_id' ? { location_id: '' } : {}) })
  }
  const active = Object.entries(filters).some(([, value]) => Boolean(value))

  return (
    <div className="filter-bar" role="group" aria-label="Product filters">
      <div className="search-input">
        <Search size={16} aria-hidden="true" />
        <input className="input" type="search" placeholder="Search by name or SKU…" value={filters.search} onChange={set('search')} aria-label="Search products" />
      </div>
      <select className="input" value={filters.category_id} onChange={set('category_id')} aria-label="Category">
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
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
      <select className="input" value={filters.stock_status} onChange={set('stock_status')} aria-label="Stock status">
        <option value="">Any stock status</option>
        {Object.entries(STOCK_STATUS_META).map(([value, meta]) => (
          <option key={value} value={value}>
            {meta.label}
          </option>
        ))}
      </select>
      <label className="checkbox">
        <input type="checkbox" checked={filters.include_inactive} onChange={set('include_inactive')} />
        Show inactive
      </label>
      {active && (
        <Button variant="ghost" icon={FilterX} onClick={onClear}>
          Clear
        </Button>
      )}
    </div>
  )
}
