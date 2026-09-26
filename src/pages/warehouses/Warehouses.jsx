import { ArrowRight, MapPin, Pencil, Plus, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Alert, { ErrorState } from '../../components/common/Alert'
import { Badge } from '../../components/common/Badge'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import EmptyState from '../../components/common/EmptyState'
import Field from '../../components/common/Field'
import PageLoader from '../../components/common/Loading'
import Modal from '../../components/common/Modal'
import PageHeader from '../../components/common/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import { useReferenceData } from '../../hooks/useReferenceData'
import { useToast } from '../../hooks/useToast'
import { locationService, warehouseService } from '../../services/inventoryService'

function WarehouseForm({ warehouse, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: warehouse?.name || '',
    code: warehouse?.code || '',
    address: warehouse?.address || '',
    create_default_location: true,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || !/^[A-Za-z0-9-]{2,10}$/.test(form.code.trim())) {
      setError('Enter a name and a 2–10 character code (letters, numbers, dashes).')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = { name: form.name.trim(), code: form.code.trim(), address: form.address }
      onSaved(
        warehouse
          ? await warehouseService.update(warehouse.id, payload)
          : await warehouseService.create({ ...payload, create_default_location: form.create_default_location }),
      )
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="form-grid-2">
        <Field label="Warehouse name" required>
          <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Main Warehouse" />
        </Field>
        <Field label="Short code" required hint="Prefix for references, e.g. MAIN/IN/00001">
          <input className="input mono" value={form.code} onChange={set('code')} maxLength={10} placeholder="MAIN" />
        </Field>
      </div>
      <Field label="Address">
        <input className="input" value={form.address} onChange={set('address')} />
      </Field>
      {!warehouse && (
        <label className="checkbox">
          <input type="checkbox" checked={form.create_default_location} onChange={set('create_default_location')} />
          Create a “Main Store” location
        </label>
      )}
      <div className="form-footer">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {warehouse ? 'Save changes' : 'Create warehouse'}
        </Button>
      </div>
    </form>
  )
}

function LocationForm({ warehouse, location, onSaved, onCancel }) {
  const [name, setName] = useState(location?.name || '')
  const [description, setDescription] = useState(location?.description || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Enter a location name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      onSaved(
        location
          ? await locationService.update(location.id, { name: name.trim(), description })
          : await locationService.create({ warehouse_id: warehouse.id, name: name.trim(), description }),
      )
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="muted">Warehouse: {warehouse.name}</p>
      <Field label="Location name" required>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Production Rack" />
      </Field>
      <Field label="Description">
        <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Aisle 3, racks A–D" />
      </Field>
      <div className="form-footer">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {location ? 'Save changes' : 'Add location'}
        </Button>
      </div>
    </form>
  )
}

export default function Warehouses() {
  const toast = useToast()
  const { refresh } = useReferenceData()
  const list = useAsync(() => warehouseService.list(), [])
  // dialog: { kind: 'warehouse' | 'location', warehouse, location? }
  const [dialog, setDialog] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const afterChange = (message) => {
    toast.success(message)
    setDialog(null)
    list.reload()
    refresh()
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      if (deleting.kind === 'warehouse') await warehouseService.remove(deleting.item.id)
      else await locationService.remove(deleting.item.id)
      afterChange(`${deleting.item.name} deleted.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  if (list.error) {
    return (
      <div className="page">
        <PageHeader title="Warehouses" />
        <ErrorState error={list.error} onRetry={list.reload} />
      </div>
    )
  }
  if (!list.data) return <PageLoader />

  return (
    <div className="page">
      <PageHeader
        title="Warehouses"
        description="Warehouses and the locations inside them. Stock is tracked per product and location."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setDialog({ kind: 'warehouse' })}>
            New warehouse
          </Button>
        }
      />

      {list.data.length === 0 && (
        <EmptyState icon={WarehouseIcon} title="No warehouses yet" description="Create your first warehouse to start receiving stock." />
      )}

      <div className="warehouse-grid">
        {list.data.map((warehouse) => (
          <section key={warehouse.id} className="card warehouse-card">
            <div className="card-header">
              <div>
                <h2>
                  {warehouse.name} <Badge tone="accent">{warehouse.code}</Badge>
                </h2>
                <p>{warehouse.address || 'No address'}</p>
              </div>
              <div className="row-actions">
                <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setDialog({ kind: 'warehouse', warehouse })} aria-label={`Edit ${warehouse.name}`} />
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleting({ kind: 'warehouse', item: warehouse })} aria-label={`Delete ${warehouse.name}`} />
              </div>
            </div>
            <div className="warehouse-stats">
              <div>
                <strong>{warehouse.location_count}</strong>
                <span>Locations</span>
              </div>
              <div>
                <strong>{warehouse.product_count}</strong>
                <span>Products in stock</span>
              </div>
            </div>
            <ul className="location-list">
              {warehouse.locations.map((location) => (
                <li key={location.id}>
                  <MapPin size={15} aria-hidden="true" />
                  <div className="cell-stack">
                    <span>{location.name}</span>
                    <small>{location.product_count ? `${location.product_count} products in stock` : 'Empty'}</small>
                  </div>
                  <div className="row-actions">
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setDialog({ kind: 'location', warehouse, location })} aria-label={`Edit ${location.name}`} />
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleting({ kind: 'location', item: location })} aria-label={`Delete ${location.name}`} />
                  </div>
                </li>
              ))}
              {warehouse.locations.length === 0 && <li className="muted">No locations yet.</li>}
            </ul>
            <div className="card-footer split">
              <Button size="sm" icon={Plus} onClick={() => setDialog({ kind: 'location', warehouse })}>
                Add location
              </Button>
              <Link to={`/warehouses/${warehouse.id}`} className="text-link">
                View stock <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </section>
        ))}
      </div>

      <Modal
        open={dialog?.kind === 'warehouse'}
        title={dialog?.warehouse ? `Edit ${dialog.warehouse.name}` : 'New warehouse'}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === 'warehouse' && (
          <WarehouseForm
            warehouse={dialog.warehouse}
            onCancel={() => setDialog(null)}
            onSaved={(saved) => afterChange(dialog.warehouse ? `${saved.name} updated.` : `${saved.name} created.`)}
          />
        )}
      </Modal>
      <Modal
        open={dialog?.kind === 'location'}
        size="sm"
        title={dialog?.location ? `Edit ${dialog.location.name}` : 'New location'}
        onClose={() => setDialog(null)}
      >
        {dialog?.kind === 'location' && (
          <LocationForm
            warehouse={dialog.warehouse}
            location={dialog.location}
            onCancel={() => setDialog(null)}
            onSaved={(saved) => afterChange(dialog.location ? `${saved.name} updated.` : `${saved.full_name} created.`)}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.item.name}?`}
        message="Only warehouses and locations without stock or operation history can be deleted."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
