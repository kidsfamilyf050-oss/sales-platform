import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useHeartbeat } from '../../hooks/useHeartbeat'

export default function Layout() {
  useHeartbeat()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer: slides in from left, hidden on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-50 md:hidden
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop: Sidebar's fixed <aside> (hidden md:flex fixed ...) lives outside
          the flex flow by virtue of position:fixed. We render a zero-size wrapper
          on desktop-only so the component mounts and the hover state works. */}
      <div className="hidden md:block" aria-hidden>
        <Sidebar />
      </div>

      {/* Main content: md:pl-16 reserves 64px for the collapsed icon-strip sidebar */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 md:pl-16">
        <Header onMenuClick={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
