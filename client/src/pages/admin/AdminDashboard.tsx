import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/adminClient'
import {
  Building2, Users, FileText, Activity, TrendingUp, TrendingDown,
  Trash2, AlertTriangle, CheckCircle, Clock, DollarSign, BarChart2, Plus, Calendar,
} from 'lucide-react'

interface ExpiringSoon {
  id: string
  name: string
  trialEndsAt: string
  subscriptionPlan: string | null
  paidAt: string | null
  paidAmount: number | null
  urgent: boolean
  users: { name: string; email: string }[]
  payments: { periodTo: string; amount: number; months: number }[]
}

interface MonthRevenue {
  label: string
  amount: number
  count: number
}

interface Stats {
  totalCompanies: number
  activeCompanies: number
  inactiveCompanies: number
  totalUsers: number
  activeUsers: number
  totalReports: number
  uniqueActiveToday: number
  paidCompanies: number
  companiesExpired: number
  revenueThisMonth: number
  mrr: number
  revenueByMonth: MonthRevenue[]
  expiringSoon: ExpiringSoon[]
  byPlan: {
    trial: PlanCompany[]
    starter: PlanCompany[]
    pro: PlanCompany[]
  }
}

interface PlanCompany {
  id: string
  name: string
  subscriptionPlan: string | null
  trialEndsAt: string | null
  paidAt: string | null
  users: { name: string; email: string }[]
  payments: { periodTo: string; amount: number; months: number }[]
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `₸${(n / 1_000_000).toFixed(1)} млн`
  if (n >= 1_000) return `₸${Math.round(n / 1_000)} тыс`
  return `₸${n}`
}

