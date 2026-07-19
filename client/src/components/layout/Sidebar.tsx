import { NavLink } from 'react-router-dom'
import { BarChart2, Users, FileText, Settings, TrendingUp, Target, LogOut, Activity } from 'lucide-react'
import { useAuthStore } from '../../store/auth'

const navByRole: Record<string, { to: string; label: string; icon: any }[]> = {
  OWNER: [
    { to: '/dashboard/owner', label: 'Дашборд', icon: BarChart2 },
    { to: '/tracking', label: 'Контроль', icon: Activity },
    { to: '/marketing', label: 'Маркетинг', icon: TrendingUp },
    { to: '/users', label: 'Сотрудники', icon: Users },
    { to: '/plans', label: 'Планы', icon: Target },
    { to: '/settings', label: 'Настройки', icon: Settings },
  ],
  ROP: [
    { to: '/dashboard/rop', label: 'Дашборд', icon: BarChart2 },
    { to: '/tracking', label: 'Контроль', icon: Activity },
    { to: '/marketing', label: 'Маркетинг', icon: TrendingUp },
    { to: '/users', label: 'Сотрудники', icon: Users },
    { to: '/plans', label: 'Планы', icon: Target },
    { to: '/settings', label: 'Настройки', icon: Settings },
  ],
  MANAGER: [
    { to: '/dashboard/manager', label: 'Мой кабинет', icon: BarChart2 },
    { to: '/report', label: 'Заполнить отчёт', icon: FileText },
  ],
  MARKETER: [
    { to: '/dashboard/marketer', label: 'Мой кабинет', icon: TrendingUp },
    { to: '/report', label: 'Заполнить отчёт', icon: FileText },
  ],
}

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navItems = user ? (navByRole[user.role] || []) : []

  return (
    <aside className="w-60 bg-white border-r border-gray-100 flex flex-col">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">SalesPlatform</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </aside>
  )
}
