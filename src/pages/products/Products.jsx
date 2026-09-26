import { Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorState } from '../../components/common/Alert'
import { Badge, StockBadge } from '../../components/common/Badge'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import PageLoader from '../../components/common/Loading'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'
import PageHeader from '../../components/common/PageHeader'
import Table from '../../components/common/Table'
import ProductForm from '../../components/products/ProductForm'
import ProductSearch from '../../components/products/ProductSearch'
import { useAsync } from '../../hooks/useAsync'
import { useDebounce } from '../../hooks/useDebounce'
import { useReferenceData } from '../../hooks/useReferenceData'
import { useToast } from '../../hooks/useToast'
import { productService } from '../../services/productService'
import { formatNumber, formatQty } from '../../utils/format'

const emptyFilters = (stockStatus = '', categoryId = '') => ({
  search: '',
  category_id: categoryId,
  warehouse_id: '',
  location_id: '',
  stock_status: stockStatus,
  include_inactive: false,
})

function ProductsPage({ initialStatus, initialCategory, openCreate }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { refresh, loaded } = useReferenceData()
  const [filters, setFilters] = useState(() => emptyFilters(initialStatus, initialCategory))
  const [editing, setEditing] = useState(openCreate ? 'new' : null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const search = useDebounce(filters.search, 300)
  const query = { ...filters, search, include_inactive: filters.include_inactive || '' }
  const scoped = Boolean(filters.warehouse_id || filters.location_id)
  const list = useAsync(() => productService.list(query), [query])

  const saved = (product) => {
    toast.success(editing === 'new' ? `${product.name} created.` : `${product.name} updated.`)
    setEditing(null)
    list.reload()
    refresh()
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      const result = await productService.remove(deleting.id)
      toast[result.deleted ? 'success' : 'info'](result.message)
      list.reload()
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Product',
      render: (product) => (
        <div className="cell-stack">
          <Link to={`/products/${product.id}`} onClick={(event) => event.stopPropagation()}>
            <strong>{product.name}</strong>
          </Link>
          <small className="mono">{product.sku}</small>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (product) => product.category_name || <span className="muted">Uncategorized</span> },
    {
      key: 'on_hand',
      header: scoped ? 'On hand (here / total)' : 'On hand',
      align: 'right',
      render: (product) => (
        <span className="nowrap">
          <strong>{formatQty(product.on_hand, product.unit)}</strong>
          {scoped && <small className="muted"> / {formatNumber(product.total_on_hand)}</small>}
        </span>
      ),
    },
    { key: 'reorder', header: 'Reorder at', align: 'right', render: (product) => formatQty(product.reorder_level, product.unit) },
    {
      key: 'status',
      header: 'Status',
      render: (product) =>
        product.is_active ? <StockBadge status={product.stock_status} /> : <Badge tone="neutral">Inactive</Badge>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (product) => (
        <div className="row-actions" onClick={(event) => event.stopPropagation()}>
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(product)} aria-label={`Edit ${product.name}`} />
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleting(product)} aria-label={`Delete ${product.name}`} />
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Products"
        description="Your catalogue with live stock across every location."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
            New product
          </Button>
        }
      />
      <ProductSearch filters={filters} onChange={setFilters} onClear={() => setFilters(emptyFilters())} />

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
            onRowClick={(product) => navigate(`/products/${product.id}`)}
            caption="Products"
            empty={
              <EmptyState
                icon={Package}
                title="No products match"
                description={scoped ? 'Nothing is in stock at this warehouse/location.' : 'Try a different search, or add a product.'}
              />
            }
          />
        )}
        {list.data?.length > 0 && <div className="card-footer muted">{list.data.length} products</div>}
      </section>

      <Modal open={Boolean(editing)} size="lg" title={editing === 'new' ? 'New product' : `Edit ${editing?.name}`} onClose={() => setEditing(null)}>
        {editing && !loaded && <PageLoader />}
        {editing && loaded && <ProductForm product={editing === 'new' ? null : editing} onSaved={saved} onCancel={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        message="Products that were never used are deleted. Products with stock history are deactivated instead, so the ledger stays complete."
        confirmLabel="Delete product"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

export default function Products() {
  const [searchParams] = useSearchParams()
  const status = searchParams.get('stock_status') || ''
  const category = searchParams.get('category_id') || ''
  return (
    <ProductsPage
      key={`${status}|${category}`}
      initialStatus={status}
      initialCategory={category}
      openCreate={searchParams.get('new') === '1'}
    />
  )
}
