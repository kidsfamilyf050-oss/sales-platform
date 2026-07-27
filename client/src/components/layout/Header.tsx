import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, Menu, Calendar, AlertCircle, Clock, CalendarCheck } from 'lucide-react'
import { api } from '../../api/client'
import PeriodSelector from '../ui/PeriodSelector'
import LanguageSwitcher from '../ui/LanguageSwitcher'

interface Alert { type: string; title: string; count: number; url: string; color: string }
interface AlertsData { alerts: Alert[]; total: number }

const COLOR_MAP: Record<string, { bg: string; text: string; Icon: React.ElementType }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   Icon: Calendar },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    Icon: AlertCircle },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', Icon: Clock },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', Icon: Clock },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  Icon: CalendarCheck },
}

interface Props { onMenuClick?: () => void }

export default function Header({ onMenuClick }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery<AlertsData>({
    queryKey: ['smart-alerts'],
    queryFn: () => api.get('/notifications/alerts').then(r => r.data),
    refetchInterval: 60_000,
  })

  const total = data?.total ?? 0
  const alerts = data?.alerts ?? []

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-3 md:px-6 gap-2">
      <button onClick={onMenuClick}
        className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg shrink-0"
        aria-label="Меню">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
        <PeriodSelector />
      </div>

      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        <LanguageSwitcher />

        {/* Smart alert bell */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className={`relative p-2 rounded-lg transition-colors ${open ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            aria-label="Оповещения"
          >
            <Bell className="w-5 h-5" />
            {total > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                {total > 99 ? '99+' : total}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute top-full mt-2 right-0 z-50 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800">Оповещения</p>
                {total > 0 && (
                  <span className="text-xs text-red-500 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
                    {total} требует внимания
                  </span>
                )}
              </div>

              {alerts.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Всё под контролем!</p>
                  <p className="text-xs text-gray-400 mt-1">Нет срочных задач</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {alerts.map(alert => {
                    const cfg = COLOR_MAP[alert.color] ?? COLOR_MAP.blue
                    const Icon = cfg.Icon
                    return (
                      <a key={alert.type}
                        href={alert.url}
                        onClick={(e) => { e.preventDefault(); setOpen(false); navigate(alert.url) }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 ${cfg.text}`} />
                        </div>
                        <p className="flex-1 text-sm font-medium text-gray-800 leading-tight">{alert.title}</p>
                        <span className={`text-sm font-bold ${cfg.text} ${cfg.bg} px-2.5 py-1 rounded-xl shrink-0`}>
                          {alert.count}
                        </span>
                      </a>
                    )
                  })}
                </div>
              )}

              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
                <p className="text-[11px] text-gray-400 text-center">Обновляется каждую минуту</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
