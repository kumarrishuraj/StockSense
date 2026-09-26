import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { useDebounce } from '../../hooks/useDebounce'
import { useReferenceData } from '../../hooks/useReferenceData'
import { useToast } from '../../hooks/useToast'
import { operationsService } from '../../services/inventoryService'
import { DOC_TYPES } from '../../utils/constants'
import { ErrorState } from '../common/Alert'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import PageLoader from '../common/Loading'
import Modal from '../common/Modal'
import PageHeader from '../common/PageHeader'
import Table from '../common/Table'
import OperationDetail from './OperationDetail'
import OperationFilters from './OperationFilters'

const emptyFilters = (status = '') => ({
  search: '',
  status,
  warehouse_id: '',
  location_id: '',
  product_id: '',
  date_from: '',
  date_to: '',
})

function OperationListPage({ type, description, columns, FormComponent, newLabel, initialStatus }) {
  const meta = DOC_TYPES[type]
  const toast = useToast()
  const { loaded } = useReferenceData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState(() => emptyFilters(initialStatus))
  const search = useDebounce(filters.search, 300)
  const query = { ...filters, search }
  const list = useAsync(() => operationsService.list(type, query), [query])

  // ?new=1 opens the create form (optionally with ?product=ID); ?id=N opens a document.
  const creating = searchParams.get('new') === '1'
  const selectedId = searchParams.get('id')
  const setDialog = (values) => {
    const next = new URLSearchParams(searchParams)
    ;['new', 'id', 'product'].forEach((key) => next.delete(key))
    Object.entries(values).forEach(([key, value]) => next.set(key, value))
    setSearchParams(next, { replace: true })
  }

  const handleCreated = (doc, message, tone = 'success') => {
    toast[tone](message || `${doc.reference} created as a draft.`)
    list.reload()
    setDialog({ id: doc.id })
  }

  return (
    <div className="page">
      <PageHeader
        title={meta.plural}
        description={description}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setDialog({ new: '1' })}>
            {newLabel}
          </Button>
        }
      />
      <OperationFilters type={type} filters={filters} onChange={setFilters} onClear={() => setFilters(emptyFilters())} />

      <section className="card">
        {list.error ? (
          <div className="card-body">
            <ErrorState error={list.error} onRetry={list.reload} />
          </div>
        ) : (
          <Table
            columns={columns}
            rows={list.data}
            loading={list.loading}
            onRowClick={(doc) => setDialog({ id: doc.id })}
            caption={meta.plural}
            empty={
              <EmptyState
                icon={meta.icon}
                title={`No ${meta.plural.toLowerCase()} found`}
                description="Try clearing the filters, or create a new one."
                action={
                  <Button variant="primary" size="sm" icon={Plus} onClick={() => setDialog({ new: '1' })}>
                    {newLabel}
                  </Button>
                }
              />
            }
          />
        )}
      </section>

      <Modal open={creating} size="lg" title={newLabel} onClose={() => setDialog({})}>
        {creating && !loaded && <PageLoader label="Loading warehouses and products…" />}
        {creating && loaded && (
          <FormComponent
            initialProductId={searchParams.get('product') || ''}
            onCreated={handleCreated}
            onCancel={() => setDialog({})}
          />
        )}
      </Modal>

      {selectedId && (
        <OperationDetail key={selectedId} type={type} id={selectedId} onClose={() => setDialog({})} onChanged={list.reload} />
      )}
    </div>
  )
}

// Remount when the ?status= link changes (e.g. from a dashboard KPI) so the filter follows it.
export default function OperationList(props) {
  const [searchParams] = useSearchParams()
  const status = searchParams.get('status') || ''
  return <OperationListPage key={status} initialStatus={status} {...props} />
}
