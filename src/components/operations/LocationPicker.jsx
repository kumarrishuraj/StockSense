import { useReferenceData } from '../../hooks/useReferenceData'
import Field from '../common/Field'

// Warehouse -> location pair. Changing the warehouse picks its first location.
export default function LocationPicker({ label = '', warehouseId, locationId, onChange, error }) {
  const { warehouses, locationsFor } = useReferenceData()
  const locations = locationsFor(warehouseId)

  const changeWarehouse = (event) => {
    const nextWarehouse = event.target.value
    const first = locationsFor(nextWarehouse)[0]
    onChange({ warehouseId: nextWarehouse, locationId: first ? String(first.id) : '' })
  }

  return (
    <div className="form-grid-2">
      <Field label={`${label}Warehouse`} required>
        <select className="input" value={warehouseId} onChange={changeWarehouse}>
          <option value="">Select warehouse…</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`${label}Location`} required error={error}>
        <select
          className="input"
          value={locationId}
          onChange={(event) => onChange({ warehouseId, locationId: event.target.value })}
          disabled={!warehouseId}
        >
          <option value="">{warehouseId ? 'Select location…' : 'Choose a warehouse first'}</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}
