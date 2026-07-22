import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart2, Users, FileText, Settings, TrendingUp, Target, LogOut, Activity, X, Inbox, CheckSquare, UserPlus, Archive } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useT } from '../../i18n'
import { api } from '../../api/client'

interface Props {
  onClose?: () => void
}

export default function Sidebar({ onClose }: Props) {
  const { user, logout } = useAuthStore()
  const { t } = useT()

  const isLider = user?.role === 'MANAGER' && user?.managerType === 'LIDER'
  const isCloser = user?.role === 'MANAGER' && user?.managerType !== 'LIDER'

  // Badge: incoming leads count for closer
  const { data: incomingLeads } = useQuery({
    queryKey: ['sidebar-incoming'],
    queryFn: () => api.get('/leads/incoming').then(r => r.data),
    refetchInterval: 30000,
    enabled: isCloser,
  })
  const incomingCount: number = Array.isArray(incomingLeads) ? incomingLeads.length : 0

  const navByRole: Record<string, { to: string; label: string; icon: any }[]> = {
    OWNER: [
      { to: '/dashboard/owner', label: t('nav.dashboard'), icon: BarChart2 },
      { to: '/tracking', label: t('nav.control'), icon: Activity },
      { to: '/marketing', label: t('nav.marketing'), icon: TrendingUp },
      { to: '/users', label: t('nav.users'), icon: Users },
      { to: '/plans', label: t('nav.plans'), icon: Target },
      { to: '/settings', label: t('nav.settings'), icon: Settings },
    ],
    ROP: [
      { to: '/dashboard/rop', label: t('nav.dashboard'), icon: BarChart2 },
      { to: '/tracking', label: t('nav.control'), icon: Activity },
      { to: '/marketing', label: t('nav.marketing'), icon: TrendingUp },
      { to: '/users', label: t('nav.users'), icon: Users },
      { to: '/plans', label: t('nav.plans'), icon: Target },
      { to: '/settings', label: t('nav.settings'), icon: Settings },
    ],
    MANAGER: isLider ? [
      { to: '/dashboard/manager', label: t('nav.myOffice'), icon: BarChart2 },
      { to: '/lider/leads', label: 'Лиды', icon: UserPlus },
    ] : [
      { to: '/dashboard/manager', label: t('nav.myOffice'), icon: BarChart2 },
      { to: '/closer/leads', label: 'Заявки', icon: Inbox },
      { to: '/closer/tasks', label: 'Задачи', icon: CheckSquare },
      { to: '/closer/archive', label: 'Архив', icon: Archive },
      { to: '/report', label: t('nav.fillReport'), icon: FileText },
    ],
    MARKETER: [
      { to: '/dashboard/marketer', label: t('nav.myOffice'), icon: TrendingUp },
      { to: '/report', label: t('nav.fillReport'), icon: FileText },
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
        {navItems.map(({ to, label, icon: Icon }) => {
          const showBadge = isCloser && to === '/closer/leads' && incomingCount > 0
          return (
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
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className="text-[11px] font-bold bg-blue-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center animate-pulse">
                  {incomingCount}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          {user && (
            <p className="text-[11px] font-medium mt-0.5">
              <span className="inline-block bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
                {user.role === 'MANAGER'
                  ? (user.managerType === 'LIDER' ? t('role.lider') : t('role.closer'))
                  : t(`role.${user.role}` as any)}
              </span>
            </p>
          )}
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
