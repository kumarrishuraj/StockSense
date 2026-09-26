import { ArrowLeftRight, Download, FilterX, History, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorState } from '../../components/common/Alert'
import { DocTypeLabel, StatusBadge } from '../../components/common/Badge'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import PageHeader from '../../components/common/PageHeader'
import Pagination from '../../components/common/Pagination'
import Table from '../../components/common/Table'
import { useAsync } from '../../hooks/useAsync'
import { useDebounce } from '../../hooks/useDebounce'
import { useReferenceData } from '../../hooks/useReferenceData'
import { useToast } from '../../hooks/useToast'
import { inventoryService } from '../../services/inventoryService'
import { DOC_TYPE_ORDER, DOC_TYPES } from '../../utils/constants'
import { formatDateTime, formatQty, localDayStartISO } from '../../utils/format'
import { getPreferences } from '../../utils/preferences'

function SignedQuantity({ movement }) {
  const text = formatQty(movement.quantity, movement.unit)
  if (movement.direction === 'in') return <strong className="text-success nowrap">+{text}</strong>
  if (movement.direction === 'out') return <strong className="text-danger nowrap">−{text}</strong>
  return (
    <strong className="nowrap" title="Moved between locations">
      <ArrowLeftRight size={12} aria-hidden="true" /> {text}
    </strong>
  )
}

const columns = [
  { key: 'date', header: 'Date', sortable: true, render: (m) => <span className="nowrap">{formatDateTime(m.created_at)}</span> },
  {
    key: 'reference',
    header: 'Reference',
    sortable: true,
    render: (m) =>
      m.document_id ? (
        <Link className="mono" to={`${DOC_TYPES[m.operation].path}?id=${m.document_id}`}>
          {m.reference}
        </Link>
      ) : (
        <span className="mono">{m.reference}</span>
      ),
  },
  {
    key: 'product',
    header: 'Product',
    sortable: true,
    render: (m) => (
      <div className="cell-stack">
        <Link to={`/products/${m.product_id}`}>{m.product_name}</Link>
        <small className="mono">{m.sku}</small>
      </div>
    ),
  },
  { key: 'operation', header: 'Operation', sortable: true, render: (m) => <DocTypeLabel type={m.operation} /> },
  { key: 'from', header: 'From', render: (m) => <span className="location-cell">{m.source_name}</span> },
  { key: 'to', header: 'To', render: (m) => <span className="location-cell">{m.destination_name}</span> },
  { key: 'quantity', header: 'Quantity', sortable: true, align: 'right', render: (m) => <SignedQuantity movement={m} /> },
  { key: 'user', header: 'User', render: (m) => m.user_name || '—' },
  { key: 'status', header: 'Status', render: (m) => <StatusBadge status={m.status} /> },
]

const emptyFilters = { search: '', operation: '', product_id: '', warehouse_id: '', location_id: '', date_from: '', date_to: '' }

