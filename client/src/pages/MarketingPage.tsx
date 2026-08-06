import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import {
  Download, Save, Pencil, X, CheckCircle, Plus, Trash2,
  TrendingUp, Users, Target, DollarSign, ChevronRight, BarChart2,
  Settings, RefreshCw, Send, Calendar,
} from 'lucide-react'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import { useT } from '../i18n'

// ─── helpers ─────────────────────────────────────────────────────────────────
function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function localFirstOfMonth() {
  const d = new Date(); d.setDate(1)
  return localDateStr(d)
}

function fmt(n: number | undefined | null) {
  if (!n) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'М'
  if (n >= 1_000)     return Math.round(n / 1_000) + ' тыс'
  return n.toLocaleString('ru-RU')
}
function fmtMoney(n: number | undefined | null) {
  if (!n) return '—'
  return '₸ ' + (n >= 1_000_000
    ? (n / 1_000_000).toFixed(2) + 'М'
    : n.toLocaleString('ru-RU'))
}
function pct(a: number, b: number) {
  if (b === 0) return 0
  return Math.round((a / b) * 10) / 10
}
function colorPct(v: number, good = 70, ok = 40) {
  if (v >= good) return 'text-green-600'
  if (v >= ok)   return 'text-amber-500'
  return 'text-red-500'
}
function progressColor(v: number) {
  if (v >= 80) return 'bg-green-500'
  if (v >= 50) return 'bg-blue-500'
  if (v >= 30) return 'bg-amber-400'
  return 'bg-red-400'
}

