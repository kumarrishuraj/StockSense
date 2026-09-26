import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useClickOutside } from '../../hooks/useClickOutside'
import { ROLE_LABELS } from '../../utils/constants'
import { initials } from '../../utils/format'

export default function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="user-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="avatar">{initials(user?.name)}</span>
        <span className="user-button-text">
          <strong>{user?.name}</strong>
          <small>{ROLE_LABELS[user?.role] || user?.role}</small>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div className="dropdown dropdown-right user-dropdown">
          <div className="dropdown-header">
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </div>
          <Link to="/profile" className="dropdown-item" onClick={() => setOpen(false)}>
            <UserRound size={16} aria-hidden="true" /> Profile
          </Link>
          <Link to="/settings" className="dropdown-item" onClick={() => setOpen(false)}>
            <Settings size={16} aria-hidden="true" /> Settings
          </Link>
          <button type="button" className="dropdown-item" onClick={logout}>
            <LogOut size={16} aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  )
}
