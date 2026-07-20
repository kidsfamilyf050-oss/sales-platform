import { Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import { useAdminStore } from '../../store/adminAuth'
import { Shield, Building2, Users, BarChart2, LogOut, History } from 'lucide-react'

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const { pathname } = useLocation()
  const active = pathname === to || pathname.startsWith(to + '/')
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  )
}

export default function AdminLayout() {
  const { token, admin, logout } = useAdminStore()
  if (!token) return <Navigate to="/admin/login" replace />

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4">
        <div className="flex items-center gap-2 mb-8 px-1">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Admin Panel</span>
        </div>
        <nav className="flex-1 space-y-1">
          <NavItem to="/admin" icon={BarChart2} label="Статистика" />
          <NavItem to="/admin/companies" icon={Building2} label="Компании" />
          <NavItem to="/admin/users" icon={Users} label="Пользователи" />
          <NavItem to="/admin/audit" icon={History} label="История" />
        </nav>
        <div className="border-t border-gray-800 pt-4 mt-4">
          <div className="text-xs text-gray-500 px-1 mb-3 truncate">{admin?.email}</div>
          <button
            onClick={() => { logout(); window.location.href = '/admin/login' }}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors px-1"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
