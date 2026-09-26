import { ArrowLeftRight, BarChart3, History, ShieldCheck } from 'lucide-react'
import Logo from '../common/Logo'

const FEATURES = [
  { icon: BarChart3, text: 'Live stock per product, warehouse and location' },
  { icon: ArrowLeftRight, text: 'Receipts, deliveries, transfers and adjustments' },
  { icon: History, text: 'A complete, searchable stock ledger' },
  { icon: ShieldCheck, text: 'Low-stock alerts before shelves run empty' },
]

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-logo">
          <Logo size={36} />
          <strong>StockSense</strong>
        </div>
        <div className="auth-pitch">
          <h2>Every unit, every location, always up to date.</h2>
          <p>Replace manual registers and scattered spreadsheets with one inventory system your whole warehouse team can trust.</p>
          <ul>
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon size={18} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <small className="auth-brand-foot">Odoo × LPU Jalandhar Hackathon 2026</small>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card-logo">
            <Logo size={32} />
            <strong>StockSense</strong>
          </div>
          <h1>{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
