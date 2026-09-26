import { FilterX } from 'lucide-react'
import { useReferenceData } from '../../hooks/useReferenceData'
import { DOC_TYPE_ORDER, DOC_TYPES, STATUS_FILTER_LABELS, STATUS_OPTIONS } from '../../utils/constants'
import Button from '../common/Button'

// Warehouse/location/category scope every widget; document type and status narrow the operations feed.
export default function FilterBar({ filters, onChange, onClear }) {
  const { warehouses, categories, locationsFor } = useReferenceData()
  const set = (field) => (event) => {
    const value = event.target.value
    onChange({ ...filters, [field]: value, ...(field === 'warehouse_id' ? { location_id: '' } : {}) })
  }
  const active = Object.values(filters).some(Boolean)

  return (
    <div className="filter-bar" role="group" aria-label="Dashboard filters">
      <select className="input" value={filters.document_type} onChange={set('document_type')} aria-label="Document type">
        <option value="">All document types</option>
        {DOC_TYPE_ORDER.map((type) => (
          <option key={type} value={type}>
            {DOC_TYPES[type].plural}
          </option>
        ))}
      </select>
      <select className="input" value={filters.status} onChange={set('status')} aria-label="Status">
        <option value="">All statuses</option>
        {STATUS_OPTIONS.all.map((status) => (
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
      <select className="input" value={filters.category_id} onChange={set('category_id')} aria-label="Category">
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      {active && (
        <Button variant="ghost" icon={FilterX} onClick={onClear}>
          Clear
        </Button>
      )}
    </div>
  )
}
