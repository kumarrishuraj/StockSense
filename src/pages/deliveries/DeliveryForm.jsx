import { useState } from 'react'
import Alert from '../../components/common/Alert'
import Button from '../../components/common/Button'
import Field from '../../components/common/Field'
import LineItemsEditor from '../../components/operations/LineItemsEditor'
import LocationPicker from '../../components/operations/LocationPicker'
import { useLocationStock } from '../../hooks/useLocationStock'
import { useReferenceData } from '../../hooks/useReferenceData'
import { operationsService } from '../../services/inventoryService'
import { todayISO } from '../../utils/format'
import { emptyLine, linesProblem, toApiLines } from '../../utils/lines'
import { defaultLocationFields } from '../../utils/preferences'

export default function DeliveryForm({ initialProductId, onCreated, onCancel }) {
  const { warehouses } = useReferenceData()
  const [form, setForm] = useState(() => ({
    customer: '',
    reference: '',
    ...defaultLocationFields(warehouses),
    scheduledDate: todayISO(),
    notes: '',
    lines: [emptyLine(initialProductId)],
  }))
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const availability = useLocationStock(form.locationId)

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const problem = !form.customer.trim()
    ? 'Enter the customer.'
    : !form.locationId
      ? 'Choose the source location.'
      : linesProblem(form.lines)
  const short = form.lines.some((line) => line.product_id && Number(line.quantity) > (availability[line.product_id] || 0))

  const submit = async (event) => {
    event.preventDefault()
    setShowErrors(true)
    if (problem) return
    setBusy(true)
    setError('')
    try {
      const delivery = await operationsService.create('delivery', {
        customer: form.customer.trim(),
        reference: form.reference.trim() || null,
        warehouse_id: Number(form.warehouseId),
        location_id: Number(form.locationId),
        scheduled_date: form.scheduledDate || null,
        notes: form.notes,
        items: toApiLines(form.lines),
      })
      onCreated(delivery)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      {showErrors && problem && <Alert tone="warning">{problem}</Alert>}
      <div className="form-grid-2">
        <Field label="Customer" required>
          <input className="input" value={form.customer} onChange={set('customer')} placeholder="e.g. Kirloskar Pumps" />
        </Field>
        <Field label="Reference" hint="Leave blank to generate one (e.g. MAIN/OUT/00008)">
          <input className="input" value={form.reference} onChange={set('reference')} placeholder="Sales order no." />
        </Field>
      </div>
      <LocationPicker
        label="Source "
        warehouseId={form.warehouseId}
        locationId={form.locationId}
        onChange={(values) => setForm((current) => ({ ...current, ...values }))}
      />
      <div className="form-grid-2">
        <Field label="Scheduled date">
          <input className="input" type="date" value={form.scheduledDate} onChange={set('scheduledDate')} />
        </Field>
      </div>
      <div>
        <h3 className="form-section-title">Products to deliver</h3>
        <LineItemsEditor
          lines={form.lines}
          onChange={(lines) => setForm((current) => ({ ...current, lines }))}
          availability={form.locationId ? availability : null}
          showErrors={showErrors}
        />
      </div>
      {short && (
        <Alert tone="warning">
          Some lines exceed the stock at this location. You can save the draft, but it can't be picked until stock is available.
        </Alert>
      )}
      <Field label="Notes">
        <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} />
      </Field>
      <div className="form-footer">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Create draft delivery
        </Button>
      </div>
    </form>
  )
}