async function downloadExport(endpoint: string, params: string) {
  const token = useAuthStore.getState().token
  const baseUrl = import.meta.env.VITE_API_URL || '/api'
  const res = await fetch(`${baseUrl}/export/${endpoint}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) { alert('Ошибка экспорта'); return }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const nameMatch = cd.match(/filename\*=UTF-8''(.+)/)
  const filename = nameMatch ? decodeURIComponent(nameMatch[1]) : 'report.xlsx'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, pctVal, color = 'text-gray-900', planVal, factVal, border
}: {
  label: string; value: string | number; sub?: string
  pctVal?: number | null; color?: string; planVal?: number; factVal?: number; border?: string
}) {
  const pctColor = pctVal != null ? colorPct(pctVal) : ''
  const barPct = pctVal != null ? Math.min(pctVal, 100) : 0
  return (
    <div className={`bg-white rounded-2xl border ${border || 'border-gray-100'} p-4 space-y-1.5`}>
      <p className="text-xs text-gray-400 font-medium leading-tight">{label}</p>
      <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
      {(planVal !== undefined && factVal !== undefined) && (
        <>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-1.5 rounded-full transition-all ${progressColor(barPct)}`} style={{ width: `${barPct}%` }} />
          </div>
          <p className={`text-xs font-semibold ${pctColor}`}>
            Факт: {factVal.toLocaleString('ru-RU')} <span className="text-gray-400 font-normal">· {pctVal ?? 0}%</span>
          </p>
        </>
      )}
      {sub && !planVal && <p className={`text-xs ${pctColor || 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}

// ─── Mini metric ──────────────────────────────────────────────────────────────
function MetricChip({ label, value, color = 'text-gray-800', sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <p className="text-[10px] text-gray-400 font-medium leading-tight mb-0.5">{label}</p>
      <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Funnel bar row ───────────────────────────────────────────────────────────
function FunnelRow({ label, value, max, color, conv }: { label: string; value: number; max: number; color: string; conv?: number | null }) {
  const w = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-44 shrink-0 leading-tight">{label}</span>
      <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
        <div className={`h-6 rounded ${color}`} style={{ width: `${w}%`, transition: 'width 0.4s ease' }} />
      </div>
      <span className="text-sm font-bold text-gray-800 w-10 text-right">{value}</span>
      {conv !== undefined && conv !== null && (
        <span className={`text-xs font-semibold w-14 text-right ${colorPct(conv)}`}>{conv}%</span>
      )}
    </div>
  )
}

// ─── Donut chart (pure CSS) ───────────────────────────────────────────────────
const DONUT_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316']
function DonutChart({ segments, total }: { segments: { label: string; count: number; color: string }[]; total: number }) {
  let offset = 0
  const r = 70, cx = 80, cy = 80
  const circ = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 160 160" className="w-full h-full">
      {segments.map((seg, i) => {
        const frac = total > 0 ? seg.count / total : 0
        const dash = frac * circ
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color}
            strokeWidth="28" strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset * circ} transform="rotate(-90)" style={{ transformOrigin: `${cx}px ${cy}px` }} />
        )
        offset += frac
        return el
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" className="text-2xl font-bold" fontSize="22" fontWeight="700" fill="#1f2937">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#9ca3af">потерянных</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize="9" fill="#9ca3af">лидов</text>
    </svg>
  )
}

// ─── Channel budget inline editor ─────────────────────────────────────────────
function ChannelBudgetRow({
  channel, dateFrom, dateTo,
}: {
  channel: { id: string; name: string }
  dateFrom: string; dateTo: string
}) {
  const qc = useQueryClient()
  const { data: existing } = useQuery({
    queryKey: ['channel-budget-row', channel.id, dateFrom, dateTo],
    queryFn: () => api.get(`/channel-budgets?from=${dateFrom}&to=${dateTo}`).then(r => {
      const found = (r.data as any[]).filter((b: any) => b.channelId === channel.id)
      if (found.length === 0) return null  // no record at all
      return found.reduce((s: number, b: any) => s + b.spend, 0)
    }),
  })
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const saveMut = useMutation({
    mutationFn: () => api.put('/channel-budgets', { channelId: channel.id, date: dateFrom, spend: Number(value) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channel-budget-row'] })
      qc.invalidateQueries({ queryKey: ['channel-budgets-history'] })
      qc.invalidateQueries({ queryKey: ['marketing-dashboard'] })
      setEditing(false)
    },
  })

  // existing === null → no record; existing === 0 → record with 0; existing > 0 → has spend
  const hasSaved = existing !== null && existing !== undefined

  return (
    <span className="flex items-center gap-1">
      {editing ? (
        <>
          <input type="number" value={value} onChange={e => setValue(e.target.value)} autoFocus
            className="w-24 text-xs border border-blue-300 rounded px-1.5 py-1 outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="0" onKeyDown={e => { if (e.key === 'Enter') saveMut.mutate(); if (e.key === 'Escape') setEditing(false) }} />
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="text-blue-600 hover:text-blue-800 p-0.5"><CheckCircle className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 p-0.5"><X className="w-3 h-3" /></button>
        </>
      ) : (
        <button onClick={() => { setValue(hasSaved ? String(existing) : ''); setEditing(true) }}
          className="flex items-center gap-1 text-xs text-gray-700 hover:text-blue-700 group">
          {hasSaved ? `₸ ${(existing as number).toLocaleString('ru-RU')}` : <span className="text-gray-300">— введите</span>}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
        </button>
      )}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const { t } = useT()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canManagePlans = user?.role === 'MARKETER'
  const periodState = usePeriodStore()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'entry' | 'channels'>('dashboard')
  const [editingPlans, setEditingPlans] = useState(false)
  const [planLeadsVal, setPlanLeadsVal] = useState('')
  const [planQualVal, setPlanQualVal] = useState('')
  const [planBudgetVal, setPlanBudgetVal] = useState('')
  const [entryDate, setEntryDate] = useState(localDateStr(new Date()))
  const [reportSent, setReportSent] = useState(false)

  const apiParams = buildPeriodParams(periodState)
  const fromParam = useMemo(() => {
    const p = new URLSearchParams(apiParams)
    return p.get('from') || localFirstOfMonth()
  }, [apiParams])
  const toParam = useMemo(() => {
    const p = new URLSearchParams(apiParams)
    return p.get('to') || localDateStr(new Date())
  }, [apiParams])

  // ── Dashboard data ─────────────────────────────────────────────────────────
  const { data: dash, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['marketing-dashboard', fromParam, toParam],
    queryFn: () => api.get(`/channel-budgets/dashboard?from=${fromParam}&to=${toParam}`).then(r => r.data),
    refetchInterval: 60000,
    placeholderData: keepPreviousData,
  })

  // ── Sales channels ─────────────────────────────────────────────────────────
  const { data: channels = [] } = useQuery<{ id: string; name: string; createdAt: string }[]>({
    queryKey: ['sales-channels'],
    queryFn: () => api.get('/sales-channels').then(r => r.data),
  })

  // ── Plans save ─────────────────────────────────────────────────────────────
  const monthKey = fromParam.slice(0, 7)
  const savePlansMut = useMutation({
    mutationFn: () => api.post('/plans/bulk', {
      period: monthKey,
      plans: [
        ...(planLeadsVal  ? [{ type: 'LEADS',           value: +planLeadsVal  }] : []),
        ...(planQualVal   ? [{ type: 'QUALIFIED_LEADS',  value: +planQualVal   }] : []),
        ...(planBudgetVal ? [{ type: 'BUDGET',           value: +planBudgetVal }] : []),
      ],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing-dashboard'] }); setEditingPlans(false) },
  })

  const openPlanEdit = () => {
    setPlanLeadsVal(dash?.plans?.planLeads ? String(dash.plans.planLeads) : '')
    setPlanQualVal(dash?.plans?.planQual ? String(dash.plans.planQual) : '')
    setPlanBudgetVal(dash?.plans?.planBudget ? String(dash.plans.planBudget) : '')
    setEditingPlans(true)
  }

  const o = dash?.overview || {}
  const kpi = dash?.kpi || {}
  const plans = dash?.plans || {}

  const leadsFactPct  = plans.planLeads  > 0 ? pct(o.totalLeads,  plans.planLeads)  : null
  const qualFactPct   = plans.planQual   > 0 ? pct(o.qualLeads,   plans.planQual)   : null
  const budgetFactPct = plans.planBudget > 0 ? pct(o.totalSpend,  plans.planBudget) : null

  const funnelMax = Math.max(o.totalLeads || 0, 1)
  const lossSegs = (dash?.lossReasons || []).map((r: any, i: number) => ({ label: r.label, count: r.count, color: DONUT_COLORS[i % DONUT_COLORS.length] }))

  return (
    <div className="min-h-full bg-gray-50">
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('mkt.page.title')}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{fromParam} — {toParam}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className={`p-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors ${isFetching ? 'animate-spin text-blue-500' : ''}`} title="Обновить">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => downloadExport('marketer', apiParams)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> {t('mkt.page.export')}
            </button>
          </div>
        </div>

        {/* ── Tabs — only MARKETER sees the tab bar ── */}
        {user?.role === 'MARKETER' && (
          <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit shadow-sm">
            {([['dashboard', t('mkt.tab.dashboard'), BarChart2], ['entry', t('mkt.tab.entry'), DollarSign], ['channels', t('mkt.tab.channels'), Settings]] as const)
              .map(([id, label, Icon]) => (
              <button key={id} onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        )}

        {/* ═══════════ DASHBOARD TAB ═══════════ */}
        {activeTab === 'dashboard' && (
          <>
            {!dash && isLoading ? (
              <div className="text-center py-20 text-gray-400">{t('mkt.page.loading')}</div>
            ) : (
              <>
                {/* ── Plan KPI row ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard label={t('mkt.kpi.planLeads')} value={plans.planLeads || '—'} color="text-gray-800"
                    planVal={plans.planLeads} factVal={o.totalLeads} pctVal={leadsFactPct} />
                  <KpiCard label={t('mkt.kpi.planQualLeads')} value={plans.planQual || '—'} color="text-gray-800"
                    planVal={plans.planQual} factVal={o.qualLeads} pctVal={qualFactPct} />
                  <KpiCard label={t('mkt.kpi.planBudget')} value={plans.planBudget ? fmtMoney(plans.planBudget) : '—'} color="text-gray-800"
                    planVal={plans.planBudget} factVal={o.totalSpend} pctVal={budgetFactPct} />
                  <KpiCard label={t('mkt.kpi.factLeads')} value={o.totalLeads ?? 0} color="text-blue-600"
                    sub={leadsFactPct != null ? t('mkt.kpi.pctPlan').replace('{{pct}}', String(leadsFactPct)) : t('mkt.kpi.leadsPeriod')} />
                  <KpiCard label={t('mkt.kpi.factQualLeads')} value={o.qualLeads ?? 0} color="text-green-600"
                    sub={qualFactPct != null ? t('mkt.kpi.pctPlan').replace('{{pct}}', String(qualFactPct)) : t('mkt.kpi.pctAllLeads').replace('{{pct}}', String(kpi.convLidToQual ?? 0))} />
                  <KpiCard label={t('mkt.kpi.spend')} value={fmtMoney(o.totalSpend)} color="text-orange-600"
                    sub={budgetFactPct != null ? t('mkt.kpi.pctPlan').replace('{{pct}}', String(budgetFactPct)) : t('mkt.kpi.spent')} />
                </div>

                {/* ── Edit plans (OWNER/ROP only) ── */}
                {canManagePlans && <div className="flex items-center gap-3">
                  {!editingPlans ? (
                    <button onClick={openPlanEdit}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                      {plans.planLeads || plans.planQual || plans.planBudget ? t('mkt.plans.change') : t('mkt.plans.set')}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap bg-white rounded-xl border border-gray-200 p-4">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">{t('mkt.plans.leads')}</label>
                        <input type="number" value={planLeadsVal} onChange={e => setPlanLeadsVal(e.target.value)}
                          placeholder="0" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">{t('mkt.plans.qualLeads')}</label>
                        <input type="number" value={planQualVal} onChange={e => setPlanQualVal(e.target.value)}
                          placeholder="0" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">{t('mkt.plans.budget')}</label>
                        <input type="number" value={planBudgetVal} onChange={e => setPlanBudgetVal(e.target.value)}
                          placeholder="0" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40 focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => savePlansMut.mutate()} disabled={savePlansMut.isPending}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1.5">
                          <Save className="w-3.5 h-3.5" /> Сохранить
                        </button>
                        <button onClick={() => setEditingPlans(false)} className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm">Отмена</button>
                      </div>
                    </div>
                  )}
                </div>}

                {/* ── KPI metrics row (CPL, CPQL, CAC, ДРР, конверсии) ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <MetricChip label={t('mkt.kpi.cpl')} value={kpi.cpl ? fmtMoney(kpi.cpl) : '—'} color="text-indigo-700"
                    sub={o.totalLeads > 0 ? t('mkt.kpi.leadsN').replace('{{n}}', String(o.totalLeads)) : undefined} />
                  <MetricChip label={t('mkt.kpi.cpql')} value={kpi.cpql ? fmtMoney(kpi.cpql) : '—'} color="text-purple-700"
                    sub={o.qualLeads > 0 ? t('mkt.kpi.qualN').replace('{{n}}', String(o.qualLeads)) : undefined} />
                  <MetricChip label={t('mkt.kpi.cac')} value={kpi.cac ? fmtMoney(kpi.cac) : '—'} color="text-blue-700"
                    sub={o.totalSalesCount > 0 ? t('mkt.kpi.salesN').replace('{{n}}', String(o.totalSalesCount)) : undefined} />
                  <MetricChip label={t('mkt.kpi.drr')} value={kpi.drr != null ? `${kpi.drr}%` : '—'} color={kpi.drr > 30 ? 'text-red-600' : 'text-green-600'}
                    sub={o.totalRevenue > 0 ? t('mkt.kpi.revenueN').replace('{{r}}', fmtMoney(o.totalRevenue)) : undefined} />
                  <MetricChip label={t('mkt.kpi.convLeadSale')} value={kpi.convOverall != null ? `${kpi.convOverall}%` : '—'} color={colorPct(kpi.convOverall ?? 0, 15, 7)}
                    sub={o.totalSalesCount > 0 ? `${o.totalSalesCount} из ${o.totalLeads}` : undefined} />
                </div>

                {/* ── Carryover sales (дожим) ── */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">{t('mkt.carryover.title')}</p>
                    <p className="text-sm text-amber-600">{t('mkt.carryover.sub')}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-800">{dash?.carryover?.count ?? 0}</p>
                      <p className="text-xs text-amber-500">{t('mkt.carryover.deals')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-800">{fmtMoney(dash?.carryover?.revenue ?? 0)}</p>
                      <p className="text-xs text-amber-500">{t('mkt.carryover.revenue')}</p>
                    </div>
                  </div>
                </div>

                {/* ── Conversion chain ── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">{t('mkt.convChain.title')}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { label: t('mkt.convChain.leadQual'),    value: kpi.convLidToQual },
                      { label: t('mkt.convChain.qualSched'),   value: kpi.convQualToScheduled },
                      { label: t('mkt.convChain.schedHapp'),   value: kpi.convScheduledToHappened },
                      { label: t('mkt.convChain.happSale'),    value: kpi.convHappenedToSale },
                    ].map((step, i, arr) => (
                      <div key={step.label} className="flex items-center gap-2">
                        <div className="text-center">
                          <p className="text-xs text-gray-400 whitespace-nowrap">{step.label}</p>
                          <p className={`text-xl font-bold ${colorPct(step.value ?? 0, 60, 30)}`}>
                            {step.value != null ? `${step.value}%` : '—'}
                          </p>
                        </div>
                        {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-gray-200 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Per-channel table ── */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50">
                    <h2 className="font-bold text-gray-900">{t('mkt.table.title')}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{t('mkt.table.hint')}</p>
                  </div>
                  {channels.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                      <p className="font-medium">{t('mkt.table.noChannels')}</p>
                      <p className="text-sm mt-1">{t('mkt.table.noChannelsSub')}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs font-semibold text-gray-500">
                            <th className="text-left px-5 py-3">{t('mkt.table.channel')}</th>
                            <th className="text-center px-4 py-3">{t('mkt.table.spent')}</th>
                            <th className="text-center px-4 py-3">{t('mkt.table.leads')}</th>
                            <th className="text-center px-4 py-3">{t('mkt.table.qualLeads')}</th>
                            <th className="text-center px-4 py-3">{t('mkt.table.notQual')}</th>
                            <th className="text-center px-4 py-3">CPL</th>
                            <th className="text-center px-4 py-3">CPQL</th>
                            <th className="text-center px-4 py-3">{t('mkt.table.convLQ')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(dash?.channels || []).filter((ch: any) => ch.id !== '__none__' && (ch.leads > 0 || ch.spend > 0)).map((ch: any) => (
                            <tr key={ch.id} className="border-t border-gray-50 hover:bg-blue-50/30 transition-colors">
                              <td className="px-5 py-3 font-semibold text-gray-800">{ch.name}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{ch.spend > 0 ? fmtMoney(ch.spend) : <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-3 text-center font-semibold text-gray-900">{ch.leads || 0}</td>
                              <td className="px-4 py-3 text-center text-green-700 font-semibold">{ch.qualLeads || 0}</td>
                              <td className="px-4 py-3 text-center text-red-500">{ch.notQual || 0}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{ch.cpl ? fmtMoney(ch.cpl) : <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{ch.cpql ? fmtMoney(ch.cpql) : <span className="text-gray-300">—</span>}</td>
                              <td className={`px-4 py-3 text-center font-bold ${colorPct(ch.convLidToQual ?? 0, 50, 30)}`}>
                                {ch.convLidToQual != null ? `${ch.convLidToQual}%` : '—'}
                              </td>
                            </tr>
                          ))}
                          {/* Total row */}
                          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                            <td className="px-5 py-3 text-gray-900">{t('mkt.table.total')}</td>
                            <td className="px-4 py-3 text-center text-gray-900">{fmtMoney(o.totalSpend)}</td>
                            <td className="px-4 py-3 text-center text-gray-900">{o.totalLeads ?? 0}</td>
                            <td className="px-4 py-3 text-center text-green-700">{o.qualLeads ?? 0}</td>
                            <td className="px-4 py-3 text-center text-red-500">{(o.totalLeads ?? 0) - (o.qualLeads ?? 0)}</td>
                            <td className="px-4 py-3 text-center text-gray-900">{kpi.cpl ? fmtMoney(kpi.cpl) : '—'}</td>
                            <td className="px-4 py-3 text-center text-gray-900">{kpi.cpql ? fmtMoney(kpi.cpql) : '—'}</td>
                            <td className={`px-4 py-3 text-center font-bold ${colorPct(kpi.convLidToQual ?? 0, 50, 30)}`}>
                              {kpi.convLidToQual != null ? `${kpi.convLidToQual}%` : '—'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── Funnel + Loss reasons ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Funnel */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h2 className="font-bold text-gray-900 mb-4">{t('mkt.funnel.title')} <span className="text-xs font-normal text-gray-400">{t('mkt.funnel.sub')}</span></h2>
                    <div className="space-y-2">
                      <FunnelRow label={t('mkt.funnel.leads')} value={o.totalLeads ?? 0} max={funnelMax} color="bg-blue-500" />
                      <FunnelRow label={t('mkt.funnel.qualLeads')} value={o.qualLeads ?? 0} max={funnelMax} color="bg-indigo-500"
                        conv={kpi.convLidToQual} />
                      <FunnelRow label={t('mkt.funnel.scheduled')} value={o.scheduled ?? 0} max={funnelMax} color="bg-purple-400"
                        conv={kpi.convQualToScheduled} />
                      <FunnelRow label={t('mkt.funnel.happened')} value={o.happened ?? 0} max={funnelMax} color="bg-amber-400"
                        conv={kpi.convScheduledToHappened} />
                      <FunnelRow label={t('mkt.funnel.sales')} value={o.totalSalesCount ?? 0} max={funnelMax} color="bg-green-500"
                        conv={kpi.convHappenedToSale} />
                    </div>
                  </div>

                  {/* Loss reasons */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h2 className="font-bold text-gray-900 mb-4">{t('mkt.loss.title')}</h2>
                    {lossSegs.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="font-medium">{t('mkt.loss.noData')}</p>
                      </div>
                    ) : (
                      <div className="flex gap-6 items-start">
                        <div className="w-36 h-36 shrink-0">
                          <DonutChart segments={lossSegs} total={dash?.totalLost ?? 0} />
                        </div>
                        <div className="flex-1 space-y-2 min-w-0">
                          {lossSegs.map((seg: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                              <span className="text-xs text-gray-600 flex-1 truncate">{seg.label}</span>
                              <span className="text-xs font-bold text-gray-800">{seg.count}</span>
                              <span className="text-xs text-gray-400">
                                ({dash?.totalLost > 0 ? Math.round((seg.count / dash.totalLost) * 100) : 0}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Bottom revenue + CAC ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <MetricChip label={t('mkt.bottom.revenue')} value={fmtMoney(o.totalRevenue)} color="text-emerald-700" />
                  <MetricChip label={t('mkt.bottom.spend')} value={fmtMoney(o.totalSpend)} color="text-orange-700" />
                  <MetricChip label={t('mkt.bottom.drr')} value={kpi.drr != null ? `${kpi.drr}%` : '—'} color={kpi.drr > 30 ? 'text-red-600' : 'text-green-600'} />
                  <MetricChip label={t('mkt.bottom.salesCount')} value={String(o.totalSalesCount ?? 0)} color="text-blue-700" />
                  <MetricChip label={t('mkt.bottom.cac')} value={kpi.cac ? fmtMoney(kpi.cac) : '—'} color="text-purple-700" />
                </div>

                {/* ── Daily expenses history (visible to OWNER/ROP — read-only table) ── */}
                {user?.role !== 'MARKETER' && (
                  <DailyExpensesHistory channels={channels} fromParam={fromParam} toParam={toParam} />
                )}
              </>
            )}
          </>
        )}

        {/* ═══════════ ENTRY TAB ═══════════ */}
        {activeTab === 'entry' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">

              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-gray-900">{t('mkt.entry.title')}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{t('mkt.entry.sub')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={entryDate}
                    max={localDateStr(new Date())}
                    onChange={e => { setEntryDate(e.target.value); setReportSent(false) }}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {channels.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p>{t('mkt.entry.noChannels')}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    {channels.map(ch => (
                      <div key={ch.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                        <span className="text-sm font-semibold text-gray-800 w-40">{ch.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{t('mkt.entry.spent')}</span>
                          <ChannelBudgetRow channel={ch} dateFrom={entryDate} dateTo={entryDate} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3">
                    {reportSent ? (
                      <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                        <CheckCircle className="w-4 h-4" />
                        {t('mkt.entry.saved').replace('{{date}}', entryDate)}
                      </div>
                    ) : (
                      <button
                        onClick={() => { qc.invalidateQueries({ queryKey: ['marketing-dashboard'] }); setReportSent(true) }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        {t('mkt.entry.send').replace('{{date}}', entryDate)}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Daily expenses history */}
            <DailyExpensesHistory channels={channels} fromParam={fromParam} toParam={toParam} />
          </div>
        )}

        {/* ═══════════ CHANNELS TAB ═══════════ */}
        {activeTab === 'channels' && (
          <SalesChannelsSection />
        )}

      </div>
    </div>
  )
}

// ─── Editable history cell ────────────────────────────────────────────────────
function HistoryCell({
  date, channel, initialSpend, onSaved,
}: {
  date: string
  channel: { id: string; name: string }
  initialSpend: number | null   // null = no record
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const saveMut = useMutation({
    mutationFn: () => api.put('/channel-budgets', { channelId: channel.id, date, spend: Number(value) || 0 }),
    onSuccess: () => { setEditing(false); onSaved() },
  })

  if (editing) {
    return (
      <td className="px-2 py-1.5 whitespace-nowrap text-right">
        <span className="flex items-center justify-end gap-1">
          <input type="number" value={value} onChange={e => setValue(e.target.value)} autoFocus
            className="w-20 text-xs border border-blue-300 rounded px-1.5 py-1 outline-none focus:ring-2 focus:ring-blue-400 text-right"
            placeholder="0"
            onKeyDown={e => { if (e.key === 'Enter') saveMut.mutate(); if (e.key === 'Escape') setEditing(false) }}
          />
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="text-blue-600 hover:text-blue-800"><CheckCircle className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)}
            className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
        </span>
      </td>
    )
  }

  const hasValue = initialSpend !== null && initialSpend !== undefined
  return (
    <td className="px-3 py-2.5 whitespace-nowrap text-right">
      <button
        onClick={() => { setValue(hasValue ? String(initialSpend) : ''); setEditing(true) }}
        className={`text-sm w-full text-right hover:text-blue-600 transition-colors group relative ${hasValue && (initialSpend as number) > 0 ? 'text-gray-800 font-medium' : 'text-gray-300'}`}
        title="Нажмите для редактирования"
      >
        {hasValue && (initialSpend as number) >= 0
          ? (initialSpend as number).toLocaleString('ru-RU')
          : '—'}
        <Pencil className="w-3 h-3 absolute -right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 text-blue-500 transition-opacity" />
      </button>
    </td>
  )
}

// ─── Daily Expenses History ───────────────────────────────────────────────────
function DailyExpensesHistory({ channels: activeChannels, fromParam, toParam }: {
  channels: { id: string; name: string }[]
  fromParam: string
  toParam: string
}) {
  const { t } = useT()
  const qc = useQueryClient()

  const histQ = useQuery({
    queryKey: ['channel-budgets-history', fromParam, toParam],
    queryFn: () => api.get(`/channel-budgets?from=${fromParam}&to=${toParam}`).then(r =>
      r.data as { date: string; channelId: string; channel: { id: string; name: string }; spend: number }[]
    ),
  })

  const rows = histQ.data || []

  // All channels: active + any archived ones that appear in history
  const allChannels = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; archived?: boolean }>()
    for (const ch of activeChannels) seen.set(ch.id, ch)
    for (const r of rows) {
      if (!seen.has(r.channel.id)) seen.set(r.channel.id, { ...r.channel, archived: true })
    }
    return Array.from(seen.values())
  }, [rows, activeChannels])

  // Group by date (descending): { date, byChannel: { channelId → spend | null } }
  const byDate = useMemo(() => {
    const map: Record<string, { date: string; byChannel: Record<string, number>; total: number }> = {}
    for (const r of rows) {
      if (!map[r.date]) map[r.date] = { date: r.date, byChannel: {}, total: 0 }
      map[r.date].byChannel[r.channelId] = (map[r.date].byChannel[r.channelId] || 0) + r.spend
      map[r.date].total += r.spend
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  }, [rows])

  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ['channel-budgets-history'] })
    qc.invalidateQueries({ queryKey: ['channel-budget-row'] })
    qc.invalidateQueries({ queryKey: ['marketing-dashboard'] })
  }

  if (activeChannels.length === 0 && rows.length === 0) return null

  function fmtDate(s: string) {
    const [y, m, d] = s.split('-')
    return `${d}.${m}.${y}`
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">{t('mkt.history.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{fromParam} — {toParam} · {t('mkt.history.hint')}</p>
        </div>
        {histQ.isLoading && <RefreshCw className="w-4 h-4 text-gray-300 animate-spin" />}
      </div>

      {byDate.length === 0 && !histQ.isLoading ? (
        <div className="text-center py-10 text-gray-400">
          <BarChart2 className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">{t('mkt.history.noData')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">{t('mkt.history.date')}</th>
                {allChannels.map(ch => (
                  <th key={ch.id} className="text-right px-3 py-3 text-xs font-semibold whitespace-nowrap">
                    <span className={ch.archived ? 'text-gray-300 line-through' : 'text-gray-500'}>{ch.name}</span>
                    {ch.archived && <span className="ml-1 text-gray-300 text-[10px] font-normal no-underline" style={{ textDecoration: 'none' }}>(архив)</span>}
                  </th>
                ))}
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-700 whitespace-nowrap">{t('mkt.history.total')}</th>
              </tr>
            </thead>
            <tbody>
              {byDate.map(row => (
                <tr key={row.date} className="border-b border-gray-50 last:border-0 hover:bg-blue-50/20 transition-colors">
                  <td className="px-5 py-2.5 text-gray-700 font-medium whitespace-nowrap">{fmtDate(row.date)}</td>
                  {allChannels.map(ch => {
                    const spend = row.byChannel[ch.id]
                    // spend === undefined → no record for this channel on this date
                    const initialSpend = spend !== undefined ? spend : null
                    return (
                      <HistoryCell
                        key={ch.id}
                        date={row.date}
                        channel={ch}
                        initialSpend={initialSpend}
                        onSaved={onSaved}
                      />
                    )
                  })}
                  <td className="text-right px-5 py-2.5 font-semibold text-gray-900 whitespace-nowrap">
                    {row.total.toLocaleString('ru-RU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Sales Channels Management ────────────────────────────────────────────────
function SalesChannelsSection() {
  const { t } = useT()
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  // Active channels
  const channelsQ = useQuery({
    queryKey: ['sales-channels'],
    queryFn: () => api.get('/sales-channels').then(r => r.data as { id: string; name: string; isActive: boolean; createdAt: string }[]),
  })
  // Archived channels
  const archivedQ = useQuery({
    queryKey: ['sales-channels-archived'],
    queryFn: () => api.get('/sales-channels?archived=true').then(r =>
      (r.data as { id: string; name: string; isActive: boolean; createdAt: string }[]).filter(c => !c.isActive)
    ),
    enabled: showArchived,
  })

  const createMut = useMutation({
    mutationFn: () => api.post('/sales-channels', { name: newName.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales-channels'] }); setNewName('') },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.put(`/sales-channels/${id}`, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales-channels'] }); setEditingId(null) },
  })
  const archiveMut = useMutation({
    mutationFn: (id: string) => api.put(`/sales-channels/${id}/archive`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales-channels'] }); qc.invalidateQueries({ queryKey: ['sales-channels-archived'] }) },
  })
  const restoreMut = useMutation({
    mutationFn: (id: string) => api.put(`/sales-channels/${id}/restore`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales-channels'] }); qc.invalidateQueries({ queryKey: ['sales-channels-archived'] }) },
  })

  const channels = channelsQ.data || []
  const archived = archivedQ.data || []

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
      <div>
        <h2 className="font-bold text-gray-900 mb-0.5">{t('mkt.ch.title')}</h2>
        <p className="text-sm text-gray-400">
          {t('mkt.ch.sub')}
        </p>
      </div>

      {/* Add new */}
      <div className="flex items-center gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && newName.trim() && createMut.mutate()}
          placeholder={t('mkt.ch.placeholder')}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={() => createMut.mutate()} disabled={!newName.trim() || createMut.isPending}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      {/* Active channels */}
      {channels.length === 0 && !channelsQ.isLoading && (
        <div className="text-center py-10 text-gray-400">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">{t('mkt.ch.noActive')}</p>
        </div>
      )}
      <div className="space-y-2">
        {channels.map(ch => (
          <div key={ch.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
            <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            {editingId === ch.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') updateMut.mutate({ id: ch.id, name: editName }); if (e.key === 'Escape') setEditingId(null) }}
                  className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button onClick={() => updateMut.mutate({ id: ch.id, name: editName })}
                  disabled={!editName.trim() || updateMut.isPending}
                  className="text-blue-600 hover:text-blue-800 p-1"><CheckCircle className="w-4 h-4" /></button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-gray-800">{ch.name}</span>
                <button onClick={() => { setEditingId(ch.id); setEditName(ch.name) }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Переименовать">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { if (window.confirm(t('mkt.ch.archiveConfirm').replace('{{name}}', ch.name))) archiveMut.mutate(ch.id) }}
                  disabled={archiveMut.isPending}
                  className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="Архивировать">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Archived section */}
      <div className="border-t border-gray-100 pt-4">
        <button onClick={() => setShowArchived(s => !s)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 transition-transform ${showArchived ? 'rotate-180' : ''}`} />
          {showArchived ? t('mkt.ch.hideArchive') : `${t('mkt.ch.showArchive')} ${archived.length > 0 ? `(${archived.length})` : ''}`}
        </button>
        {showArchived && (
          <div className="mt-3 space-y-2">
            {archivedQ.isLoading && <p className="text-xs text-gray-400 py-2">Загрузка...</p>}
            {!archivedQ.isLoading && archived.length === 0 && (
              <p className="text-xs text-gray-400 py-2">{t('mkt.ch.archiveEmpty')}</p>
            )}
            {archived.map(ch => (
              <div key={ch.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 opacity-60">
                <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                <span className="flex-1 text-sm text-gray-500 line-through">{ch.name}</span>
                <button onClick={() => restoreMut.mutate(ch.id)} disabled={restoreMut.isPending}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                  {t('mkt.ch.restore')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
