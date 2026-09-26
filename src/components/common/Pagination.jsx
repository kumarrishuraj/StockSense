import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '../../utils/format'
import Button from './Button'

export default function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  return (
    <div className="pagination">
      <span>
        {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)}
      </span>
      <div className="pagination-buttons">
        <Button size="sm" icon={ChevronLeft} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page" />
        <span className="pagination-page">
          Page {page} of {pages}
        </span>
        <Button size="sm" icon={ChevronRight} onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page" />
      </div>
    </div>
  )
}
