// Thin fetch wrapper: adds the auth token, turns API errors into readable messages.

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const TOKEN_KEY = 'stocksense.token'

export const UNAUTHORIZED_EVENT = 'stocksense:unauthorized'

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
}

function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  })
  return url
}

function errorMessage(data, status) {
  if (data && typeof data.detail === 'string') return data.detail
  if (status === 404) return 'The requested item was not found.'
  if (status >= 500) return 'Something went wrong on the server. Please try again.'
  return 'The request could not be completed.'
}

export async function request(path, { method = 'GET', body, params, auth = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Cannot reach the StockSense server. Make sure the backend is running.', 0)
  }

  if (response.status === 204) return null
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && auth && token) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: errorMessage(data, 401) }))
    }
    throw new ApiError(errorMessage(data, response.status), response.status, data)
  }
  return data
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
