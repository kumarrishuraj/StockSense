import { useState } from 'react'
import { useReferenceData } from '../../hooks/useReferenceData'
import { productService } from '../../services/productService'
import { UNIT_SUGGESTIONS } from '../../utils/constants'
import { defaultLocationFields } from '../../utils/preferences'
import Alert from '../common/Alert'
import Button from '../common/Button'
import Field from '../common/Field'
import LocationPicker from '../operations/LocationPicker'

// Create or edit a product. Initial stock (create only) is booked through the
// stock engine as an "Initial stock" adjustment, so it appears in the ledger.
export default function ProductForm({ product, onSaved, onCancel }) {
  const { categories, warehouses } = useReferenceData()
  const editing = Boolean(product)
  const [form, setForm] = useState(() => ({
    name: product?.name || '',
    sku: product?.sku || '',
    category_id: product?.category_id ? String(product.category_id) : '',
    unit: product?.unit || 'Units',
    reorder_level: product ? String(product.reorder_level) : '0',
    description: product?.description || '',
    is_active: product ? product.is_active : true,
    initial_stock: '',
    ...defaultLocationFields(warehouses),
  }))
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))

  const initialStock = Number(form.initial_stock || 0)
  const problems = {
    name: form.name.trim() ? '' : 'Enter a product name.',
    sku: !form.sku.trim()
      ? 'Enter a SKU.'
      : /^[A-Za-z0-9._/-]+$/.test(form.sku.trim())
        ? ''
        : 'Use letters, numbers, dot, dash, slash or underscore.',
    unit: form.unit.trim() ? '' : 'Enter a unit of measure.',
    reorder_level: Number(form.reorder_level) >= 0 && form.reorder_level !== '' ? '' : 'Enter 0 or more.',
    initial_stock: initialStock >= 0 ? '' : 'Initial stock cannot be negative.',
    location: !editing && initialStock > 0 && !form.locationId ? 'Choose where the initial stock is.' : '',
  }
  const invalid = Object.values(problems).some(Boolean)
  const show = (field) => (showErrors ? problems[field] : '')

  const submit = async (event) => {
    event.preventDefault()
    setShowErrors(true)
    if (invalid) return
    setBusy(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      category_id: form.category_id ? Number(form.category_id) : null,
      unit: form.unit.trim(),
      reorder_level: Number(form.reorder_level),
      description: form.description,
      is_active: form.is_active,
    }
    try {
      const saved = editing
        ? await productService.update(product.id, payload)
        : await productService.create({
            ...payload,
            initial_stock: initialStock,
            initial_location_id: initialStock > 0 ? Number(form.locationId) : null,
          })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="form-grid-2">
        <Field label="Product name" required error={show('name')}>
          <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Steel Sheet" />
        </Field>
        <Field label="SKU / code" required error={show('sku')} hint="Unique. Stored in upper case.">
          <input className="input mono" value={form.sku} onChange={set('sku')} placeholder="e.g. RM-STL-001" />
        </Field>
        <Field label="Category">
          <select className="input" value={form.category_id} onChange={set('category_id')}>
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit of measure" required error={show('unit')}>
          <input className="input" list="unit-suggestions" value={form.unit} onChange={set('unit')} />
        </Field>
        <datalist id="unit-suggestions">
          {UNIT_SUGGESTIONS.map((unit) => (
            <option key={unit} value={unit} />
          ))}
        </datalist>
        <Field label="Reorder level" error={show('reorder_level')} hint="Flagged as low stock at or below this quantity.">
          <input className="input" type="number" min="0" step="any" value={form.reorder_level} onChange={set('reorder_level')} />
        </Field>
        {editing && (
          <Field label="Status">
            <label className="switch">
              <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
              <span>{form.is_active ? 'Active' : 'Inactive (hidden from new operations)'}</span>
            </label>
          </Field>
        )}
      </div>
      <Field label="Description">
        <textarea className="input" rows={2} value={form.description} onChange={set('description')} />
      </Field>

      {!editing && (
        <fieldset className="fieldset">
          <legend>Initial stock (optional)</legend>
          <Field label="Quantity on hand today" error={show('initial_stock')} hint="Recorded in the ledger as an 'Initial stock' adjustment.">
            <input className="input" type="number" min="0" step="any" value={form.initial_stock} onChange={set('initial_stock')} placeholder="0" />
          </Field>
          {initialStock > 0 && (
            <LocationPicker
              warehouseId={form.warehouseId}
              locationId={form.locationId}
              onChange={(values) => setForm((current) => ({ ...current, ...values }))}
              error={show('location')}
            />
          )}
        </fieldset>
      )}

      <div className="form-footer">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {editing ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  )
}