function toQuery(filters, search) {
  return {
    ...filters,
    search,
    date_from: filters.date_from ? localDayStartISO(filters.date_from) : '',
    date_to: filters.date_to ? localDayStartISO(filters.date_to, 1) : '',
  }
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function MoveHistoryPage({ initialSearch, initialProductId }) {
  const toast = useToast()
  const { warehouses, products, locationsFor } = useReferenceData()
  const [filters, setFilters] = useState({ ...emptyFilters, search: initialSearch, product_id: initialProductId })
  const [sort, setSort] = useState({ key: 'date', order: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize] = useState(() => Number(getPreferences().pageSize) || 25)
  const [exporting, setExporting] = useState(false)
  const search = useDebounce(filters.search, 300)
  const query = { ...toQuery(filters, search), sort: sort.key, order: sort.order }

  const movements = useAsync(() => inventoryService.movements({ ...query, page, page_size: pageSize }), [query, page, pageSize])
  const data = movements.data

  const setFilter = (field) => (event) => {
    setFilters((current) => ({ ...current, [field]: event.target.value, ...(field === 'warehouse_id' ? { location_id: '' } : {}) }))
    setPage(1)
  }
  const onSort = (key) => {
    setSort((current) => (current.key === key ? { key, order: current.order === 'asc' ? 'desc' : 'asc' } : { key, order: key === 'date' ? 'desc' : 'asc' }))
    setPage(1)
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = []
      for (let next = 1; ; next += 1) {
        const result = await inventoryService.movements({ ...query, page: next, page_size: 200 })
        rows.push(...result.items)
        if (rows.length >= result.total || result.items.length === 0) break
      }
      const header = ['Date', 'Reference', 'Operation', 'Product', 'SKU', 'From', 'To', 'Direction', 'Quantity', 'Unit', 'User', 'Status']
      const lines = rows.map((m) =>
        [m.created_at, m.reference, m.operation, m.product_name, m.sku, m.source_name, m.destination_name, m.direction, m.quantity, m.unit, m.user_name, m.status]
          .map(csvCell)
          .join(','),
      )
      const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `stocksense-move-history-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${rows.length} movements.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setExporting(false)
    }
  }

  const active = Object.values(filters).some(Boolean)

  return (
    <div className="page">
      <PageHeader
        title="Move History"
        description="The stock ledger: every quantity moved by a validated receipt, delivery, transfer or adjustment."
        actions={
          <Button icon={Download} onClick={exportCsv} loading={exporting} disabled={!data?.total}>
            Export CSV
          </Button>
        }
      />

      <div className="filter-bar" role="group" aria-label="Filters">
        <div className="search-input">
          <Search size={16} aria-hidden="true" />
          <input className="input" type="search" placeholder="Search reference, product, SKU, partner…" value={filters.search} onChange={setFilter('search')} aria-label="Search" />
        </div>
        <select className="input" value={filters.operation} onChange={setFilter('operation')} aria-label="Operation type">
          <option value="">All operations</option>
          {DOC_TYPE_ORDER.map((type) => (
            <option key={type} value={type}>
              {DOC_TYPES[type].plural}
            </option>
          ))}
        </select>
        <select className="input" value={filters.product_id} onChange={setFilter('product_id')} aria-label="Product">
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <select className="input" value={filters.warehouse_id} onChange={setFilter('warehouse_id')} aria-label="Warehouse">
          <option value="">All warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
        <select className="input" value={filters.location_id} onChange={setFilter('location_id')} aria-label="Location">
          <option value="">All locations</option>
          {locationsFor(filters.warehouse_id).map((location) => (
            <option key={location.id} value={location.id}>
              {filters.warehouse_id ? location.name : location.full_name}
            </option>
          ))}
        </select>
        <div className="date-range">
          <input className="input" type="date" value={filters.date_from} onChange={setFilter('date_from')} aria-label="From date" />
          <span aria-hidden="true">–</span>
          <input className="input" type="date" value={filters.date_to} onChange={setFilter('date_to')} aria-label="To date" />
        </div>
        {active && (
          <Button
            variant="ghost"
            icon={FilterX}
            onClick={() => {
              setFilters(emptyFilters)
              setPage(1)
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <section className="card">
        {movements.error ? (
          <div className="card-body">
            <ErrorState error={movements.error} onRetry={movements.reload} />
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              rows={data?.items}
              loading={movements.loading}
              sort={sort}
              onSort={onSort}
              caption="Stock movements"
              empty={<EmptyState icon={History} title="No stock movements found" description="Validated operations appear here automatically." />}
            />
            {data && data.total > 0 && <Pagination page={page} pageSize={pageSize} total={data.total} onChange={setPage} />}
          </>
        )}
      </section>
    </div>
  )
}

export default function MoveHistory() {
  const [searchParams] = useSearchParams()
  const search = searchParams.get('search') || ''
  const productId = searchParams.get('product_id') || ''
  return <MoveHistoryPage key={`${search}|${productId}`} initialSearch={search} initialProductId={productId} />
}
