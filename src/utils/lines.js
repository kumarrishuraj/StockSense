// Helpers for the product/quantity lines used by receipts, deliveries and transfers.

export const emptyLine = (productId = '') => ({ product_id: productId ? String(productId) : '', quantity: '' })

// Returns an error message, or '' when every line is complete.
export function linesProblem(lines) {
  if (lines.length === 0) return 'Add at least one product.'
  if (lines.some((line) => !line.product_id)) return 'Choose a product on every line.'
  if (lines.some((line) => !(Number(line.quantity) > 0))) return 'Every quantity must be greater than zero.'
  return ''
}

export const toApiLines = (lines) =>
  lines.map((line) => ({ product_id: Number(line.product_id), quantity: Number(line.quantity) }))

// "Steel Sheet · 100 kg" for one line, "Copper Wire +1 more" for several.
export function summarizeItems(items) {
  if (!items?.length) return '—'
  if (items.length === 1) return `${items[0].product_name}`
  return `${items[0].product_name} +${items.length - 1} more`
}
