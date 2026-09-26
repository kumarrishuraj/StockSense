import { ArrowDownToLine, ArrowLeftRight, ClipboardCheck, History, Pencil, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState } from '../../components/common/Alert'
import { Badge, DocTypeLabel, StockBadge } from '../../components/common/Badge'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import PageLoader from '../../components/common/Loading'
import Modal from '../../components/common/Modal'
import PageHeader from '../../components/common/PageHeader'
import ProductForm from '../../components/products/ProductForm'
import { useAsync } from '../../hooks/useAsync'
import { useReferenceData } from '../../hooks/useReferenceData'
import { useToast } from '../../hooks/useToast'
import { productService } from '../../services/productService'
import { DOC_TYPES } from '../../utils/constants'
import { formatDateTime, formatQty } from '../../utils/format'

function movementQuantity(movement) {
  const text = formatQty(movement.quantity, movement.unit)
  if (movement.direction === 'in') return <strong className="text-success">+{text}</strong>
  if (movement.direction === 'out') return <strong className="text-danger">−{text}</strong>
  return <strong>{text}</strong>
}

export default function ProductDetail() {
  const { id } = useParams()
  const toast = useToast()
  const { refresh } = useReferenceData()
  const [editing, setEditing] = useState(false)
  const { data: product, error, reload } = useAsync(() => productService.get(id), [id])

  if (error) {
    return (
      <div className="page">
        <PageHeader title="Product" back={{ to: '/products', label: 'Products' }} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    )
  }
  if (!product) return <PageLoader />

  const maxAtLocation = Math.max(0, ...product.stock_by_location.map((row) => row.quantity))

  return (
    <div className="page">
      <PageHeader
        back={{ to: '/products', label: 'Products' }}
        title={product.name}
        description={
          <span className="header-meta">
            <span className="mono">{product.sku}</span>
            {product.category_name && <Badge>{product.category_name}</Badge>}
            {product.is_active ? <StockBadge status={product.stock_status} /> : <Badge>Inactive</Badge>}
          </span>
        }
        actions={
          <>
            <Link to={`/receipts?new=1&product=${product.id}`} className="btn btn-secondary">
              <ArrowDownToLine size={16} aria-hidden="true" /> Receive
            </Link>
            <Link to={`/deliveries?new=1&product=${product.id}`} className="btn btn-secondary">
              <Truck size={16} aria-hidden="true" /> Deliver
            </Link>
            <Link to={`/transfers?new=1&product=${product.id}`} className="btn btn-secondary">
              <ArrowLeftRight size={16} aria-hidden="true" /> Transfer
            </Link>
            <Link to={`/adjustments?new=1&product=${product.id}`} className="btn btn-secondary">
              <ClipboardCheck size={16} aria-hidden="true" /> Adjust
            </Link>
            <Button variant="primary" icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        }
      />

      <div className="detail-stats">
        <div className="detail-stat hero">
          <span>Total on hand</span>
          <strong>{formatQty(product.total_on_hand, product.unit)}</strong>
        </div>
        <div className="detail-stat">
          <span>Reorder level</span>
          <strong>{formatQty(product.reorder_level, product.unit)}</strong>
        </div>
        <div className="detail-stat">
          <span>Locations holding stock</span>
          <strong>{product.stock_by_location.filter((row) => row.quantity > 0).length}</strong>
        </div>
        <div className="detail-stat">
          <span>Unit of measure</span>
          <strong>{product.unit}</strong>
        </div>
      </div>
      {product.description && <p className="product-description">{product.description}</p>}

      <div className="two-column">
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Stock by location</h2>
              <p>Where the {formatQty(product.total_on_hand, product.unit)} are right now</p>
            </div>
          </div>
          {product.stock_by_location.length === 0 ? (
            <div className="card-body">
              <EmptyState compact title="Never stocked" description="Receive this product to put it on a shelf." />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                    <th style={{ width: '35%' }}>
                      <span className="sr-only">Share</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {product.stock_by_location.map((row) => (
                    <tr key={row.location_id}>
                      <td>
                        <div className="cell-stack">
                          <span>{row.location_name}</span>
                          <small>
                            <Link to={`/warehouses/${row.warehouse_id}`}>{row.warehouse_name}</Link>
                          </small>
                        </div>
                      </td>
                      <td className="num">
                        <strong>{formatQty(row.quantity, product.unit)}</strong>
                      </td>
                      <td>
                        <div className="meter" aria-hidden="true">
                          <span className="meter-fill in_stock" style={{ width: `${maxAtLocation ? (row.quantity / maxAtLocation) * 100 : 0}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>Recent movements</h2>
              <p>Last 10 ledger entries</p>
            </div>
            <Link to={`/move-history?product_id=${product.id}`} className="text-link">
              <History size={14} aria-hidden="true" /> Full history
            </Link>
          </div>
          {product.recent_movements.length === 0 ? (
            <div className="card-body">
              <EmptyState compact title="No movements yet" />
            </div>
          ) : (
            <ul className="movement-list">
              {product.recent_movements.map((movement) => (
                <li key={movement.id}>
                  <DocTypeLabel type={movement.operation} />
                  <div className="cell-stack">
                    <Link className="mono" to={`${DOC_TYPES[movement.operation].path}?id=${movement.document_id}`}>
                      {movement.reference}
                    </Link>
                    <small>
                      {movement.source_name} → {movement.destination_name}
                    </small>
                  </div>
                  <div className="movement-meta">
                    {movementQuantity(movement)}
                    <small>{formatDateTime(movement.created_at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal open={editing} size="lg" title={`Edit ${product.name}`} onClose={() => setEditing(false)}>
        {editing && (
          <ProductForm
            product={product}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              toast.success(`${saved.name} updated.`)
              setEditing(false)
              reload()
              refresh()
            }}
          />
        )}
      </Modal>
    </div>
  )
}
