import { useState } from 'react'
import Alert from '../../components/common/Alert'
import Button from '../../components/common/Button'
import Field from '../../components/common/Field'
import LineItemsEditor from '../../components/operations/LineItemsEditor'
import LocationPicker from '../../components/operations/LocationPicker'
import { useReferenceData } from '../../hooks/useReferenceData'
import { operationsService } from '../../services/inventoryService'
import { todayISO } from '../../utils/format'
import { emptyLine, linesProblem, toApiLines } from '../../utils/lines'
import { defaultLocationFields } from '../../utils/preferences'

export default function ReceiptForm({ initialProductId, onCreated, onCancel }) {
  const { warehouses } = useReferenceData()
  const [form, setForm] = useState(() => ({
    supplier: '',
    reference: '',
    ...defaultLocationFields(warehouses),
    scheduledDate: todayISO(),
    notes: '',
    lines: [emptyLine(initialProductId)],
  }))
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const problem = !form.supplier.trim()
    ? 'Enter the supplier.'
    : !form.locationId
      ? 'Choose the destination location.'
      : linesProblem(form.lines)

  const submit = async (event) => {
    event.preventDefault()
    setShowErrors(true)
    if (problem) return
    setBusy(true)
    setError('')
    try {
      const receipt = await operationsService.create('receipt', {
        supplier: form.supplier.trim(),
        reference: form.reference.trim() || null,
        warehouse_id: Number(form.warehouseId),
        location_id: Number(form.locationId),
        scheduled_date: form.scheduledDate || null,
        notes: form.notes,
        items: toApiLines(form.lines),
      })
      onCreated(receipt)
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
        <Field label="Supplier" required>
          <input className="input" value={form.supplier} onChange={set('supplier')} placeholder="e.g. Tata Steel" />
        </Field>
        <Field label="Reference" hint="Leave blank to generate one (e.g. MAIN/IN/00012)">
          <input className="input" value={form.reference} onChange={set('reference')} placeholder="Supplier invoice or PO no." />
        </Field>
      </div>
      <LocationPicker
        label="Destination "
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
        <h3 className="form-section-title">Products received</h3>
        <LineItemsEditor lines={form.lines} onChange={(lines) => setForm((current) => ({ ...current, lines }))} showErrors={showErrors} />
      </div>
      <Field label="Notes">
        <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} />
      </Field>
      <div className="form-footer">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Create draft receipt
        </Button>
      </div>
    </form>
  )
}
