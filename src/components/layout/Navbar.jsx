import { Menu } from 'lucide-react'
import GlobalSearch from './GlobalSearch'
import NotificationsMenu from './NotificationsMenu'
import UserMenu from './UserMenu'

export default function Navbar({ onMenu }) {
  return (
    <header className="navbar">
      <button type="button" className="icon-btn navbar-menu" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <GlobalSearch />
      <div className="navbar-actions">
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  )
}
