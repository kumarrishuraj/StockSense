import { inventoryService } from '../services/inventoryService'
import { useAsync } from './useAsync'

// {product_id: quantity} currently at a location (empty object until loaded).
export function useLocationStock(locationId) {
  const { data } = useAsync(
    () => (locationId ? inventoryService.list({ location_id: locationId }) : Promise.resolve([])),
    [locationId],
  )
  return Object.fromEntries((data || []).map((row) => [row.product_id, row.quantity]))
}
