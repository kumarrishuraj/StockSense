import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import ReferenceDataProvider from '../../context/ReferenceDataProvider'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ReferenceDataProvider>
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
        <div className="app-main">
          <Navbar onMenu={() => setSidebarOpen(true)} />
          <main className="app-content">
            <Outlet />
          </main>
        </div>
      </div>
    </ReferenceDataProvider>
  )
}
