import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { ChevronLeft, ChevronRight, Save, CheckCircle, Pencil, X } from 'lucide-react'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import { useT } from '../i18n'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPeriod(d: Date) { return d.toISOString().slice(0, 7) }
function formatMonth(p: string, t: (k: any) => string) {
  const [y, m] = p.split('-')
  return `${t(`month.${+m}` as any)} ${y}`
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
  const { t } = useT()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const todayStr = new Date().toISOString().slice(0, 10)
  // Local month for plan nav (only active when global period = 'month')
  const [monthPeriod, setMonthPeriod] = useState(getPeriod(new Date()))
  const [editingPlan, setEditingPlan] = useState(false)
  const [planLeads, setPlanLeads] = useState('')
  const [planBudget, setPlanBudget] = useState('')
  const [planSaved, setPlanSaved] = useState(false)

  // Daily entry state
  const [entryDate, setEntryDate] = useState(todayStr)
  const [entryLeads, setEntryLeads] = useState('')
  const [entryBudget, setEntryBudget] = useState('')
  const [entrySaved, setEntrySaved] = useState(false)

  // Global period store
  const periodState = usePeriodStore()
  const { period: globalPeriod } = periodState

  // Compute date range for API
  const totalDays = daysInMonth(monthPeriod)
  const isMonthMode = globalPeriod === 'month'
  const periodStart = isMonthMode ? `${monthPeriod}-01` : (globalPeriod === 'custom' ? periodState.customFrom : todayStr)
  const periodEnd   = isMonthMode ? `${monthPeriod}-${String(totalDays).padStart(2, '0')}` : (globalPeriod === 'custom' ? periodState.customTo : todayStr)
  const apiParams   = isMonthMode ? `from=${periodStart}&to=${periodEnd}` : buildPeriodParams(periodState)
  // Month key for plans (always use the month view)
  const planPeriod  = isMonthMode ? monthPeriod : (periodState.customFrom || todayStr).slice(0, 7)

  // All company reports for the period
  const { data: allReports = [] } = useQuery({
    queryKey: ['reports-company', periodStart, periodEnd, globalPeriod],
    queryFn: () => api.get(`/reports/company?${apiParams}`).then(r => r.data),
  })

  const mktReports  = useMemo(() => (allReports as any[]).filter((r: any) => r.type === 'MARKETER'), [allReports])
  const liderReports = useMemo(() => (allReports as any[]).filter((r: any) => r.type === 'LIDER'), [allReports])
  const closerReports = useMemo(() => (allReports as any[]).filter((r: any) => r.type === 'CLOSER'), [allReports])

  // Plans
  const { data: plans = [], refetch: refetchPlans } = useQuery({
    queryKey: ['plans', monthPeriod],
    queryFn: () => api.get(`/plans?period=${planPeriod}`).then(r => r.data),
  })
  const leadsplan  = (plans as any[]).find((p: any) => p.type === 'LEADS'  && !p.userId && !p.departmentId)?.value || 0
  const budgetPlan = (plans as any[]).find((p: any) => p.type === 'BUDGET' && !p.userId && !p.departmentId)?.value || 0

  // Totals
  const totalLeads     = mktReports.reduce((s: number, r: any) => s + (Number(r.data?.leads) || 0), 0)
  const totalBudget    = mktReports.reduce((s: number, r: any) => s + (Number(r.data?.budget) || 0), 0)
  const totalQual      = liderReports.reduce((s: number, r: any) => s + (Number(r.data?.qualifiedLeads) || 0), 0)
  const totalMeetings  = liderReports.reduce((s: number, r: any) => s + (Number(r.data?.meetingsAttended) || 0), 0)
  const totalSales     = closerReports.reduce((s: number, r: any) => s + (Number(r.data?.salesCount) || 0), 0)
  // Стоимость лида: если есть фактический бюджет — от него, иначе от плана (плановая ст-ть лида)
  const effectiveBudget = totalBudget > 0 ? totalBudget : budgetPlan
  const leadCost       = totalLeads > 0 && effectiveBudget > 0 ? Math.round(effectiveBudget / totalLeads) : 0
  const isBudgetPlan   = totalBudget === 0 && budgetPlan > 0
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
  const todayDay = monthPeriod === todayPeriod ? today.getDate() : null
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)

  // Save daily leads
  const saveEntry = useMutation({
    mutationFn: () => api.post('/reports/for-user', {
      userId: user!.id, date: entryDate, type: 'MARKETER',
      data: { leads: entryLeads ? +entryLeads : 0, budget: entryBudget ? +entryBudget : 0 },
      comment: '',
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['reports-company'] })
      setEntrySaved(true)
      setTimeout(() => setEntrySaved(false), 2500)
    },
  })

  // Save plans inline
  const savePlan = useMutation({
    mutationFn: () => api.post('/plans/bulk', {
      period: planPeriod,
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
    setEntryBudget(r ? String(r.data?.budget || '') : '')
  }

  return (
    <div className="space-y-6 w-full">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.marketing')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('marketing.subtitle2')}</p>
        </div>
        {/* Month nav — only shown in month mode for browsing history */}
        {isMonthMode && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setMonthPeriod(p => shiftMonth(p, -1))} className="p-1.5 hover:bg-white rounded-md transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="px-3 text-sm font-semibold text-gray-800 min-w-[140px] text-center">{formatMonth(monthPeriod, t)}</span>
            <button onClick={() => setMonthPeriod(p => shiftMonth(p, 1))} disabled={monthPeriod >= todayPeriod}
              className="p-1.5 hover:bg-white rounded-md transition-colors disabled:opacity-30">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Plan row */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 text-sm">{t('marketing.planFor', { month: formatMonth(monthPeriod, t) })}</h2>
          {!editingPlan
            ? <button onClick={openEdit} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
                <Pencil className="w-3 h-3" /> {t('common.edit')}
              </button>
            : <button onClick={() => setEditingPlan(false)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" /> {t('common.cancel')}
              </button>
          }
        </div>
        {!editingPlan ? (
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-gray-400">{t('marketing.planLeads')}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{leadsplan || <span className="text-gray-300 font-normal text-sm">{t('marketing.notSet')}</span>}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('marketing.planBudget')}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{budgetPlan ? `₸ ${fmt(budgetPlan)}` : <span className="text-gray-300 font-normal text-sm">{t('marketing.notSet')}</span>}</p>
            </div>
            {planSaved && <p className="text-xs text-green-600 self-end mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {t('common.saved')}</p>}
          </div>
        ) : (
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('marketing.planLeads')}</label>
              <input type="number" min="0" value={planLeads} onChange={e => setPlanLeads(e.target.value)} placeholder="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('marketing.planBudget')}</label>
              <input type="number" min="0" value={planBudget} onChange={e => setPlanBudget(e.target.value)} placeholder="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <button onClick={() => savePlan.mutate()} disabled={savePlan.isPending || (!planLeads && !planBudget)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> {t('common.save')}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('marketing.leadsReceived')} value={totalLeads}
          sub={leadsPct !== null ? t('marketing.pctFromPlan', { pct: leadsPct, plan: leadsplan }) : leadsplan ? t('marketing.planShort', { plan: leadsplan }) : undefined}
          pctVal={leadsPct} />
        <StatCard label={t('marketing.qualified')} value={totalQual}
          sub={totalLeads > 0 ? t('marketing.pctOfLeads', { pct: pct(totalQual, totalLeads) }) : undefined}
          note={t('marketing.fromLiderReports')} />
        <StatCard label={t('marketing.leadCost')} value={leadCost ? `₸ ${fmt(leadCost)}` : '—'}
          sub={leadCost ? (isBudgetPlan ? t('marketing.planBudgetPerLead') : t('marketing.factBudgetPerLead')) : t('marketing.noBudgetData')} />
        <StatCard label={t('marketing.conv')} value={totalLeads > 0 ? `${pct(totalSales, totalLeads)}%` : '—'}
          sub={totalLeads > 0 ? t('marketing.salesOfLeads', { sales: totalSales, leads: totalLeads }) : t('marketing.noLeadData')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">{t('marketing.funnelTitle')}</h2>
          <div className="space-y-1">
            <FunnelRow label={t('marketing.leadsReceived')} value={totalLeads} max={funnelMax} color="bg-blue-400" />
            <FunnelRow label={t('marketing.qualified')} value={totalQual} max={funnelMax} color="bg-purple-400"
              conv={totalLeads > 0 ? pct(totalQual, totalLeads) : null} />
            <FunnelRow label={t('marketing.funnelMeetings')} value={totalMeetings} max={funnelMax} color="bg-amber-400"
              conv={totalQual > 0 ? pct(totalMeetings, totalQual) : null} />
            <FunnelRow label={t('marketing.funnelSales')} value={totalSales} max={funnelMax} color="bg-green-500"
              conv={totalMeetings > 0 ? pct(totalSales, totalMeetings) : null} />
          </div>
          {totalLeads === 0 && (
            <p className="text-xs text-gray-400 mt-4 text-center">{t('marketing.funnelHint')}</p>
          )}
        </div>

        {/* Daily entry */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-1">{t('marketing.dailyTitle')}</h2>
          <p className="text-xs text-gray-400 mb-4">{t('marketing.dailySubtitle')}</p>

          <div className="flex items-end gap-3 flex-wrap mb-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('marketing.date')}</label>
              <input type="date" value={entryDate} max={todayStr} onChange={e => onDateChange(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('marketing.leads')}</label>
              <div className="relative">
                <input type="number" min="0" value={entryLeads} onChange={e => setEntryLeads(e.target.value)}
                  placeholder="0"
                  className="border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm w-28 focus:ring-2 focus:ring-blue-500 outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">шт</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('marketing.adSpend')} <span className="text-gray-300">{t('marketing.adSpendHint')}</span></label>
              <div className="relative">
                <input type="number" min="0" value={entryBudget} onChange={e => setEntryBudget(e.target.value)}
                  placeholder="0"
                  className="border border-gray-200 rounded-lg px-3 py-2 pr-6 text-sm w-40 focus:ring-2 focus:ring-blue-500 outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₸</span>
              </div>
            </div>
            <button onClick={() => saveEntry.mutate()} disabled={saveEntry.isPending || !entryLeads}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors flex items-center gap-1.5">
              {entrySaved ? <><CheckCircle className="w-3.5 h-3.5" /> {t('marketing.savedEntry')}</> : <><Save className="w-3.5 h-3.5" /> {t('common.save')}</>}
            </button>
          </div>

          {existingEntry && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              {t('marketing.existingEntry', { date: (() => { const d = new Date(entryDate + 'T12:00:00'); return `${d.getDate()} ${t(`month.${d.getMonth() + 1}` as any)}`; })(), leads: existingEntry.data?.leads })}
            </div>
          )}

          {/* Mini calendar */}
          {mktReports.length > 0 && (
            <div className="mt-5">
              <p className="text-xs text-gray-400 mb-2">{t('marketing.historyTitle')}</p>
              <div className="overflow-x-auto">
                <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
                  {days.map(d => {
                    const dateStr = `${monthPeriod}-${String(d).padStart(2, '0')}`
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
        <h2 className="font-semibold text-gray-900 mb-4">{t('marketing.budgetTitle')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('marketing.monthPlan')}</p>
            <p className="font-bold text-gray-900 text-lg">{budgetPlan ? `₸ ${fmt(budgetPlan)}` : <span className="text-gray-300 font-normal">{t('marketing.notSet')}</span>}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('marketing.spent')}</p>
            <p className="font-bold text-gray-900 text-lg">{totalBudget ? `₸ ${fmt(totalBudget)}` : <span className="text-gray-300 font-normal">—</span>}</p>
            {budgetPct !== null && <p className="text-xs text-gray-400 mt-0.5">{budgetPct}% от плана</p>}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('marketing.leadCost')}</p>
            <p className="font-bold text-gray-900 text-lg">{leadCost ? `₸ ${fmt(leadCost)}` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('marketing.qualLeadCost')}</p>
            <p className="font-bold text-gray-900 text-lg">{totalQual > 0 && totalBudget > 0 ? `₸ ${fmt(Math.round(totalBudget / totalQual))}` : '—'}</p>
          </div>
        </div>
        {budgetPlan > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{t('marketing.budgetProgress')}</span>
              <span>{budgetPct ?? 0}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-2 rounded-full transition-all ${(budgetPct ?? 0) > 100 ? 'bg-red-400' : 'bg-blue-400'}`}
                style={{ width: `${Math.min(budgetPct ?? 0, 100)}%` }} />
            </div>
          </div>
        )}
        <p className="text-xs text-gray-300 mt-3">
          {t('marketing.budgetNote')}
        </p>
      </div>

    </div>
  )
}
