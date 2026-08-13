import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart2, Users, FileText, Settings, TrendingUp, Target,
  LogOut, Activity, X, Inbox, CheckSquare, UserPlus, Archive, ClipboardList, Package, CreditCard, XCircle,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useT } from '../../i18n'
import { api } from '../../api/client'

interface Props { onClose?: () => void }

export default function Sidebar({ onClose }: Props) {
  const { user, logout } = useAuthStore()
  const { t } = useT()
  const [expanded, setExpanded] = useState(false)

  const isLider = user?.role === 'MANAGER' && user?.managerType === 'LIDER'
  const isCloser = user?.role === 'MANAGER' && user?.managerType !== 'LIDER'
  const isMarketer = user?.role === 'MARKETER'

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
    enabled: isCloser || isLider || isMarketer,
  })
  const activeTasksCount: number = Array.isArray(activeTasks) ? activeTasks.length : 0

  const navByRole: Record<string, { to: string; label: string; icon: any }[]> = {
    OWNER: [
      { to: '/dashboard/owner', label: t('nav.dashboard'),   icon: BarChart2 },
      { to: '/tracking',        label: t('nav.control'),     icon: Activity },
      { to: '/marketing',       label: t('nav.marketing'),   icon: TrendingUp },
      { to: '/products',        label: t('nav.products'),    icon: Package },
      { to: '/gateways',        label: t('nav.gateways'),   icon: CreditCard },
      { to: '/users',           label: t('nav.users'),       icon: Users },
      { to: '/plans',           label: t('nav.plans'),       icon: Target },
      { to: '/settings',        label: t('nav.settings'),    icon: Settings },
    ],
    ROP: [
      { to: '/dashboard/rop', label: t('nav.dashboard'),  icon: BarChart2 },
      { to: '/tracking',      label: t('nav.control'),    icon: Activity },
      { to: '/rop/tasks',     label: t('nav.tasks'),      icon: ClipboardList },
      { to: '/products',      label: t('nav.products'),   icon: Package },
      ...(user?.canManageGateways ? [{ to: '/gateways', label: t('nav.gateways'), icon: CreditCard }] : []),
      { to: '/users',         label: t('nav.users'),      icon: Users },
      { to: '/plans',         label: t('nav.plans'),      icon: Target },
    ],
    MANAGER: isLider ? [
      { to: '/dashboard/manager',  label: t('nav.myOffice'),    icon: BarChart2 },
      { to: '/lider/leads',        label: t('nav.leads'),       icon: UserPlus },
      { to: '/lider/not-happened', label: t('nav.notHappened'), icon: XCircle },
      { to: '/lider/tasks',        label: t('nav.tasks'),       icon: CheckSquare },
    ] : [
      { to: '/dashboard/manager', label: t('nav.myOffice'),  icon: BarChart2 },
      { to: '/closer/leads',      label: t('nav.meetings'),  icon: Inbox },
      { to: '/closer/tasks',      label: t('nav.tasks'),     icon: CheckSquare },
      { to: '/closer/archive',    label: t('nav.archive'),   icon: Archive },
    ],
    MARKETER: [
      { to: '/marketing',       label: t('nav.marketing'), icon: TrendingUp },
      { to: '/marketer/tasks',  label: t('nav.tasks'),     icon: CheckSquare },
    ],
  }

  const navItems = user ? (navByRole[user.role] || []) : []

  const getBadge = (to: string) => {
    if (isCloser && to === '/closer/leads' && incomingCount > 0) return incomingCount
    if (((isCloser && to === '/closer/tasks') || (isLider && to === '/lider/tasks') || (isMarketer && to === '/marketer/tasks')) && activeTasksCount > 0) return activeTasksCount
    return null
  }

  const roleLabel = user?.role === 'MANAGER'
    ? (user.managerType === 'LIDER' ? t('role.lider') : t('role.closer'))
    : t(`role.${user?.role}` as any)

  // ── Shared nav renderer ──────────────────────────────────────────────────────
  const NavItems = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      {navItems.map(({ to, label, icon: Icon }) => {
        const badge = getBadge(to)
        return (
          <NavLink key={to} to={to} onClick={onItemClick}
            className={({ isActive }) =>
              `flex items-center w-full h-11 transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            {/* Icon column — exactly w-16 wide so it fills the collapsed strip */}
            <span className="w-16 h-11 flex items-center justify-center flex-none relative">
              <Icon className="w-5 h-5" />
              {/* Tiny dot badge when collapsed (icon-only mode) */}
              {badge !== null && !expanded && (
                <span className="absolute top-1.5 right-2 w-2 h-2 bg-blue-600 rounded-full" />
              )}
            </span>
            {/* Label — starts at position 64px, clipped when aside is w-16 */}
            <span className="whitespace-nowrap text-sm font-medium flex-1">{label}</span>
            {/* Numeric badge — only visible when expanded (≥64px from left) */}
            {badge !== null && (
              <span className="mr-3 text-[11px] font-bold bg-blue-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center whitespace-nowrap">
                {badge}
              </span>
            )}
          </NavLink>
        )
      })}
    </>
  )

  // ── Mobile: full-width drawer ────────────────────────────────────────────────
  const MobileNav = () => (
    <aside className="md:hidden w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col shadow-lg">
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
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
      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <NavItems onItemClick={onClose} />
      </nav>
      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-3 shrink-0">
        <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
        <p className="text-xs text-gray-400 truncate mb-2">{user?.email}</p>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium">
          <LogOut className="w-4 h-4" /> {t('nav.logout')}
        </button>
      </div>
    </aside>
  )

  // ── Desktop: single panel, width transitions w-16 ↔ w-60 on hover ───────────
  //   overflow-hidden clips the text labels when collapsed (w-16 = 64px).
  //   Each nav item's icon is in a w-16 span → text starts at exactly 64px → clipped.
  const DesktopNav = () => (
    <aside
      className={`hidden md:flex fixed top-0 left-0 h-full z-50 flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-md overflow-hidden transition-[width] duration-200 ease-in-out ${expanded ? 'w-60' : 'w-16'}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo row — icon in w-16 span, title starts at 64px */}
      <div className="h-14 flex items-center border-b border-gray-100 shrink-0">
        <div className="w-16 h-14 flex items-center justify-center flex-none">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
        </div>
        <span className="font-bold text-gray-900 whitespace-nowrap">SalesPlatform</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        <NavItems />
      </nav>

      {/* Footer — user info starts at 64px so it's hidden when collapsed */}
      <div className="border-t border-gray-100 flex-none overflow-hidden">
        <div className="flex items-center py-3">
          {/* Spacer that aligns with icon column */}
          <div className="w-16 flex-none" />
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold text-gray-900 whitespace-nowrap">{user?.name}</p>
            <p className="text-xs text-gray-400 whitespace-nowrap">{user?.email}</p>
            <span className="inline-block text-[10px] font-medium bg-blue-50 text-blue-700 rounded-full px-1.5 py-0.5 mt-0.5 whitespace-nowrap">
              {roleLabel}
            </span>
          </div>
        </div>
        {/* Logout — icon in w-16 span */}
        <button
          onClick={logout}
          className="flex items-center w-full h-11 mb-1 text-red-500 hover:bg-red-50 transition-colors"
        >
          <span className="w-16 h-11 flex items-center justify-center flex-none">
            <LogOut className="w-5 h-5" />
          </span>
          <span className="whitespace-nowrap text-sm font-medium">{t('nav.logout')}</span>
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <MobileNav />
      <DesktopNav />
    </>
  )
}
