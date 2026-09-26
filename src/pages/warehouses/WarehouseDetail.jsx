import { MapPin, Package, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState } from '../../components/common/Alert'
import { Badge, StockBadge } from '../../components/common/Badge'
import EmptyState from '../../components/common/EmptyState'
import PageLoader from '../../components/common/Loading'
import PageHeader from '../../components/common/PageHeader'
import Table from '../../components/common/Table'
import { useAsync } from '../../hooks/useAsync'
import { useDebounce } from '../../hooks/useDebounce'
import { inventoryService, warehouseService } from '../../services/inventoryService'
import { formatDateTime, formatQty } from '../../utils/format'

const columns = [
  {
    key: 'product',
    header: 'Product',
    render: (row) => (
      <div className="cell-stack">
        <Link to={`/products/${row.product_id}`}>{row.product_name}</Link>
        <small className="mono">{row.sku}</small>
      </div>
    ),
  },
  { key: 'category_name', header: 'Category', render: (row) => row.category_name || <span className="muted">—</span> },
  { key: 'location_name', header: 'Location' },
  { key: 'quantity', header: 'Quantity', align: 'right', render: (row) => <strong>{formatQty(row.quantity, row.unit)}</strong> },
  { key: 'status', header: 'Product status', render: (row) => <StockBadge status={row.stock_status} /> },
  { key: 'updated_at', header: 'Last movement', render: (row) => formatDateTime(row.updated_at) },
]

export default function WarehouseDetail() {
  const { id } = useParams()
  const warehouse = useAsync(() => warehouseService.get(id), [id])
  const [locationId, setLocationId] = useState('')
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 300)
  const stock = useAsync(
    () => inventoryService.list({ warehouse_id: id, location_id: locationId, search: debounced }),
    [id, locationId, debounced],
  )

  if (warehouse.error) {
    return (
      <div className="page">
        <PageHeader title="Warehouse" back={{ to: '/warehouses', label: 'Warehouses' }} />
        <ErrorState error={warehouse.error} onRetry={warehouse.reload} />
      </div>
    )
  }
  if (!warehouse.data) return <PageLoader />
  const data = warehouse.data

  return (
    <div className="page">
      <PageHeader
        back={{ to: '/warehouses', label: 'Warehouses' }}
        title={data.name}
        description={
          <span className="header-meta">
            <Badge tone="accent">{data.code}</Badge>
            {data.address && <span>{data.address}</span>}
          </span>
        }
      />

      <div className="location-chips" role="group" aria-label="Filter by location">
        <button type="button" className={`chip${locationId === '' ? ' active' : ''}`} onClick={() => setLocationId('')}>
          All locations <span>{data.product_count}</span>
        </button>
        {data.locations.map((location) => (
          <button
            key={location.id}
            type="button"
            className={`chip${String(location.id) === locationId ? ' active' : ''}`}
            onClick={() => setLocationId(String(location.id))}
          >
            <MapPin size={13} aria-hidden="true" /> {location.name} <span>{location.product_count}</span>
          </button>
        ))}
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Stock on hand</h2>
            <p>Products with a positive quantity {locationId ? 'at this location' : 'in this warehouse'}</p>
          </div>
          <div className="search-input compact">
            <Search size={16} aria-hidden="true" />
            <input className="input" type="search" placeholder="Filter products…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Filter products" />
          </div>
        </div>
        {stock.error ? (
          <div className="card-body">
            <ErrorState error={stock.error} onRetry={stock.reload} />
          </div>
        ) : (
          <Table
            columns={columns}
            rows={stock.data}
            rowKey={(row) => `${row.product_id}-${row.location_id}`}
            loading={stock.loading}
            caption={`Stock in ${data.name}`}
            empty={<EmptyState compact icon={Package} title="No stock here" description="Receive or transfer products into this warehouse." />}
          />
        )}
      </section>
    </div>
  )
}
