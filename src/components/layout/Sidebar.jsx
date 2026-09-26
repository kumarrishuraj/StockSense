import {
  ArrowDownToLine,
  ArrowLeftRight,
  ChevronDown,
  ClipboardCheck,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Tags,
  Truck,
  UserRound,
  Warehouse,
  Workflow,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Logo from '../common/Logo'

const OPERATIONS = [
  { to: '/receipts', label: 'Receipts', icon: ArrowDownToLine },
  { to: '/deliveries', label: 'Delivery Orders', icon: Truck },
  { to: '/adjustments', label: 'Inventory Adjustments', icon: ClipboardCheck },
  { to: '/transfers', label: 'Internal Transfers', icon: ArrowLeftRight },
  { to: '/move-history', label: 'Move History', icon: History },
]

function Item({ to, label, icon: Icon, onNavigate }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onNavigate}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const inOperations = OPERATIONS.some((item) => pathname.startsWith(item.to))
  const [operationsOpen, setOperationsOpen] = useState(true)

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <Logo />
        <div>
          <strong>StockSense</strong>
          <span>Inventory Management</span>
        </div>
        <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <Item to="/dashboard" label="Dashboard" icon={LayoutDashboard} onNavigate={onClose} />
        <Item to="/products" label="Products" icon={Package} onNavigate={onClose} />

        <button
          type="button"
          className={`nav-item nav-group${inOperations ? ' contains-active' : ''}`}
          onClick={() => setOperationsOpen((value) => !value)}
          aria-expanded={operationsOpen}
        >
          <Workflow size={18} aria-hidden="true" />
          <span>Operations</span>
          <ChevronDown size={16} className={`chevron${operationsOpen ? ' open' : ''}`} aria-hidden="true" />
        </button>
        {operationsOpen && (
          <div className="nav-children">
            {OPERATIONS.map((item) => (
              <Item key={item.to} {...item} onNavigate={onClose} />
            ))}
          </div>
        )}

        <Item to="/warehouses" label="Warehouses" icon={Warehouse} onNavigate={onClose} />
        <Item to="/categories" label="Categories" icon={Tags} onNavigate={onClose} />
      </nav>

      <div className="sidebar-footer">
        <Item to="/settings" label="Settings" icon={Settings} onNavigate={onClose} />
        <Item to="/profile" label="Profile" icon={UserRound} onNavigate={onClose} />
        <button type="button" className="nav-item" onClick={logout}>
          <LogOut size={18} aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
