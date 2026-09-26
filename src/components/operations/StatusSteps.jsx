import { Check, XCircle } from 'lucide-react'
import { STATUS_META } from '../../utils/constants'

const FLOWS = {
  receipt: ['draft', 'done'],
  delivery: ['draft', 'picked', 'packed', 'done'],
  transfer: ['draft', 'done'],
  adjustment: ['draft', 'done'],
}

export default function StatusSteps({ type, status }) {
  if (status === 'cancelled') {
    return (
      <div className="steps cancelled">
        <XCircle size={16} aria-hidden="true" /> This document was cancelled. It did not change any stock.
      </div>
    )
  }
  const flow = FLOWS[type]
  const current = flow.indexOf(status)
  return (
    <ol className="steps" aria-label="Progress">
      {flow.map((step, index) => {
        const state = index < current || status === 'done' ? 'complete' : index === current ? 'current' : 'upcoming'
        return (
          <li key={step} className={`step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="step-dot">{state === 'complete' ? <Check size={12} aria-hidden="true" /> : index + 1}</span>
            <span className="step-label">{STATUS_META[step].label}</span>
          </li>
        )
      })}
    </ol>
  )
}
