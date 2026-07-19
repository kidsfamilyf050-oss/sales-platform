import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { ChevronLeft, ChevronRight, Save, CheckCircle, Pencil, X } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPeriod(d: Date) { return d.toISOString().slice(0, 7) }
function formatMonth(p: string) {
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const [y, m] = p.split('-')
  return `${months[+m - 1]} ${y}`
}
function shiftMonth(p: string, d: number) {
  const [y, m] = p.split('-').map(Number)
  return getPeriod(new Date(y, m - 1 + d, 1))
}
function daysInMonth(p: string) {
  const [y, m] = p.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'М'
  if (n >= 1_000) return Math.round(n / 1_000) + 'тыс'
  return n.toLocaleString('ru-RU')
}
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0 }

// ─── Funnel bar ───────────────────────────────────────────────────────────────

function FunnelRow({ label, value, max, color, conv }: { label: string; value: number; max: number; color: string; conv?: number | null }) {
  const w = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0
  return (
    <div>
      {conv !== undefined && conv !== null && (
        <div className="flex items-center gap-1 ml-1 mb-0.5">
          <div className="w-px h-3 bg-gray-200 ml-1" />
          <span className={`text-[11px] font-medium ${conv >= 50 ? 'text-green-600' : conv >= 30 ? 'text-amber-500' : 'text-red-500'}`}>↓ {conv}%</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-[160px] shrink-0">{label}</span>
        <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden">
          <div className={`h-7 rounded ${color}`} style={{ width: `${w}%`, transition: 'width 0.4s ease' }} />
        </div>
        <span className="text-sm font-bold text-gray-800 w-10 text-right">{value}</span>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, pctVal, note }: { label: string; value: string | number; sub?: string; pctVal?: number | null; note?: string }) {
  const color = pctVal == null ? '' : pctVal >= 75 ? 'text-green-600' : pctVal >= 50 ? 'text-amber-500' : 'text-red-500'
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className={`text-xs mt-0.5 font-medium ${color || 'text-gray-400'}`}>{sub}</p>}
      {note && <p className="text-[10px] text-gray-300 mt-0.5">{note}</p>}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const todayStr = new Date().toISOString().slice(0, 10)
  const [period, setPeriod] = useState(getPeriod(new Date()))
  const [editingPlan, setEditingPlan] = useState(false)
  const [planLeads, setPlanLeads] = useState('')
  const [planBudget, setPlanBudget] = useState('')
  const [planSaved, setPlanSaved] = useState(false)

  // Daily entry state
  const [entryDate, setEntryDate] = useState(todayStr)
  const [entryLeads, setEntryLeads] = useState('')
  const [entrySaved, setEntrySaved] = useState(false)

  const totalDays = daysInMonth(period)
  const periodStart = `${period}-01`
  const periodEnd   = `${period}-${String(totalDays).padStart(2, '0')}`

  // All company reports for the period
  const { data: allReports = [] } = useQuery({
    queryKey: ['reports-company', period],
    queryFn: () => api.get(`/reports/company?from=${periodStart}&to=${periodEnd}`).then(r => r.data),
  })

  const mktReports  = useMemo(() => (allReports as any[]).filter((r: any) => r.type === 'MARKETER'), [allReports])
  const liderReports = useMemo(() => (allReports as any[]).filter((r: any) => r.type === 'LIDER'), [allReports])
  const closerReports = useMemo(() => (allReports as any[]).filter((r: any) => r.type === 'CLOSER'), [allReports])

  // Plans
  const { data: plans = [], refetch: refetchPlans } = useQuery({
    queryKey: ['plans', period],
    queryFn: () => api.get(`/plans?period=${period}`).then(r => r.data),
  })
  const leadsplan  = (plans as any[]).find((p: any) => p.type === 'LEADS'  && !p.userId && !p.departmentId)?.value || 0
  const budgetPlan = (plans as any[]).find((p: any) => p.type === 'BUDGET' && !p.userId && !p.departmentId)?.value || 0

  // Totals
  const totalLeads     = mktReports.reduce((s: number, r: any) => s + (Number(r.data?.leads) || 0), 0)
  const totalBudget    = mktReports.reduce((s: number, r: any) => s + (Number(r.data?.budget) || 0), 0)
  const totalQual      = liderReports.reduce((s: number, r: any) => s + (Number(r.data?.qualifiedLeads) || 0), 0)
  const totalMeetings  = liderReports.reduce((s: number, r: any) => s + (Number(r.data?.meetingsAttended) || 0), 0)
  const totalSales     = closerReports.reduce((s: number, r: any) => s + (Number(r.data?.salesCount) || 0), 0)
  const leadCost       = totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0
  const leadsPct       = leadsplan > 0 ? pct(totalLeads, leadsplan) : null
  const budgetPct      = budgetPlan > 0 ? pct(totalBudget, budgetPlan) : null

  // Date map for entry
  const byDate = useMemo(() => {
    const m: Record<string, any> = {}
    mktReports.forEach((r: any) => { m[r.date.slice(0, 10)] = r })
    return m
  }, [mktReports])

  const existingEntry = byDate[entryDate]
  const funnelMax = Math.max(totalLeads, 1)

  const today = new Date()
  const todayPeriod = getPeriod(today)
  const todayDay = period === todayPeriod ? today.getDate() : null
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)

  // Save daily leads
  const saveEntry = useMutation({
    mutationFn: () => api.post('/reports/for-user', {
      userId: user!.id, date: entryDate, type: 'MARKETER',
      data: { leads: entryLeads ? +entryLeads : 0, budget: totalBudget },
      comment: '',
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['reports-company', period] })
      setEntrySaved(true)
      setTimeout(() => setEntrySaved(false), 2500)
    },
  })

  // Save plans inline
  const savePlan = useMutation({
    mutationFn: () => api.post('/plans/bulk', {
      period,
      plans: [
        ...(planLeads  ? [{ type: 'LEADS',  value: +planLeads  }] : []),
        ...(planBudget ? [{ type: 'BUDGET', value: +planBudget }] : []),
      ],
    }),
    onSuccess: async () => {
      await refetchPlans()
      setEditingPlan(false)
      setPlanSaved(true)
      setTimeout(() => setPlanSaved(false), 2000)
    },
  })

  function openEdit() {
    setPlanLeads(leadsplan ? String(leadsplan) : '')
    setPlanBudget(budgetPlan ? String(budgetPlan) : '')
    setEditingPlan(true)
  }

  function onDateChange(date: string) {
    setEntryDate(date)
    const r = byDate[date]
    setEntryLeads(r ? String(r.data?.leads || '') : '')
  }

  return (
    <div className="space-y-6 w-full">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Маркетинг</h1>
          <p className="text-sm text-gray-500 mt-0.5">Лидогенерация и рекламный бюджет</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setPeriod(p => shiftMonth(p, -1))} className="p-1.5 hover:bg-white rounded-md transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="px-3 text-sm font-semibold text-gray-800 min-w-[140px] text-center">{formatMonth(period)}</span>
          <button onClick={() => setPeriod(p => shiftMonth(p, 1))} disabled={period >= todayPeriod}
            className="p-1.5 hover:bg-white rounded-md transition-colors disabled:opacity-30">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Plan row */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 text-sm">Плановые показатели на {formatMonth(period)}</h2>
          {!editingPlan
            ? <button onClick={openEdit} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
                <Pencil className="w-3 h-3" /> Изменить
              </button>
            : <button onClick={() => setEditingPlan(false)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" /> Отмена
              </button>
          }
        </div>
        {!editingPlan ? (
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-gray-400">Лидов план</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{leadsplan || <span className="text-gray-300 font-normal text-sm">Не задан</span>}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Бюджет план</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{budgetPlan ? `₸ ${fmt(budgetPlan)}` : <span className="text-gray-300 font-normal text-sm">Не задан</span>}</p>
            </div>
            {planSaved && <p className="text-xs text-green-600 self-end mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Сохранено</p>}
          </div>
        ) : (
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Лидов план (шт)</label>
              <input type="number" min="0" value={planLeads} onChange={e => setPlanLeads(e.target.value)} placeholder="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Рекламный бюджет план (₸)</label>
              <input type="number" min="0" value={planBudget} onChange={e => setPlanBudget(e.target.value)} placeholder="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <button onClick={() => savePlan.mutate()} disabled={savePlan.isPending || (!planLeads && !planBudget)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Сохранить
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Лидов получено" value={totalLeads}
          sub={leadsPct !== null ? `${leadsPct}% от плана (${leadsplan})` : leadsplan ? `план: ${leadsplan}` : undefined}
          pctVal={leadsPct} />
        <StatCard label="Квалифицировано" value={totalQual}
          sub={totalLeads > 0 ? `${pct(totalQual, totalLeads)}% из лидов` : undefined}
          note="из отчётов лидорубов" />
        <StatCard label="Стоимость лида" value={leadCost ? `₸ ${fmt(leadCost)}` : '—'}
          sub={budgetPct !== null ? `Бюджет: ${budgetPct}% от плана` : budgetPlan ? `Бюджет план: ₸ ${fmt(budgetPlan)}` : undefined} />
        <StatCard label="Конверсия лид→продажа" value={totalLeads > 0 ? `${pct(totalSales, totalLeads)}%` : '—'}
          sub={totalLeads > 0 ? `${totalSales} из ${totalLeads} лидов` : 'нет данных по лидам'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Воронка — как работают лиды</h2>
          <div className="space-y-1">
            <FunnelRow label="Лидов получено" value={totalLeads} max={funnelMax} color="bg-blue-400" />
            <FunnelRow label="Квалифицировано" value={totalQual} max={funnelMax} color="bg-purple-400"
              conv={totalLeads > 0 ? pct(totalQual, totalLeads) : null} />
            <FunnelRow label="Пришло на встречу" value={totalMeetings} max={funnelMax} color="bg-amber-400"
              conv={totalQual > 0 ? pct(totalMeetings, totalQual) : null} />
            <FunnelRow label="Сделок закрыто" value={totalSales} max={funnelMax} color="bg-green-500"
              conv={totalMeetings > 0 ? pct(totalSales, totalMeetings) : null} />
          </div>
          {totalLeads === 0 && (
            <p className="text-xs text-gray-400 mt-4 text-center">Введите лиды за сегодня чтобы увидеть воронку →</p>
          )}
        </div>

        {/* Daily entry */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Лиды за день</h2>
          <p className="text-xs text-gray-400 mb-4">Сколько новых лидов пришло сегодня?</p>

          <div className="flex items-end gap-3 flex-wrap mb-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Дата</label>
              <input type="date" value={entryDate} max={todayStr} onChange={e => onDateChange(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Лидов получено</label>
              <div className="relative">
                <input type="number" min="0" value={entryLeads} onChange={e => setEntryLeads(e.target.value)}
                  placeholder="0" autoFocus
                  className="border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm w-32 focus:ring-2 focus:ring-blue-500 outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">шт</span>
              </div>
            </div>
            <button onClick={() => saveEntry.mutate()} disabled={saveEntry.isPending || !entryLeads}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors flex items-center gap-1.5">
              {entrySaved ? <><CheckCircle className="w-3.5 h-3.5" /> Записано</> : <><Save className="w-3.5 h-3.5" /> Сохранить</>}
            </button>
          </div>

          {existingEntry && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              За {new Date(entryDate + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} уже записано: {existingEntry.data?.leads} лидов
            </div>
          )}

          {/* Mini calendar */}
          {mktReports.length > 0 && (
            <div className="mt-5">
              <p className="text-xs text-gray-400 mb-2">История по дням</p>
              <div className="overflow-x-auto">
                <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
                  {days.map(d => {
                    const dateStr = `${period}-${String(d).padStart(2, '0')}`
                    const isToday = d === todayDay
                    const isFuture = todayDay ? d > todayDay : false
                    const r = byDate[dateStr]
                    const val = r ? Number(r.data?.leads) || 0 : null
                    return (
                      <button key={d} onClick={() => !isFuture && onDateChange(dateStr)}
                        className={`flex flex-col items-center w-8 py-1 rounded text-[10px] transition-colors cursor-pointer
                          ${dateStr === entryDate ? 'bg-blue-100 text-blue-700 font-bold' : isToday ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-500'}
                          ${isFuture ? 'opacity-30 cursor-default' : ''}`}>
                        <span>{d}</span>
                        <span className={`font-semibold mt-0.5 ${val ? 'text-gray-800' : 'text-gray-200'}`}>
                          {isFuture ? '·' : val ?? '—'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Budget block */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Рекламный бюджет</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">План на месяц</p>
            <p className="font-bold text-gray-900 text-lg">{budgetPlan ? `₸ ${fmt(budgetPlan)}` : <span className="text-gray-300 font-normal">Не задан</span>}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Потрачено</p>
            <p className="font-bold text-gray-900 text-lg">{totalBudget ? `₸ ${fmt(totalBudget)}` : <span className="text-gray-300 font-normal">—</span>}</p>
            {budgetPct !== null && <p className="text-xs text-gray-400 mt-0.5">{budgetPct}% от плана</p>}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Стоимость лида</p>
            <p className="font-bold text-gray-900 text-lg">{leadCost ? `₸ ${fmt(leadCost)}` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Ст-ть квал. лида</p>
            <p className="font-bold text-gray-900 text-lg">{totalQual > 0 && totalBudget > 0 ? `₸ ${fmt(Math.round(totalBudget / totalQual))}` : '—'}</p>
          </div>
        </div>
        {budgetPlan > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Расход бюджета</span>
              <span>{budgetPct ?? 0}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-2 rounded-full transition-all ${(budgetPct ?? 0) > 100 ? 'bg-red-400' : 'bg-blue-400'}`}
                style={{ width: `${Math.min(budgetPct ?? 0, 100)}%` }} />
            </div>
          </div>
        )}
        <p className="text-xs text-gray-300 mt-3">
          Фактические расходы вводятся в разделе «Планы» → Маркетинг → Бюджет
        </p>
      </div>

    </div>
  )
}
