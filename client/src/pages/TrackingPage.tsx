import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Navigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Save, CalendarDays, TableProperties,
  UserCircle, CheckCircle, TrendingUp, AlertCircle, Minus, CalendarRange
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPeriod(d: Date) { return d.toISOString().slice(0, 7) }
function formatMonth(p: string) {
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const [y, m] = p.split('-')
  return `${months[+m - 1]} ${y}`
}
function shiftMonth(p: string, d: number) {
  const [y, m] = p.split('-').map(Number)
  const dt = new Date(y, m - 1 + d, 1)
  return getPeriod(dt)
}
function daysInMonth(p: string) {
  const [y, m] = p.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function toDateStr(p: string, day: number) {
  return `${p}-${String(day).padStart(2, '0')}`
}
function todayIso() { return new Date().toISOString().slice(0, 10) }
function firstOfMonthIso() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
// Generate array of date strings between from and to (inclusive)
function dateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const cur = new Date(from)
  const end = new Date(to)
  while (cur <= end) { dates.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
  return dates
}
function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'М'
  if (n >= 100_000) return Math.round(n / 1_000) + 'тыс'
  if (n >= 10_000) return (n / 1_000).toFixed(1) + 'тыс'
  if (n >= 1_000) return (n / 1_000).toFixed(2).replace(/\.?0+$/, '') + 'тыс'
  return n.toLocaleString('ru-RU')
}
function pct(fact: number, plan: number) {
  if (!plan) return null
  return Math.round((fact / plan) * 100)
}

// ─── Manager type config ─────────────────────────────────────────────────────

const CLOSER_FIELDS = [
  { key: 'salesAmount',   label: 'Сумма продаж',     unit: '₸',  hint: 'Общая сумма закрытых сделок' },
  { key: 'salesCount',    label: 'Кол-во сделок',    unit: 'шт', hint: 'Количество закрытых сделок' },
  { key: 'clients',       label: 'Входящих заявок',  unit: 'шт', hint: 'Клиентов / заявок получено от лидорубов' },
  { key: 'consultations', label: 'Встреч / звонков', unit: 'шт', hint: 'Встреч, консультаций или звонков проведено' },
]
const LIDER_FIELDS = [
  { key: 'leads',               label: 'Лидов получено',   unit: 'шт', hint: 'Новых лидов обработано' },
  { key: 'qualifiedLeads',      label: 'Квалифицировано',  unit: 'шт', hint: 'Лидов прошло квалификацию' },
  { key: 'meetingsScheduled',   label: 'Записано на встречу', unit: 'шт', hint: 'Клиентов записано' },
  { key: 'meetingsAttended',    label: 'Пришло на встречу',unit: 'шт', hint: 'Клиентов дошло' },
]
const MARKETER_FIELDS = [
  { key: 'leads',          label: 'Лидов',          unit: 'шт', hint: 'Лидов привлечено за день' },
  { key: 'qualifiedLeads', label: 'Квалиф. лидов',  unit: 'шт', hint: 'Квалифицированных лидов' },
  { key: 'budget',         label: 'Бюджет за день',  unit: '₸',  hint: 'Потрачено на рекламу' },
]

function getFields(managerType: string | null, role: string) {
  if (role === 'MARKETER') return MARKETER_FIELDS
  if (managerType === 'LIDER') return LIDER_FIELDS
  return CLOSER_FIELDS
}
function getReportType(managerType: string | null, role: string) {
  if (role === 'MARKETER') return 'MARKETER'
  if (managerType === 'LIDER') return 'LIDER'
  return 'CLOSER'
}
// Primary metric shown in grid
function getPrimaryKey(managerType: string | null, role: string) {
  if (role === 'MARKETER') return 'leads'
  if (managerType === 'LIDER') return 'leads'
  return 'salesAmount'
}
function getPrimaryUnit(managerType: string | null, role: string) {
  if (role === 'MARKETER') return 'шт'
  if (managerType === 'LIDER') return 'шт'
  return '₸'
}
// Plan type for primary metric
function getPlanType(managerType: string | null, role: string) {
  if (role === 'MARKETER') return 'LEADS'
  if (managerType === 'LIDER') return 'LEADS'
  return 'SALES_AMOUNT'
}