function daysLeft(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

const PLAN_LABELS: Record<string, string> = { trial: 'Триал', starter: 'Стартер', pro: 'Pro' }
const MONTHS_LABEL: Record<number, string> = { 1: '1 мес', 6: '6 мес', 12: '1 год' }

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  const load = () => {
    setLoading(true)
    adminApi.get('/api/admin/stats')
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleResetAll = async () => {
    if (!window.confirm('ВНИМАНИЕ! Удалить ВСЕ продажи, отчёты и CRM-ссылки во ВСЕХ компаниях? Это необратимо.')) return
    if (!window.confirm('Подтвердите ещё раз: все данные будут удалены навсегда.')) return
    setResetting(true)
    try {
      const r = await adminApi.post('/api/admin/reset-all-data', { confirm: 'RESET_ALL' })
      alert(`Готово! Удалено: лидов — ${r.data.deleted.leads}, продаж — ${r.data.deleted.sales}, отчётов — ${r.data.deleted.reports}`)
      load()
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Ошибка при сбросе')
    } finally {
      setResetting(false)
    }
  }

  if (loading) return (
    <div className="p-8 text-gray-500 flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" />
      Загрузка...
    </div>
  )

  const s = stats!
  const maxMonthRevenue = Math.max(...s.revenueByMonth.map(m => m.amount), 1)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Обзор платформы</h1>
        <p className="text-gray-500 text-sm mt-1">Сводная статистика и контроль подписок</p>
      </div>

      {/* ── Выручка KPI ─────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Финансы</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-emerald-700 flex items-center justify-center mb-4">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{fmtMoney(s.revenueThisMonth)}</div>
            <div className="text-sm text-gray-400">Оплачено в этом месяце</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-blue-700 flex items-center justify-center mb-4">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{fmtMoney(s.mrr)}</div>
            <div className="text-sm text-gray-400">MRR (ежемес. выручка)</div>
            <div className="text-xs text-gray-600 mt-1">по активным подпискам</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-purple-700 flex items-center justify-center mb-4">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{s.paidCompanies}</div>
            <div className="text-sm text-gray-400">Платящих клиентов</div>
            <div className="text-xs text-gray-600 mt-1">из {s.activeCompanies} активных</div>
          </div>
          <div className={`bg-gray-900 border rounded-xl p-5 ${s.companiesExpired > 0 ? 'border-red-900/60' : 'border-gray-800'}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${s.companiesExpired > 0 ? 'bg-red-700' : 'bg-gray-700'}`}>
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className={`text-2xl font-bold mb-1 ${s.companiesExpired > 0 ? 'text-red-400' : 'text-white'}`}>{s.companiesExpired}</div>
            <div className="text-sm text-gray-400">Просроченных</div>
            <div className="text-xs text-gray-600 mt-1">доступ истёк, но активны</div>
          </div>
        </div>
      </div>

      {/* ── Помесячная выручка ───────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" /> Выручка по месяцам
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Бар-чарт */}
          <div className="px-6 pt-5 pb-3 flex items-end gap-3" style={{ height: 120 }}>
            {s.revenueByMonth.map((m, i) => {
              const h = maxMonthRevenue > 0 ? Math.max(4, Math.round((m.amount / maxMonthRevenue) * 72)) : 4
              const isCurrent = i === s.revenueByMonth.length - 1
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  {m.amount > 0 && (
                    <div className="text-[10px] text-gray-400 whitespace-nowrap">{fmtMoney(m.amount)}</div>
                  )}
                  <div
                    className={`w-full rounded-t-md ${isCurrent ? 'bg-emerald-500' : 'bg-gray-700'}`}
                    style={{ height: h }}
                  />
                </div>
              )
            })}
          </div>
          {/* Таблица */}
          <table className="w-full text-sm border-t border-gray-800">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left px-6 py-2.5 font-medium">Месяц</th>
                <th className="text-right px-4 py-2.5 font-medium">Платежей</th>
                <th className="text-right px-4 py-2.5 font-medium">Сумма</th>
                <th className="px-6 py-2.5 w-32" />
              </tr>
            </thead>
            <tbody>
              {s.revenueByMonth.map((m, i) => {
                const isCurrent = i === s.revenueByMonth.length - 1
                return (
                  <tr key={i} className={`border-t border-gray-800/50 ${isCurrent ? 'bg-emerald-950/20' : ''}`}>
                    <td className="px-6 py-2.5">
                      <span className={`capitalize text-sm ${isCurrent ? 'text-white font-semibold' : 'text-gray-300'}`}>{m.label}</span>
                      {isCurrent && <span className="ml-2 text-xs bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded-full">текущий</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{m.count}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={m.amount > 0 ? 'text-emerald-400 font-semibold' : 'text-gray-600'}>
                        {m.amount > 0 ? fmtMoney(m.amount) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-2.5">
                      {m.amount > 0 && maxMonthRevenue > 0 && (
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(m.amount / maxMonthRevenue) * 100}%` }} />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700">
                <td className="px-6 py-3 text-gray-400 text-sm font-medium">Итого за 6 месяцев</td>
                <td className="px-4 py-3 text-right text-gray-400">{s.revenueByMonth.reduce((a, m) => a + m.count, 0)}</td>
                <td className="px-4 py-3 text-right text-white font-bold">{fmtMoney(s.revenueByMonth.reduce((a, m) => a + m.amount, 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Компании по тарифам ──────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5" />
          Компании по тарифам
        </h2>
        {(['trial', 'starter', 'pro'] as const).map(plan => {
          const companies = s.byPlan?.[plan] || []
          const colors: Record<string, string> = {
            trial: 'text-amber-400 border-amber-800 bg-amber-900/10',
            starter: 'text-blue-400 border-blue-800 bg-blue-900/10',
            pro: 'text-purple-400 border-purple-800 bg-purple-900/10',
          }
          const labels: Record<string, string> = { trial: 'Триал', starter: 'Стартовый', pro: 'Pro' }
          return (
            <div key={plan} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className={`flex items-center justify-between px-5 py-3 border-b border-gray-800`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${colors[plan].split(' ')[0]}`}>
                  {labels[plan]}
                </span>
                <span className="text-xs text-gray-500">{companies.length} компаний</span>
              </div>
              {companies.length === 0 ? (
                <div className="px-5 py-4 text-gray-600 text-sm">Нет компаний</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs">
                      <th className="text-left px-5 py-2 font-medium">Компания</th>
                      <th className="text-left px-4 py-2 font-medium">Владелец</th>
                      <th className="text-left px-4 py-2 font-medium">Доступ до</th>
                      <th className="text-left px-4 py-2 font-medium">Статус</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map(c => {
                      const days = c.trialEndsAt ? daysLeft(c.trialEndsAt) : null
                      const isPaid = !!c.paidAt
                      const urgent = days !== null && days <= 3
                      return (
                        <tr key={c.id} className={`border-t border-gray-800/50 ${urgent ? 'bg-red-950/20' : ''}`}>
                          <td className="px-5 py-3">
                            <div className="font-medium text-white">{c.name}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {c.users[0]?.email || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {c.trialEndsAt ? (
                              <span className={`text-sm font-semibold ${days !== null && days <= 0 ? 'text-red-400' : days !== null && days <= 3 ? 'text-red-400' : days !== null && days <= 7 ? 'text-amber-400' : 'text-gray-300'}`}>
                                {days !== null && days <= 0 ? 'Истёк' : days !== null ? `${days} дн. (${new Date(c.trialEndsAt).toLocaleDateString('ru')})` : '—'}
                              </span>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-800 px-2 py-0.5 rounded-full">
                                <CheckCircle className="w-3 h-3" /> Оплачено
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-900/20 border border-amber-800 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" /> Не оплачено
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link to={`/sys-ctl-9x7/companies/${c.id}`} className="text-xs text-blue-400 hover:text-blue-300">
                              Открыть →
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>

            {/* ── Платформа ────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Платформа</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center mb-4">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{s.totalCompanies}</div>
            <div className="text-sm text-gray-400">Всего компаний</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{s.activeCompanies}</div>
            <div className="text-sm text-gray-400">Активных</div>
            <div className="text-xs text-gray-600 mt-1">{s.inactiveCompanies} заблокировано</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{s.totalUsers}</div>
            <div className="text-sm text-gray-400">Пользователей</div>
            <div className="text-xs text-gray-600 mt-1">{s.activeUsers} активных</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{s.totalReports}</div>
            <div className="text-sm text-gray-400">Отчётов всего</div>
          </div>
        </div>
      </div>

      {/* ── Активность + Быстрые действия ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-500" /> Активность сегодня
          </h2>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-4xl font-bold text-white">{s.uniqueActiveToday}</div>
              <div className="text-sm text-gray-400">уникальных входов за 24ч</div>
            </div>
            <div className={`flex items-center gap-1 text-sm ${s.uniqueActiveToday > 0 ? 'text-green-400' : 'text-gray-600'}`}>
              {s.uniqueActiveToday > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {s.uniqueActiveToday > 0 ? 'Есть активность' : 'Нет активности'}
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Быстрые действия</h2>
          <div className="space-y-2">
            <Link to="/sys-ctl-9x7/companies" className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 text-sm">
              <Building2 className="w-4 h-4 text-blue-400" /> Управление компаниями
            </Link>
            <Link to="/sys-ctl-9x7/users" className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 text-sm">
              <Users className="w-4 h-4 text-purple-400" /> Все пользователи
            </Link>
            <Link to="/sys-ctl-9x7/companies/new" className="flex items-center gap-3 p-3 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800 rounded-lg transition-colors text-blue-300 text-sm">
              <Plus className="w-4 h-4" /> Создать компанию вручную
            </Link>
            <button onClick={handleResetAll} disabled={resetting}
              className="w-full flex items-center gap-3 p-3 bg-red-950/50 hover:bg-red-950 border border-red-700 rounded-lg transition-colors text-red-400 text-sm disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {resetting ? 'Удаление...' : 'Сбросить ВСЕ данные (лиды, продажи, отчёты)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
