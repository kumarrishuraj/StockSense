import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { ToastContext } from './contexts'

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }
let nextId = 1

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const show = useCallback(
    (type, message) => {
      const id = nextId++
      setToasts((current) => [...current.slice(-3), { id, type, message }])
      setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4500)
    },
    [dismiss],
  )

  const toast = useMemo(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
      info: (message) => show('info', message),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(({ id, type, message }) => {
          const Icon = ICONS[type]
          return (
            <div key={id} className={`toast toast-${type}`}>
              <Icon size={18} aria-hidden="true" />
              <span>{message}</span>
              <button type="button" className="icon-btn" onClick={() => dismiss(id)} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
