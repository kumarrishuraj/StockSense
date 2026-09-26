const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 })
const dateFormat = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function formatNumber(value) {
  return numberFormat.format(Number(value) || 0)
}

export function formatQty(value, unit) {
  return unit ? `${formatNumber(value)} ${unit}` : formatNumber(value)
}

export function formatSignedQty(value, unit) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatQty(Math.abs(value), unit)}`
}

// "2026-09-26" (a calendar date from the API) -> local date, without time-zone shifts.
export function parseDateOnly(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDate(value) {
  if (!value) return '—'
  const date = typeof value === 'string' && value.length === 10 ? parseDateOnly(value) : new Date(value)
  return dateFormat.format(date)
}

export function formatDateTime(value) {
  return value ? dateTimeFormat.format(new Date(value)) : '—'
}

export function timeAgo(value) {
  if (!value) return ''
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const units = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

// Local calendar date as YYYY-MM-DD (what <input type="date"> uses).
export function todayISO(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Start of a local calendar day as an ISO timestamp, for datetime API filters.
export function localDayStartISO(dateString, addDays = 0) {
  const date = parseDateOnly(dateString)
  date.setDate(date.getDate() + addDays)
  return date.toISOString()
}

export function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}
