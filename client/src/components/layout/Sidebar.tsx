import { NavLink } from 'react-router-dom'
import { BarChart2, Users, FileText, Settings, TrendingUp, Target, LogOut, Activity, X } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useT } from '../../i18n'

interface Props {
  onClose?: () => void
}

export default function Sidebar({ onClose }: Props) {
  const { user, logout } = useAuthStore()
  const { t } = useT()

  const navByRole: Record<string, { to: string; labelKey: string; icon: any }[]> = {
    OWNER: [
      { to: '/dashboard/owner', labelKey: 'nav.dashboard', icon: BarChart2 },
      { to: '/tracking', labelKey: 'nav.control', icon: Activity },
      { to: '/marketing', labelKey: 'nav.marketing', icon: TrendingUp },
      { to: '/users', labelKey: 'nav.users', icon: Users },
      { to: '/plans', labelKey: 'nav.plans', icon: Target },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
    ROP: [
      { to: '/dashboard/rop', labelKey: 'nav.dashboard', icon: BarChart2 },
      { to: '/tracking', labelKey: 'nav.control', icon: Activity },
      { to: '/marketing', labelKey: 'nav.marketing', icon: TrendingUp },
      { to: '/users', labelKey: 'nav.users', icon: Users },
      { to: '/plans', labelKey: 'nav.plans', icon: Target },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
    MANAGER: [
      { to: '/dashboard/manager', labelKey: 'nav.myOffice', icon: BarChart2 },
      { to: '/report', labelKey: 'nav.fillReport', icon: FileText },
    ],
    MARKETER: [
      { to: '/dashboard/marketer', labelKey: 'nav.myOffice', icon: TrendingUp },
      { to: '/report', labelKey: 'nav.fillReport', icon: FileText },
    ],
  }

  const navItems = user ? (navByRole[user.role] || []) : []

  return (
    <aside className="w-64 md:w-60 h-full bg-white border-r border-gray-100 flex flex-col shadow-lg md:shadow-none">
      {/* Logo + close button on mobile */}
      <div className="p-4 md:p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">SalesPlatform</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {t(labelKey as any)}
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
          <LogOut className="w-4 h-4 shrink-0" />
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  )
}
