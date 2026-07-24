import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart2, Users, FileText, Settings, TrendingUp, Target, LogOut, Activity, X, Inbox, CheckSquare, UserPlus, Archive, ClipboardList } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useT } from '../../i18n'
import { api } from '../../api/client'

interface Props {
  onClose?: () => void
}

export default function Sidebar({ onClose }: Props) {
  const { user, logout } = useAuthStore()
  const { t } = useT()
  const [expanded, setExpanded] = useState(false)

  const isLider = user?.role === 'MANAGER' && user?.managerType === 'LIDER'
  const isCloser = user?.role === 'MANAGER' && user?.managerType !== 'LIDER'

  const { data: incomingLeads } = useQuery({
    queryKey: ['sidebar-incoming'],
    queryFn: () => api.get('/leads/incoming').then(r => r.data),
    refetchInterval: 30000,
    enabled: isCloser,
  })
  const incomingCount: number = Array.isArray(incomingLeads) ? incomingLeads.length : 0

  const { data: activeTasks } = useQuery({
    queryKey: ['sidebar-tasks'],
    queryFn: () => api.get('/lead-tasks?completed=false').then(r => r.data),
    refetchInterval: 30000,
    enabled: isCloser || isLider,
  })
  const activeTasksCount: number = Array.isArray(activeTasks) ? activeTasks.length : 0

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
      { to: '/rop/tasks', label: 'Задачи', icon: ClipboardList },
      { to: '/marketing', label: t('nav.marketing'), icon: TrendingUp },
      { to: '/users', label: t('nav.users'), icon: Users },
      { to: '/plans', label: t('nav.plans'), icon: Target },
      { to: '/settings', label: t('nav.settings'), icon: Settings },
    ],
    MANAGER: isLider ? [
      { to: '/dashboard/manager', label: t('nav.myOffice'), icon: BarChart2 },
      { to: '/lider/leads', label: 'Лиды', icon: UserPlus },
      { to: '/lider/tasks', label: 'Задачи', icon: CheckSquare },
    ] : [
      { to: '/dashboard/manager', label: t('nav.myOffice'), icon: BarChart2 },
      { to: '/closer/leads', label: 'Заявки', icon: Inbox },
      { to: '/closer/tasks', label: 'Задачи', icon: CheckSquare },
      { to: '/closer/archive', label: 'Архив', icon: Archive },
    ],
    MARKETER: [
      { to: '/dashboard/marketer', label: t('nav.myOffice'), icon: TrendingUp },
      { to: '/report', label: t('nav.fillReport'), icon: FileText },
    ],
  }

  const navItems = user ? (navByRole[user.role] || []) : []

  const getBadge = (to: string) => {
    if (isCloser && to === '/closer/leads' && incomingCount > 0) return incomingCount
    if ((isCloser && to === '/closer/tasks' || isLider && to === '/lider/tasks') && activeTasksCount > 0) return activeTasksCount
    return null
  }

  const roleLabel = user?.role === 'MANAGER'
    ? (user.managerType === 'LIDER' ? t('role.lider') : t('role.closer'))
    : t(`role.${user?.role}` as any)

  return (
    <>
      {/* ── Mobile: full-width drawer (inside Layout's slide container) ─────────── */}
      <aside className="md:hidden w-64 h-full bg-white border-r border-gray-100 flex flex-col shadow-lg">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">SalesPlatform</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => {
            const badge = getBadge(to)
            return (
              <NavLink key={to} to={to} onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }>
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{label}</span>
                {badge !== null && (
                  <span className="text-[11px] font-bold bg-blue-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{badge}</span>
                )}
              </NavLink>
            )
          })}
        </nav>
        <div className="p-3 border-t border-gray-100 shrink-0">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            <span className="inline-block text-[11px] font-medium mt-0.5 bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">{roleLabel}</span>
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 w-full transition-colors">
            <LogOut className="w-4 h-4 shrink-0" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* ── Desktop: single panel that expands on hover (fixed, overflow:hidden) ── */}
      {/*   width transitions between w-16 (icons only) and w-60 (icons + labels)  */}
      <aside
        className={`hidden md:flex fixed top-0 left-0 h-full z-50 flex-col bg-white border-r border-gray-100 shadow-md overflow-hidden transition-[width] duration-200 ease-in-out ${expanded ? 'w-60' : 'w-16'}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Logo row */}
        <div className="h-14 flex items-center px-4 border-b border-gray-100 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <span className="ml-3 font-bold text-gray-900 whitespace-nowrap">SalesPlatform</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ to, label, icon: Icon }) => {
            const badge = getBadge(to)
            return (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 mx-2 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }>
                <Icon className="w-5 h-5 shrink-0" />
                <span className="whitespace-nowrap flex-1">{label}</span>
                {badge !== null && (
                  <span className="text-[11px] font-bold bg-blue-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0 whitespace-nowrap">{badge}</span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 shrink-0 overflow-hidden">
          <div className="px-4 py-2 overflow-hidden">
            <p className="text-xs font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{user?.name}</p>
            <p className="text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{user?.email}</p>
            <span className="inline-block text-[11px] font-medium bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 whitespace-nowrap">{roleLabel}</span>
          </div>
          <button onClick={logout}
            className="flex items-center gap-3 mx-2 mb-2 px-2 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 w-[calc(100%-1rem)] transition-colors">
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">{t('nav.logout')}</span>
          </button>
        </div>
      </aside>
    </>
  )
}
