import { BarChart3, Table2 } from 'lucide-react'
import { useState } from 'react'
import { DOC_TYPE_ORDER, DOC_TYPES } from '../../utils/constants'
import { parseDateOnly } from '../../utils/format'
import { ErrorState } from '../common/Alert'

const SHORT_LABELS = { receipt: 'Receipts', delivery: 'Deliveries', transfer: 'Transfers', adjustment: 'Adjustments' }
const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const longDayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

// Clean integer ticks: 0,1,2,3 for small counts; 0,5,10,15 for larger ones.
function axis(maxValue) {
  const target = Math.max(1, maxValue)
  const rawStep = target / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep))
  const max = Math.ceil(target / step) * step
  const ticks = []
  for (let value = 0; value <= max; value += step) ticks.push(value)
  return { max, ticks }
}

const total = (day) => DOC_TYPE_ORDER.reduce((sum, type) => sum + day[type], 0)

export default function ActivityChart({ days, loading, error, onRetry }) {
  const [view, setView] = useState('chart')
  const [hovered, setHovered] = useState(null)
  const data = days || []
  const { max, ticks } = axis(Math.max(0, ...data.map(total)))
  const empty = data.length > 0 && data.every((day) => total(day) === 0)
  const hoveredDay = hovered === null ? null : data[hovered]

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Operations activity</h2>
          <p>Validated operations per day, last {data.length || 14} days</p>
        </div>
        <div className="segmented" role="group" aria-label="View">
          <button type="button" className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')} aria-pressed={view === 'chart'}>
            <BarChart3 size={14} aria-hidden="true" /> Chart
          </button>
          <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} aria-pressed={view === 'table'}>
            <Table2 size={14} aria-hidden="true" /> Table
          </button>
        </div>
      </div>

      <div className="card-body">
        {error && <ErrorState error={error} onRetry={onRetry} />}
        {!error && loading && !days && <span className="skeleton skeleton-chart" />}

        {!error && days && (
          <>
            <ul className="chart-legend">
              {DOC_TYPE_ORDER.map((type) => (
                <li key={type}>
                  <span className="legend-swatch" style={{ background: DOC_TYPES[type].color }} aria-hidden="true" />
                  {SHORT_LABELS[type]}
                </li>
              ))}
            </ul>

            {view === 'chart' ? (
              <div className="chart" onMouseLeave={() => setHovered(null)}>
                <div className="chart-y" aria-hidden="true">
                  {[...ticks].reverse().map((tick) => (
                    <span key={tick}>{tick}</span>
                  ))}
                </div>
                <div className="chart-plot">
                  {ticks.map((tick) => (
                    <span key={tick} className="chart-grid" style={{ bottom: `${(tick / max) * 100}%` }} aria-hidden="true" />
                  ))}
                  {empty && <div className="chart-empty">No validated operations in this period</div>}
                  <div className="chart-columns">
                    {data.map((day, index) => {
                      const dayTotal = total(day)
                      const label = `${longDayFormat.format(parseDateOnly(day.date))}: ${DOC_TYPE_ORDER.map(
                        (type) => `${day[type]} ${SHORT_LABELS[type].toLowerCase()}`,
                      ).join(', ')}`
                      return (
                        <div
                          key={day.date}
                          className={`chart-col${hovered === index ? ' hovered' : ''}`}
                          onMouseEnter={() => setHovered(index)}
                          onFocus={() => setHovered(index)}
                          onBlur={() => setHovered(null)}
                          tabIndex={0}
                          aria-label={label}
                        >
                          <div className="chart-bar" style={{ height: `${(dayTotal / max) * 100}%` }}>
                            {DOC_TYPE_ORDER.filter((type) => day[type] > 0).map((type) => (
                              <span key={type} className="chart-segment" style={{ flexGrow: day[type], background: DOC_TYPES[type].color }} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {hoveredDay && (
                    <div
                      className={`chart-tooltip ${hovered >= data.length / 2 ? 'to-left' : 'to-right'}`}
                      style={{ left: `${((hovered + 0.5) / data.length) * 100}%` }}
                      role="presentation"
                    >
                      <strong>{longDayFormat.format(parseDateOnly(hoveredDay.date))}</strong>
                      {DOC_TYPE_ORDER.map((type) => (
                        <div key={type} className="chart-tooltip-row">
                          <span className="legend-swatch" style={{ background: DOC_TYPES[type].color }} aria-hidden="true" />
                          <span>{SHORT_LABELS[type]}</span>
                          <strong>{hoveredDay[type]}</strong>
                        </div>
                      ))}
                      <div className="chart-tooltip-row total">
                        <span>Total</span>
                        <strong>{total(hoveredDay)}</strong>
                      </div>
                    </div>
                  )}
                </div>
                <div className="chart-x" aria-hidden="true">
                  {data.map((day, index) => (
                    <span key={day.date}>{index % 2 === data.length % 2 || index === data.length - 1 ? dayFormat.format(parseDateOnly(day.date)) : ''}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="table-wrap chart-table">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      {DOC_TYPE_ORDER.map((type) => (
                        <th key={type} style={{ textAlign: 'right' }}>
                          {SHORT_LABELS[type]}
                        </th>
                      ))}
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data].reverse().map((day) => (
                      <tr key={day.date}>
                        <td>{longDayFormat.format(parseDateOnly(day.date))}</td>
                        {DOC_TYPE_ORDER.map((type) => (
                          <td key={type} className="num">
                            {day[type]}
                          </td>
                        ))}
                        <td className="num">
                          <strong>{total(day)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
