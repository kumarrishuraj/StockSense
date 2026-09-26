import { Package, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useDebounce } from '../../hooks/useDebounce'
import { dashboardService } from '../../services/dashboardService'
import { DOC_TYPES } from '../../utils/constants'
import { formatQty } from '../../utils/format'
import { DocTypeLabel, StatusBadge, StockBadge } from '../common/Badge'
import { Spinner } from '../common/Loading'

export default function GlobalSearch() {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState({ query: '', products: [], operations: [], error: null })
  const debounced = useDebounce(query.trim(), 250)

  useClickOutside(containerRef, () => setOpen(false), open)

  useEffect(() => {
    if (!debounced) return undefined
    let active = true
    dashboardService.search(debounced).then(
      (data) => active && setResults({ query: debounced, ...data, error: null }),
      (error) => active && setResults({ query: debounced, products: [], operations: [], error }),
    )
    return () => {
      active = false
    }
  }, [debounced])

  // "/" focuses the search from anywhere, like most SaaS tools.
  useEffect(() => {
    const onKeyDown = (event) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (event.key === '/' && !typing) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const go = (path) => {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  const loading = Boolean(debounced) && results.query !== debounced
  const empty = !loading && results.products.length === 0 && results.operations.length === 0

  return (
    <div className="global-search" ref={containerRef}>
      <Search size={16} className="global-search-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search products, SKUs, references…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        aria-label="Search everything"
      />
      <kbd className="global-search-kbd">/</kbd>

      {open && debounced && (
        <div className="dropdown search-results">
          {loading && (
            <div className="dropdown-state">
              <Spinner size={16} /> Searching…
            </div>
          )}
          {!loading && results.error && <div className="dropdown-state">{results.error.message}</div>}
          {!loading && !results.error && empty && <div className="dropdown-state">No matches for “{debounced}”</div>}

          {!loading && results.products.length > 0 && (
            <div className="dropdown-section">
              <div className="dropdown-label">Products</div>
              {results.products.map((product) => (
                <button key={product.id} type="button" className="dropdown-item" onClick={() => go(`/products/${product.id}`)}>
                  <Package size={16} aria-hidden="true" />
                  <span className="dropdown-item-main">
                    <strong>{product.name}</strong>
                    <small>
                      {product.sku} · {formatQty(product.total_on_hand, product.unit)}
                    </small>
                  </span>
                  <StockBadge status={product.stock_status} />
                </button>
              ))}
            </div>
          )}

          {!loading && results.operations.length > 0 && (
            <div className="dropdown-section">
              <div className="dropdown-label">Operations</div>
              {results.operations.map((operation) => (
                <button
                  key={`${operation.document_type}-${operation.id}`}
                  type="button"
                  className="dropdown-item"
                  onClick={() => go(`${DOC_TYPES[operation.document_type].path}?id=${operation.id}`)}
                >
                  <DocTypeLabel type={operation.document_type} />
                  <span className="dropdown-item-main">
                    <strong>{operation.reference}</strong>
                    <small>{operation.partner || operation.summary}</small>
                  </span>
                  <StatusBadge status={operation.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
