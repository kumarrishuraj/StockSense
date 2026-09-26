import { useState } from 'react'
import Alert from '../../components/common/Alert'
import Button from '../../components/common/Button'
import Field from '../../components/common/Field'
import LocationPicker from '../../components/operations/LocationPicker'
import { useLocationStock } from '../../hooks/useLocationStock'
import { useReferenceData } from '../../hooks/useReferenceData'
import { operationsService } from '../../services/inventoryService'
import { ADJUSTMENT_REASONS } from '../../utils/constants'
import { formatQty, formatSignedQty, todayISO } from '../../utils/format'
import { defaultLocationFields } from '../../utils/preferences'

const OTHER = '__other__'

export default function AdjustmentForm({ initialProductId, onCreated, onCancel }) {
  const { warehouses, products, productById } = useReferenceData()
  const [form, setForm] = useState(() => ({
    ...defaultLocationFields(warehouses),
    productId: initialProductId ? String(initialProductId) : '',
    counted: '',
    reason: ADJUSTMENT_REASONS[0],
    otherReason: '',
    scheduledDate: todayISO(),
    notes: '',
  }))
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const stock = useLocationStock(form.locationId)

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const product = productById(form.productId)
  const systemQty = form.productId ? stock[form.productId] || 0 : null
  const counted = form.counted === '' ? null : Number(form.counted)
  const difference = counted !== null && systemQty !== null ? counted - systemQty : null
  const reason = form.reason === OTHER ? form.otherReason.trim() : form.reason

  const problem = !form.locationId
    ? 'Choose the location that was counted.'
    : !form.productId
      ? 'Choose the product.'
      : counted === null || Number.isNaN(counted) || counted < 0
        ? 'Enter the counted quantity (0 or more).'
        : !reason
          ? 'Give a reason for the adjustment.'
          : ''

  const submit = async (applyNow) => {
    setShowErrors(true)
    if (problem) return
    setBusy(applyNow ? 'apply' : 'draft')
    setError('')
    let adjustment
    try {
      adjustment = await operationsService.create('adjustment', {
        product_id: Number(form.productId),
        warehouse_id: Number(form.warehouseId),
        location_id: Number(form.locationId),
        counted_quantity: counted,
        reason,
        scheduled_date: form.scheduledDate || null,
        notes: form.notes,
      })
    } catch (err) {
      setError(err.message)
      setBusy(null)
      return
    }
    if (!applyNow) {
      onCreated(adjustment)
      return
    }
    try {
      const applied = await operationsService.act('adjustment', adjustment.id, 'validate')
      onCreated(
        applied,
        `${applied.reference} applied. ${applied.product_name} is now ${formatQty(applied.counted_quantity, applied.unit)} at ${applied.location.name}.`,
      )
    } catch (err) {
      onCreated(adjustment, `${adjustment.reference} was saved as a draft but not applied: ${err.message}`, 'error')
    }
  }

  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault()
        submit(true)
      }}
      noValidate
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {showErrors && problem && <Alert tone="warning">{problem}</Alert>}
      <LocationPicker
        label="Counted at: "
        warehouseId={form.warehouseId}
        locationId={form.locationId}
        onChange={(values) => setForm((current) => ({ ...current, ...values }))}
      />
      <Field label="Product" required>
        <select className="input" value={form.productId} onChange={set('productId')}>
          <option value="">Select product…</option>
          {products.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} ({option.sku})
            </option>
          ))}
        </select>
      </Field>

      <div className="adjustment-figures editable">
        <div>
          <span>System quantity</span>
          <strong>{systemQty === null ? '—' : formatQty(systemQty, product?.unit)}</strong>
        </div>
        <div>
          <label htmlFor="counted-qty">Counted quantity *</label>
          <div className="qty-input">
            <input
              id="counted-qty"
              className="input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.counted}
              onChange={set('counted')}
              placeholder="0"
            />
            <span className="qty-unit">{product?.unit || ''}</span>
          </div>
        </div>
        <div>
          <span>Difference</span>
          <strong className={difference < 0 ? 'text-danger' : difference > 0 ? 'text-success' : ''}>
            {difference === null ? '—' : formatSignedQty(difference, product?.unit)}
          </strong>
        </div>
      </div>

      <div className="form-grid-2">
        <Field label="Reason" required>
          <select className="input" value={form.reason} onChange={set('reason')}>
            {ADJUSTMENT_REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={OTHER}>Other…</option>
          </select>
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={form.scheduledDate} onChange={set('scheduledDate')} />
        </Field>
      </div>
      {form.reason === OTHER && (
        <Field label="Describe the reason" required>
          <input className="input" value={form.otherReason} onChange={set('otherReason')} maxLength={200} />
        </Field>
      )}
      <Field label="Notes">
        <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} />
      </Field>
      <div className="form-footer">
        <Button onClick={onCancel} disabled={Boolean(busy)}>
          Cancel
        </Button>
        <Button onClick={() => submit(false)} loading={busy === 'draft'} disabled={Boolean(busy)}>
          Save as draft
        </Button>
        <Button type="submit" variant="primary" loading={busy === 'apply'} disabled={Boolean(busy)}>
          Apply adjustment
        </Button>
      </div>
    </form>
  )
}
