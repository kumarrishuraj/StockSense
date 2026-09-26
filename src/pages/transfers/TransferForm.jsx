import { ArrowDown } from 'lucide-react'
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

export default function TransferForm({ initialProductId, onCreated, onCancel }) {
  const { warehouses } = useReferenceData()
  const [form, setForm] = useState(() => {
    const source = defaultLocationFields(warehouses)
    const sourceWarehouse = warehouses.find((warehouse) => String(warehouse.id) === source.warehouseId)
    const secondLocation = sourceWarehouse?.locations[1]
    return {
      reference: '',
      source,
      destination: {
        warehouseId: source.warehouseId,
        locationId: secondLocation ? String(secondLocation.id) : '',
      },
      scheduledDate: todayISO(),
      notes: '',
      lines: [emptyLine(initialProductId)],
    }
  })
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const availability = useLocationStock(form.source.locationId)

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const sameLocation = form.source.locationId && form.source.locationId === form.destination.locationId
  const problem = !form.source.locationId
    ? 'Choose the source location.'
    : !form.destination.locationId
      ? 'Choose the destination location.'
      : sameLocation
        ? 'Source and destination must be different locations.'
        : linesProblem(form.lines)

  const submit = async (event) => {
    event.preventDefault()
    setShowErrors(true)
    if (problem) return
    setBusy(true)
    setError('')
    try {
      const transfer = await operationsService.create('transfer', {
        reference: form.reference.trim() || null,
        source_location_id: Number(form.source.locationId),
        destination_location_id: Number(form.destination.locationId),
        scheduled_date: form.scheduledDate || null,
        notes: form.notes,
        items: toApiLines(form.lines),
      })
      onCreated(transfer)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      {showErrors && problem && <Alert tone="warning">{problem}</Alert>}
      <LocationPicker
        label="Source "
        warehouseId={form.source.warehouseId}
        locationId={form.source.locationId}
        onChange={(source) => setForm((current) => ({ ...current, source }))}
      />
      <div className="transfer-arrow" aria-hidden="true">
        <ArrowDown size={18} />
      </div>
      <LocationPicker
        label="Destination "
        warehouseId={form.destination.warehouseId}
        locationId={form.destination.locationId}
        onChange={(destination) => setForm((current) => ({ ...current, destination }))}
        error={sameLocation ? 'Pick a different location from the source.' : ''}
      />
      <div className="form-grid-2">
        <Field label="Reference" hint="Leave blank to generate one">
          <input className="input" value={form.reference} onChange={set('reference')} />
        </Field>
        <Field label="Scheduled date">
          <input className="input" type="date" value={form.scheduledDate} onChange={set('scheduledDate')} />
        </Field>
      </div>
      <div>
        <h3 className="form-section-title">Products to move</h3>
        <LineItemsEditor
          lines={form.lines}
          onChange={(lines) => setForm((current) => ({ ...current, lines }))}
          availability={form.source.locationId ? availability : null}
          showErrors={showErrors}
        />
      </div>
      <Field label="Notes">
        <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} />
      </Field>
      <div className="form-footer">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Create draft transfer
        </Button>
      </div>
    </form>
  )
}
