import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useReferenceData } from '../../hooks/useReferenceData'
import { formatQty } from '../../utils/format'
import { emptyLine } from '../../utils/lines'
import Button from '../common/Button'

// Product + quantity rows. With `availability` ({product_id: qty}) each line shows
// what the source location holds and flags quantities above it.
export default function LineItemsEditor({ lines, onChange, availability, showErrors }) {
  const { products, productById } = useReferenceData()

  const update = (index, field, value) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)))

  return (
    <div className="line-items">
      <div className="line-items-head" aria-hidden="true">
        <span>Product</span>
        <span>Quantity</span>
        <span />
      </div>
      {lines.map((line, index) => {
        const product = productById(line.product_id)
        const quantity = Number(line.quantity)
        const available = availability && line.product_id ? availability[line.product_id] || 0 : null
        const short = available !== null && quantity > available
        const usedElsewhere = new Set(lines.filter((_, i) => i !== index).map((other) => other.product_id))
        return (
          <div className="line-item" key={index}>
            <select
              className={`input${showErrors && !line.product_id ? ' invalid' : ''}`}
              value={line.product_id}
              onChange={(event) => update(index, 'product_id', event.target.value)}
              aria-label={`Line ${index + 1} product`}
            >
              <option value="">Select product…</option>
              {products.map((option) => (
                <option key={option.id} value={option.id} disabled={usedElsewhere.has(String(option.id))}>
                  {option.name} ({option.sku})
                </option>
              ))}
            </select>
            <div className="qty-input">
              <input
                className={`input${showErrors && !(quantity > 0) ? ' invalid' : ''}`}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={line.quantity}
                onChange={(event) => update(index, 'quantity', event.target.value)}
                aria-label={`Line ${index + 1} quantity`}
                placeholder="0"
              />
              <span className="qty-unit">{product?.unit || ''}</span>
            </div>
            <Button
              variant="ghost"
              icon={Trash2}
              onClick={() => onChange(lines.filter((_, i) => i !== index))}
              disabled={lines.length === 1}
              aria-label={`Remove line ${index + 1}`}
            />
            {available !== null && (
              <div className={`line-availability${short ? ' short' : ''}`}>
                {short && <AlertTriangle size={13} aria-hidden="true" />}
                {formatQty(available, product?.unit)} available at source
                {short && ' — not enough stock'}
              </div>
            )}
          </div>
        )
      })}
      <Button variant="ghost" size="sm" icon={Plus} onClick={() => onChange([...lines, emptyLine()])}>
        Add product
      </Button>
    </div>
  )
}
