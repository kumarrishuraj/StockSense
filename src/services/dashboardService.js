import { api, request } from './api'

export const dashboardService = {
  stats: (params) => api.get('/dashboard/stats', params),
  recentOperations: (params) => api.get('/dashboard/recent-operations', params),
  lowStock: (params) => api.get('/dashboard/low-stock', params),
  stockSummary: (params) => api.get('/dashboard/stock-summary', params),
  activity: (params) =>
    api.get('/dashboard/activity', { tz_offset: new Date().getTimezoneOffset(), ...params }),
  search: (q) => api.get('/search', { q }),
  health: () => request('/health', { auth: false }),
}