// ─── Color helpers ───────────────────────────────────────────────────────────

function pctColor(p: number | null, asClass = true): string {
  if (p === null) return asClass ? 'text-gray-400' : '#9ca3af'
  if (p >= 80) return asClass ? 'text-green-600' : '#16a34a'
  if (p >= 50) return asClass ? 'text-amber-500' : '#f59e0b'
  return asClass ? 'text-red-500' : '#ef4444'
}
function pctBg(p: number | null): string {
  if (p === null) return 'bg-gray-50'
  if (p >= 80) return 'bg-green-50'
  if (p >= 50) return 'bg-amber-50'
  return 'bg-red-50'
}

// ─── Entry form for one manager ──────────────────────────────────────────────

function ManagerEntryCard({
  user, date, existingData, onSave, saving
}: {
  user: any; date: string; existingData: any; onSave: (data: any) => void; saving: boolean
}) {
  const fields = getFields(user.managerType, user.role)
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    fields.forEach(f => { init[f.key] = existingData?.[f.key]?.toString() || '' })
    return init
  })
  const [comment, setComment] = useState(existingData?.comment || '')

  const hasData = Object.values(vals).some(v => v !== '')

  return (
    <div className={`border rounded-xl p-4 transition-all ${hasData ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${
          user.managerType === 'LIDER' ? 'bg-purple-500' : user.role === 'MARKETER' ? 'bg-orange-500' : 'bg-blue-500'
        }`}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
          <p className="text-xs text-gray-400">
            {user.managerType === 'LIDER' ? 'Лидоруб' : user.role === 'MARKETER' ? 'Маркетолог' : 'Клоузер'}
            {hasData && <span className="ml-2 text-blue-500">● данные введены</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {fields.map(f => (
          <div key={f.key}>
            <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
            <div className="relative">
              <input
                type="number" min="0"
                value={vals[f.key]}
                onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder="—"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{f.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <input
          type="text" placeholder="Комментарий (необязательно)"
          value={comment} onChange={e => setComment(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          onClick={() => onSave({ data: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v ? +v : 0])), comment })}
          disabled={saving || !hasData}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          Сохранить
        </button>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function TrackingPage() {
  const { user } = useAuthStore()
  if (user && user.role !== 'OWNER' && user.role !== 'ROP') {
    return <Navigate to="/" replace />
  }

  const qc = useQueryClient()
  const [period, setPeriod] = useState(getPeriod(new Date()))
  const [tab, setTab] = useState<'entry' | 'table'>('entry')
  const todayStr = todayIso()
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [savingUser, setSavingUser] = useState<string | null>(null)
  const [savedUsers, setSavedUsers] = useState<Set<string>>(new Set())
  // Custom date range
  const [rangeMode, setRangeMode] = useState<'month' | 'custom'>('month')
  const [customFrom, setCustomFrom] = useState(firstOfMonthIso())
  const [customTo, setCustomTo] = useState(todayStr)
  const [showRangePicker, setShowRangePicker] = useState(false)
  const [tmpFrom, setTmpFrom] = useState(customFrom)
  const [tmpTo, setTmpTo] = useState(customTo)

  const totalDays = daysInMonth(period)
  const today = new Date()

  const periodStart = rangeMode === 'month' ? `${period}-01` : customFrom
  const periodEnd   = rangeMode === 'month' ? `${period}-${String(totalDays).padStart(2, '0')}` : customTo
  const planPeriod  = rangeMode === 'month' ? period : getPeriod(new Date(customFrom))

  // Data fetching
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/company/departments').then(r => r.data),
  })
  const { data: plans = [] } = useQuery({
    queryKey: ['plans', planPeriod],
    queryFn: () => api.get(`/plans?period=${planPeriod}`).then(r => r.data),
  })
  const { data: reports = [] } = useQuery({
    queryKey: ['reports-company', periodStart, periodEnd],
    queryFn: () => api.get(`/reports/company?from=${periodStart}&to=${periodEnd}`).then(r => r.data),
  })

  const applyCustomRange = () => {
    if (tmpFrom && tmpTo && tmpFrom <= tmpTo) {
      setCustomFrom(tmpFrom); setCustomTo(tmpTo)
      setRangeMode('custom'); setShowRangePicker(false)
    }
  }

  // All managers across all departments
  const allManagers = useMemo(() => {
    const managers: any[] = []
    departments.forEach((dept: any) => {
      dept.users?.forEach((u: any) => managers.push({ ...u, deptName: dept.name, deptType: dept.type }))
    })
    return managers
  }, [departments])

  // Reports lookup: userId → date → report
  const reportsMap = useMemo(() => {
    const map: Record<string, Record<string, any>> = {}
    reports.forEach((r: any) => {
      const dateKey = r.date.slice(0, 10)
      if (!map[r.userId]) map[r.userId] = {}
      map[r.userId][dateKey] = r
    })
    return map
  }, [reports])

  // Plans lookup: userId → planType → value
  const plansMap = useMemo(() => {
    const map: Record<string, number> = {}
    plans.forEach((p: any) => {
      if (p.userId) map[`${p.userId}_${p.type}`] = p.value
    })
    return map
  }, [plans])

  const saveReport = async (userId: string, managerType: string, role: string, data: any, comment: string) => {
    setSavingUser(userId)
    try {
      await api.post('/reports/for-user', {
        userId,
        date: selectedDate,
        type: getReportType(managerType, role),
        data,
        comment,
      })
      await qc.invalidateQueries({ queryKey: ['reports-company', period] })
      setSavedUsers(s => new Set(s).add(userId))
      setTimeout(() => setSavedUsers(s => { const n = new Set(s); n.delete(userId); return n }), 2500)
    } catch (e: any) {
      alert('Ошибка сохранения: ' + (e?.response?.data?.error || 'Попробуйте ещё раз'))
    } finally {
      setSavingUser(null)
    }
  }

  // ── Entry tab ────────────────────────────────────────────────────────────

  const renderEntryTab = () => {
    const salesManagers = allManagers.filter(u => u.deptType === 'SALES')
    const closers = salesManagers.filter(u => u.managerType !== 'LIDER')
    const liders  = salesManagers.filter(u => u.managerType === 'LIDER')
    const marketers = allManagers.filter(u => u.role === 'MARKETER')

    if (allManagers.length === 0) {
      return (
        <div className="text-center py-16 text-gray-400">
          <UserCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Нет сотрудников</p>
          <p className="text-sm">Добавьте сотрудников в разделе «Сотрудники»</p>
        </div>
      )
    }

    const renderManagerCards = (managers: any[]) =>
      managers.map((u: any) => {
        const existingReport = reportsMap[u.id]?.[selectedDate]
        return (
          <ManagerEntryCard
            key={`${u.id}_${selectedDate}`}
            user={u}
            date={selectedDate}
            existingData={existingReport ? { ...existingReport.data, comment: existingReport.comment } : null}
            saving={savingUser === u.id}
            onSave={({ data, comment }) => saveReport(u.id, u.managerType, u.role, data, comment)}
          />
        )
      })

    return (
      <div className="space-y-6">
        {/* Date picker */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Дата:</label>
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {selectedDate === todayStr && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Сегодня</span>
          )}
        </div>

        {/* Closers */}
        {closers.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Клоузеры</h2>
            <div className="space-y-3">{renderManagerCards(closers)}</div>
          </div>
        )}

        {/* Liders */}
        {liders.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-3">Лидорубы</h2>
            <div className="space-y-3">{renderManagerCards(liders)}</div>
          </div>
        )}

        {/* Marketers */}
        {marketers.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Маркетинг</h2>
            <div className="space-y-3">{renderManagerCards(marketers)}</div>
          </div>
        )}
      </div>
    )
  }

  // ── Table tab ────────────────────────────────────────────────────────────

  const renderTableTab = () => {
    if (allManagers.length === 0) {
      return <div className="text-center py-16 text-gray-400">Нет сотрудников</div>
    }

    const salesManagers = allManagers.filter(u => u.deptType === 'SALES')
    const closers  = salesManagers.filter(u => u.managerType !== 'LIDER')
    const liders   = salesManagers.filter(u => u.managerType === 'LIDER')
    const marketers = allManagers.filter(u => u.role === 'MARKETER')

    // Build column date strings
    const columnDates: string[] = rangeMode === 'custom'
      ? dateRange(customFrom, customTo)
      : Array.from({ length: totalDays }, (_, i) => toDateStr(period, i + 1))

    const todayDateStr = todayIso()
    const isCurrentMonth = rangeMode === 'month' &&
      today.getMonth() + 1 === +period.split('-')[1] &&
      today.getFullYear() === +period.split('-')[0]
    const todayDay = isCurrentMonth ? today.getDate() : null

    // ── Aggregate summary for a group ──────────────────────────────────────
    const renderGroupSummary = (
      managers: any[],
      fields: typeof CLOSER_FIELDS,
      primaryKey: string,
      primaryUnit: string,
      planType: string,
      accent: 'blue' | 'purple' | 'orange',
      groupLabel: string,
    ) => {
      const accentBg = accent === 'purple' ? 'bg-purple-50 border-purple-200' : accent === 'orange' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'
      const accentText = accent === 'purple' ? 'text-purple-700' : accent === 'orange' ? 'text-orange-700' : 'text-blue-700'
      const accentHeading = accent === 'purple' ? 'text-purple-600' : accent === 'orange' ? 'text-orange-600' : 'text-blue-600'

      const totals = fields.map(f => {
        const total = managers.reduce((sum, u) => {
          return sum + columnDates.reduce((s, date) => {
            const val = reportsMap[u.id]?.[date]?.data?.[f.key]
            return val != null ? s + +val : s
          }, 0)
        }, 0)
        return { field: f, total }
      })

      const totalPlan = managers.reduce((sum, u) => sum + (plansMap[`${u.id}_${planType}`] ?? 0), 0)
      const primaryTotal = totals.find(t => t.field.key === primaryKey)?.total ?? 0
      const completion = pct(primaryTotal, totalPlan)

      return (
        <div className={`rounded-xl border p-4 ${accentBg}`}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <h3 className={`text-sm font-bold uppercase tracking-wider ${accentHeading}`}>
              Итого — {groupLabel} · {managers.length} чел.
            </h3>
            <div className="flex items-center gap-4 text-sm">
              {totalPlan > 0 && (
                <>
                  <span className="text-gray-500">План: <strong className="text-gray-800">{fmt(totalPlan)} {primaryUnit}</strong></span>
                  <span className="text-gray-500">Факт: <strong className="text-gray-800">{fmt(primaryTotal)} {primaryUnit}</strong></span>
                  <span className={`font-bold text-base ${pctColor(completion)}`}>{completion !== null ? `${completion}%` : '—'}</span>
                </>
              )}
              {!totalPlan && <span className="text-gray-800 font-bold">{fmt(primaryTotal)} {primaryUnit}</span>}
            </div>
          </div>
          <div className={`grid gap-3 grid-cols-2 sm:grid-cols-${Math.min(fields.length, 4)}`}>
            {totals.map(({ field, total }) => (
              <div key={field.key} className="bg-white/70 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">{field.label}</p>
                <p className={`text-xl font-bold ${field.key === primaryKey ? accentText : 'text-gray-800'}`}>
                  {total > 0 ? fmt(total) : '—'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{field.unit}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // ── Per-manager scrollable table ────────────────────────────────────────
    const renderManagerTable = (u: any) => {
      const fields = getFields(u.managerType, u.role)
      const primaryKey = getPrimaryKey(u.managerType, u.role)
      const primaryUnit = getPrimaryUnit(u.managerType, u.role)
      const planType = getPlanType(u.managerType, u.role)
      const monthlyPlan = plansMap[`${u.id}_${planType}`] ?? 0

      const fieldData = fields.map(f => {
        let total = 0
        const dayVals = columnDates.map(date => {
          const val = reportsMap[u.id]?.[date]?.data?.[f.key]
          if (val != null && val !== '') { total += +val; return +val }
          return null
        })
        return { field: f, dayVals, total }
      })

      const primaryTotal = fieldData.find(fd => fd.field.key === primaryKey)?.total ?? 0
      const p = pct(primaryTotal, monthlyPlan)
      const daysPassed = todayDay ? Math.min(todayDay, totalDays) : totalDays
      const dailyNeed = monthlyPlan ? Math.ceil((monthlyPlan - primaryTotal) / Math.max(1, totalDays - daysPassed)) : 0

      const hasReportToday = reportsMap[u.id]?.[todayDateStr] !== undefined
        || !columnDates.includes(todayDateStr)
      const statusDot = !hasReportToday ? 'bg-red-500' : (p !== null && p < 50) ? 'bg-yellow-400' : 'bg-green-400'
      const statusLabel = !hasReportToday ? 'Нет отчёта' : (p !== null && p < 50) ? 'Отстаёт' : 'В норме'

      return (
        <div key={u.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 ${pctBg(p)}`}>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  u.managerType === 'LIDER' ? 'bg-purple-500' : u.role === 'MARKETER' ? 'bg-orange-500' : 'bg-blue-500'
                }`}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot}`} title={statusLabel} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{u.name}</p>
                <p className="text-xs text-gray-400">
                  {u.managerType === 'LIDER' ? 'Лидоруб' : u.role === 'MARKETER' ? 'Маркетолог' : 'Клоузер'}
                  {columnDates.includes(todayDateStr) && (
                    <span className={`ml-2 font-medium ${!hasReportToday ? 'text-red-500' : (p !== null && p < 50) ? 'text-amber-500' : 'text-green-600'}`}>
                      ● {statusLabel}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <p className="text-xs text-gray-400">План</p>
                <p className="font-bold text-gray-800 text-sm">{monthlyPlan ? fmt(monthlyPlan) : '—'} {monthlyPlan ? primaryUnit : ''}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Факт</p>
                <p className="font-bold text-gray-800 text-sm">{fmt(primaryTotal)} {primaryUnit}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Выполнение</p>
                <p className={`font-bold text-sm ${pctColor(p)}`}>{p !== null ? `${p}%` : '—'}</p>
              </div>
              {monthlyPlan > 0 && primaryTotal < monthlyPlan && todayDay && rangeMode === 'month' && (
                <div>
                  <p className="text-xs text-gray-400">Нужно / день</p>
                  <p className="font-bold text-sm text-blue-600">{fmt(Math.max(0, dailyNeed))} {primaryUnit}</p>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium text-gray-500 border-r border-gray-200 whitespace-nowrap min-w-[148px]">
                    Показатель
                  </th>
                  {columnDates.map(date => {
                    const isToday = date === todayDateStr
                    const d = new Date(date)
                    const dayNum = d.getDate()
                    const dow = ['вс','пн','вт','ср','чт','пт','сб'][d.getDay()]
                    const label = rangeMode === 'custom'
                      ? `${String(dayNum).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`
                      : String(dayNum)
                    return (
                      <th key={date} className={`px-1 py-1.5 font-medium border-r border-gray-100 text-center w-[50px] min-w-[50px] ${isToday ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}>
                        <div className={rangeMode === 'custom' ? 'text-[10px]' : ''}>{label}</div>
                        <div className="text-gray-400 font-normal">{dow}</div>
                      </th>
                    )
                  })}
                  <th className="px-3 py-2 font-semibold text-center text-gray-700 bg-gray-100 border-l border-gray-200 whitespace-nowrap min-w-[64px]">
                    Итого
                  </th>
                </tr>
              </thead>
              <tbody>
                {fieldData.map(({ field, dayVals, total }, rowIdx) => {
                  const isPrimary = field.key === primaryKey
                  return (
                    <tr key={field.key} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                      <td className={`sticky left-0 z-10 bg-inherit px-3 py-2 border-r border-gray-200 whitespace-nowrap ${isPrimary ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>
                        {field.label} <span className="text-gray-400 font-normal text-[10px]">{field.unit}</span>
                      </td>
                      {dayVals.map((val, idx) => {
                        const date = columnDates[idx]
                        const isToday = date === todayDateStr
                        const isFuture = date > todayDateStr
                        return (
                          <td key={date} className={`px-1 py-2 border-r border-gray-100 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                            {isFuture ? (
                              <span className="text-gray-200">·</span>
                            ) : val !== null ? (
                              <span className={isPrimary ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}>{fmt(val)}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td className={`px-3 py-2 text-center font-bold border-l border-gray-200 bg-gray-50 ${isPrimary ? pctColor(p) : 'text-gray-700'}`}>
                        {total > 0 ? fmt(total) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-8">
        {closers.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Клоузеры</h2>
            {renderGroupSummary(closers, CLOSER_FIELDS, 'salesAmount', '₸', 'SALES_AMOUNT', 'blue', 'Клоузеры')}
            <div className="space-y-6">{closers.map(renderManagerTable)}</div>
          </div>
        )}

        {liders.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Лидорубы</h2>
            {renderGroupSummary(liders, LIDER_FIELDS, 'leads', 'шт', 'LEADS', 'purple', 'Лидорубы')}
            <div className="space-y-6">{liders.map(renderManagerTable)}</div>
          </div>
        )}

        {marketers.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Маркетинг</h2>
            {renderGroupSummary(marketers, MARKETER_FIELDS, 'leads', 'шт', 'LEADS', 'orange', 'Маркетинг')}
            <div className="space-y-6">{marketers.map(renderManagerTable)}</div>
          </div>
        )}
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Контроль плана</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ежедневный ввод результатов и динамика по менеджерам</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month picker */}
          {rangeMode === 'month' && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setPeriod(p => shiftMonth(p, -1))} className="p-1.5 hover:bg-white rounded-md transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="px-3 text-sm font-semibold text-gray-800 min-w-[130px] text-center">{formatMonth(period)}</span>
              <button onClick={() => setPeriod(p => shiftMonth(p, 1))} className="p-1.5 hover:bg-white rounded-md transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}

          {/* Custom range button */}
          <div className="relative">
            <button
              onClick={() => { setTmpFrom(customFrom); setTmpTo(customTo); setShowRangePicker(s => !s) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                rangeMode === 'custom'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-100 text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <CalendarRange className="w-4 h-4" />
              {rangeMode === 'custom'
                ? `${customFrom.slice(5).replace('-', '.')} – ${customTo.slice(5).replace('-', '.')}`
                : 'Период'}
            </button>
            {showRangePicker && (
              <div className="absolute top-full mt-2 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Выбрать период</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">С</label>
                    <input type="date" max={tmpTo || todayStr} value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">По</label>
                    <input type="date" min={tmpFrom} max={todayStr} value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={applyCustomRange} disabled={!tmpFrom || !tmpTo || tmpFrom > tmpTo}
                    className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40">
                    Применить
                  </button>
                  <button onClick={() => { setRangeMode('month'); setShowRangePicker(false) }}
                    className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-200">
                    Сбросить
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('entry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'entry' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Ввод за день
        </button>
        <button
          onClick={() => setTab('table')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TableProperties className="w-4 h-4" />
          Таблица по дням
        </button>
      </div>

      {/* Content */}
      {tab === 'entry' ? renderEntryTab() : renderTableTab()}
    </div>
  )
}
