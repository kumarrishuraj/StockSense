import { api } from './api'

export const warehouseService = {
  list: () => api.get('/warehouses'),
  get: (id) => api.get(`/warehouses/${id}`),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  remove: (id) => api.delete(`/warehouses/${id}`),
}

export const locationService = {
  list: (params) => api.get('/locations', params),
  create: (data) => api.post('/locations', data),
  update: (id, data) => api.put(`/locations/${id}`, data),
  remove: (id) => api.delete(`/locations/${id}`),
}

export const inventoryService = {
  list: (params) => api.get('/inventory', params),
  forProduct: (productId) => api.get(`/inventory/${productId}`),
  movements: (params) => api.get('/stock-movements', params),
}

// Receipts, deliveries, transfers and adjustments share the same REST shape.
const OPERATION_PATHS = {
  receipt: '/receipts',
  delivery: '/deliveries',
  transfer: '/transfers',
  adjustment: '/adjustments',
}

export const operationsService = {
  list: (type, params) => api.get(OPERATION_PATHS[type], params),
  get: (type, id) => api.get(`${OPERATION_PATHS[type]}/${id}`),
  create: (type, data) => api.post(OPERATION_PATHS[type], data),
  // action: validate | cancel | pick | pack
  act: (type, id, action) => api.post(`${OPERATION_PATHS[type]}/${id}/${action}`),
}
