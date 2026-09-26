import { Activity, RotateCw, Save } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Field from '../../components/common/Field'
import PageHeader from '../../components/common/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import { useReferenceData } from '../../hooks/useReferenceData'
import { useToast } from '../../hooks/useToast'
import { dashboardService } from '../../services/dashboardService'
import { getPreferences, savePreferences } from '../../utils/preferences'

const API_URL = import.meta.env.VITE_API_URL || '/api (proxied by Vite to the FastAPI server)'

export default function Settings() {
  const toast = useToast()
  const { warehouses } = useReferenceData()
  const [preferences, setPreferences] = useState(getPreferences)
  const health = useAsync(() => dashboardService.health(), [])

  const set = (field) => (event) => setPreferences((current) => ({ ...current, [field]: event.target.value }))
  const save = (event) => {
    event.preventDefault()
    if (savePreferences(preferences)) toast.success('Preferences saved for this browser.')
    else toast.error('This browser blocked local storage, so preferences could not be saved.')
  }

  return (
    <div className="page">
      <PageHeader title="Settings" description="Preferences for this browser and the status of the StockSense server." />
      <div className="two-column">
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Preferences</h2>
              <p>Stored in this browser only.</p>
            </div>
          </div>
          <form className="card-body form-stack" onSubmit={save}>
            <Field label="Default warehouse" hint="Pre-selected when you create receipts, deliveries, transfers and adjustments.">
              <select className="input" value={preferences.defaultWarehouseId} onChange={set('defaultWarehouseId')}>
                <option value="">First warehouse in the list</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rows per page in Move History">
              <select className="input" value={preferences.pageSize} onChange={set('pageSize')}>
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <Button type="submit" variant="primary" icon={Save}>
                Save preferences
              </Button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>System status</h2>
              <p>Live check against the API.</p>
            </div>
            <Button size="sm" icon={RotateCw} onClick={health.reload} loading={health.loading}>
              Check
            </Button>
          </div>
          <div className="card-body">
            <dl className="meta-grid single">
              <div className="meta-item">
                <dt>API</dt>
                <dd>
                  {health.error ? (
                    <Badge tone="danger">Unreachable</Badge>
                  ) : health.data ? (
                    <Badge tone={health.data.status === 'healthy' ? 'success' : 'warning'} icon={Activity}>
                      {health.data.status}
                    </Badge>
                  ) : (
                    '…'
                  )}
                </dd>
              </div>
              <div className="meta-item">
                <dt>Database</dt>
                <dd>{health.data?.database || '—'}</dd>
              </div>
              <div className="meta-item">
                <dt>API version</dt>
                <dd>{health.data?.version || '—'}</dd>
              </div>
              <div className="meta-item">
                <dt>API address</dt>
                <dd className="mono">{API_URL}</dd>
              </div>
              <div className="meta-item">
                <dt>Password reset OTP</dt>
                <dd>
                  {health.data?.otp_dev_mode
                    ? 'Development mode: codes are shown on screen and in the server log (no email/SMS provider configured).'
                    : 'Production mode.'}
                </dd>
              </div>
            </dl>
            <p className="muted small">
              To restore the demo data, stop the backend and run <code>python -m app.seed --reset</code> in the <code>backend</code> folder.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
