// Per-browser preferences set on the Settings page.
const KEY = 'stocksense.preferences'
const DEFAULTS = { defaultWarehouseId: '', pageSize: 25 }

export function getPreferences() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function savePreferences(preferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getPreferences(), ...preferences }))
    return true
  } catch {
    return false
  }
}

// The warehouse forms start with: the saved default if it still exists, else the first one.
export function defaultWarehouse(warehouses) {
  const { defaultWarehouseId } = getPreferences()
  return warehouses.find((warehouse) => String(warehouse.id) === String(defaultWarehouseId)) || warehouses[0] || null
}

export function defaultLocationFields(warehouses) {
  const warehouse = defaultWarehouse(warehouses)
  const location = warehouse?.locations[0]
  return { warehouseId: warehouse ? String(warehouse.id) : '', locationId: location ? String(location.id) : '' }
}
