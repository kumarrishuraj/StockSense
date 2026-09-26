import { useCallback, useEffect, useMemo, useState } from 'react'
import { warehouseService } from '../services/inventoryService'
import { categoryService, productService } from '../services/productService'
import { ReferenceDataContext } from './contexts'

// Warehouses (with their locations), categories and active products, loaded once
// for every picker and filter in the app. Pages call refresh() after changing them.
export default function ReferenceDataProvider({ children }) {
  const [state, setState] = useState({ warehouses: [], categories: [], products: [], loaded: false, error: null })

  const refresh = useCallback(async () => {
    try {
      const [warehouses, categories, products] = await Promise.all([
        warehouseService.list(),
        categoryService.list(),
        productService.list(),
      ])
      setState({ warehouses, categories, products, loaded: true, error: null })
    } catch (error) {
      setState((current) => ({ ...current, loaded: true, error }))
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(() => {
    const locations = state.warehouses.flatMap((warehouse) => warehouse.locations)
    return {
      ...state,
      locations,
      refresh,
      locationsFor: (warehouseId) =>
        warehouseId ? locations.filter((location) => location.warehouse_id === Number(warehouseId)) : locations,
      productById: (id) => state.products.find((product) => product.id === Number(id)),
    }
  }, [state, refresh])

  return <ReferenceDataContext.Provider value={value}>{children}</ReferenceDataContext.Provider>
}
