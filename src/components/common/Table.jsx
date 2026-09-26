import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import EmptyState from './EmptyState'

// columns: [{ key, header, render?(row), align?, width?, sortable?, className? }]
export default function Table({ columns, rows, rowKey = 'id', onRowClick, loading, empty, sort, onSort, caption }) {
  const showSkeleton = loading && (!rows || rows.length === 0)
  const keyOf = (row) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey])

  return (
    <div className={`table-wrap${loading && rows?.length ? ' is-refreshing' : ''}`}>
      <table className="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => {
              const sorted = sort?.key === column.key
              const SortIcon = sorted ? (sort.order === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown
              return (
                <th
                  key={column.key}
                  style={{ width: column.width, textAlign: column.align }}
                  aria-sort={sorted ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.sortable && onSort ? (
                    <button type="button" className={`th-sort${sorted ? ' active' : ''}`} onClick={() => onSort(column.key)}>
                      {column.header}
                      <SortIcon size={13} aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {showSkeleton &&
            Array.from({ length: 4 }, (_, index) => (
              <tr key={`skeleton-${index}`} className="skeleton-row">
                {columns.map((column) => (
                  <td key={column.key}>
                    <span className="skeleton" />
                  </td>
                ))}
              </tr>
            ))}
          {!showSkeleton && rows?.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {empty || <EmptyState compact title="Nothing here yet" />}
              </td>
            </tr>
          )}
          {!showSkeleton &&
            rows?.map((row) => (
              <tr
                key={keyOf(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'clickable' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (event) => event.key === 'Enter' && onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} style={{ textAlign: column.align }} className={column.className}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
