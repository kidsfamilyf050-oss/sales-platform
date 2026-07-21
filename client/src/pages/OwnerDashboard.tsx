import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { ChevronLeft, ChevronRight, ChevronDown, ArrowRight, TrendingUp, Users, ExternalLink } from 'lucide-react'
import { useT } from '../i18n'

function fmt(n: number) { return n.toLocaleString('ru-RU') }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0 }

const PAYMENT_TYPE_LABEL: Record<string, string> = { new_sale: 'Новая', additional: 'Доплата' }
const PAYMENT_METHOD_LABEL: Record<string, string> = { cash: 'Нал', card: 'Безнал', credit: 'Кредит', installment: 'Рассрочка' }

function getMonthRange(offset: number) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + offset
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    from: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`,
    to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
    monthNum: first.getMonth() + 1,
    year: first.getFullYear(),
  }
}

function FunnelArrow({ pctVal }: { pctVal: number }) {
  const color = pctVal >= 50 ? 'text-green-600' : pctVal >= 25 ? 'text-amber-500' : 'text-red-500'
  return (
    <div className="flex flex-col items-center justify-center pt-3 flex-shrink-0 px-1">
      <span className={`text-xs font-bold ${color}`}>{pctVal}%</span>
      <ArrowRight className="w-4 h-4 text-gray-300 mt-0.5" />
    </div>
  )
}

function FunnelStep({ label, value, sub, color }: {
  label: string; value: number; sub?: string; color: string
}) {
  return (
    <div className="flex-1 min-w-[80px]">
      <div className="text-xs text-gray-500 mb-1 leading-tight">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{fmt(value)}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// Custom tooltip for chart
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-blue-600 font-bold">₸ {fmt(payload[0]?.value || 0)}</p>
      {entry?.sales > 0 && (
        <p className="text-gray-500 text-xs mt-0.5">{entry.sales} сделок</p>
      )}
    </div>
  )
}

// Expandable sales detail for a manager
function ManagerSalesDetail({ m }: { m: any }) {
  const { t } = useT()
  const sales: any[] = m.sales || []
  return (
    <tr>
      <td colSpan={9} className="pb-3 px-0">
        <div className="ml-6 mr-2 bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {t('dash.periodSales')}
            {sales.length > 0 && (
              <span className="text-blue-600 font-bold ml-2">· {sales.length} · ₸ {fmt(m.salesAmount)}</span>
            )}
          </p>
          {sales.length === 0 ? (
            <p className="text-xs text-gray-400">{t('dash.noSalesPeriod')}</p>
          ) : (
            <div className="space-y-1.5">
              {sales.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <span className="font-bold text-gray-900 whitespace-nowrap min-w-[90px]">₸ {fmt(Number(s.amount))}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${s.paymentType === 'new_sale' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {PAYMENT_TYPE_LABEL[s.paymentType] || s.paymentType}
                  </span>
                  {s.paymentMethod && (
                    <span className="text-gray-500 shrink-0">{PAYMENT_METHOD_LABEL[s.paymentMethod] || s.paymentMethod}</span>
                  )}
                  {s.bank && <span className="text-gray-400 shrink-0">{s.bank}</span>}
                  {s.months && <span className="text-gray-400 shrink-0">{s.months} мес.</span>}
                  {s.date && <span className="text-gray-400 shrink-0">{s.date}</span>}
                  {s.crmLink && (
                    <a href={s.crmLink} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-blue-500 hover:underline shrink-0">
                      <ExternalLink className="w-3 h-3" /> CRM
                    </a>
                  )}
                  {s.comment && <span className="text-gray-400 italic truncate">💬 {s.comment}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function OwnerDashboard() {
  const { t } = useT()
  const periodState = usePeriodStore()
  const [monthOffset, setMonthOffset] = useState(0)
  const [expandedManager, setExpandedManager] = useState<string | null>(null)

  // Build query params — always using actual dates/period strings
  const queryParams = periodState.period === 'month'
    ? (() => { const r = getMonthRange(monthOffset); return `from=${r.from}&to=${r.to}` })()
    : buildPeriodParams(periodState)

  // Use queryParams string as key so React Query refetches whenever params change
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-owner', queryParams],
    queryFn: () => api.get(`/dashboard/owner?${queryParams}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>
  if (!data) return null

  const { summary, dailyChart, managerRating, liderRating } = data
  const monthRange = getMonthRange(monthOffset)

  // Funnel conversions — using LIDER data as source of truth
  const leadsToQual     = pct(summary.totalQualifiedLeads, summary.totalLiderLeads)
  const qualToScheduled = pct(summary.totalMeetingsScheduled, summary.totalQualifiedLeads)
  const scheduledToAtt  = pct(summary.totalMeetingsAttended, summary.totalMeetingsScheduled)
  const attToSale       = pct(summary.totalSalesCount, summary.totalMeetingsAttended)
  const leadsToSale     = pct(summary.totalSalesCount, summary.totalLiderLeads)
  const hasFunnel       = summary.totalLiderLeads > 0 || summary.totalQualifiedLeads > 0
  const leadDeficit     = summary.leadsplan > 0 ? summary.leadsplan - summary.marketingLeads : 0

  // Chart: pick best color per bar based on relative amount
  const maxAmount = Math.max(...(dailyChart || []).map((d: any) => d.amount), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dash.owner.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('dash.owner.subtitle')}</p>
        </div>
        {periodState.period === 'month' && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 self-center">
            <button onClick={() => setMonthOffset(o => o - 1)} className="p-1.5 hover:bg-white rounded-md transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="px-3 text-sm font-semibold text-gray-800 min-w-[150px] text-center">
              {t(`month.${monthRange.monthNum}` as any)} {monthRange.year}
            </span>
            <button
              onClick={() => setMonthOffset(o => Math.min(0, o + 1))}
              disabled={monthOffset >= 0}
              className="p-1.5 hover:bg-white rounded-md transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* ── Block 1: Sales KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard label={t('dash.salesPlan')} value={`₸ ${fmt(summary.salesPlan)}`} />
        <StatCard label={t('dash.salesFact')} value={`₸ ${fmt(summary.totalSalesAmount)}`} color="blue" />
        <StatCard label={t('dash.completion')} value={`${summary.planCompletion}%`}
          color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
        <StatCard label={t('dash.conversion')} value={`${summary.conversion}%`}
          sub={summary.conversionLabel}
          color={summary.conversion >= 20 ? 'green' : summary.conversion >= 10 ? 'yellow' : 'red'} />
        <StatCard label={t('dash.salesCount')} value={summary.totalSalesCount} />
        <StatCard label={t('dash.avgCheck')} value={`₸ ${fmt(summary.avgCheck)}`} />
      </div>

      <ProgressBar value={summary.planCompletion} label={t('dash.planCompletion')} />

      {/* ── Block 2: Funnel + Marketing ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funnel */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">{t('dash.funnel.title')}</h3>
          {hasFunnel ? (
            <>
              <div className="flex items-start gap-1 overflow-x-auto pb-2 flex-nowrap">
                <FunnelStep label={t('dash.funnel.leadsReceived')} value={summary.totalLiderLeads} color="text-blue-600" />
                <FunnelArrow pctVal={leadsToQual} />
                <FunnelStep label={t('dash.rop.funnelStepQual')} value={summary.totalQualifiedLeads}
                  sub={`${leadsToQual}%`} color="text-purple-600" />
                {summary.totalMeetingsScheduled > 0 && (
                  <>
                    <FunnelArrow pctVal={qualToScheduled} />
                    <FunnelStep label={t('dash.funnel.scheduled')} value={summary.totalMeetingsScheduled} color="text-orange-500" />
                    <FunnelArrow pctVal={scheduledToAtt} />
                    <FunnelStep label={t('dash.funnel.attended')} value={summary.totalMeetingsAttended}
                      sub={`${scheduledToAtt}%`} color="text-orange-600" />
                  </>
                )}
                <FunnelArrow pctVal={summary.totalMeetingsAttended > 0 ? attToSale : leadsToSale} />
                <FunnelStep label={t('dash.funnel.sales')} value={summary.totalSalesCount}
                  sub={`₸ ${fmt(summary.totalSalesAmount)}`} color="text-green-600" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: t('dash.funnel.leadsQual'), val: leadsToQual },
                  { label: t('dash.funnel.qualMeet'), val: qualToScheduled },
                  { label: t('dash.funnel.meetSales'), val: attToSale },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-2">
                    <div className={`text-base font-bold ${item.val >= 50 ? 'text-green-600' : item.val >= 25 ? 'text-amber-500' : 'text-red-500'}`}>
                      {item.val}%
                    </div>
                    <div className="text-[11px] text-gray-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 py-6 text-center">{t('dash.funnel.noData')}</p>
          )}
        </div>

        {/* Marketing */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            {t('dash.rop.marketingSection')}
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('dash.marketing.leadsPlan')}</span>
              <span className="font-medium">{fmt(summary.leadsplan)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('dash.marketing.leadsFact')}</span>
              <span className={`font-bold ${summary.marketingLeads >= summary.leadsplan && summary.leadsplan > 0 ? 'text-green-600' : 'text-blue-600'}`}>
                {fmt(summary.marketingLeads)}
              </span>
            </div>
            {leadDeficit > 0 && (
              <div className="text-xs text-red-500 font-medium">−{fmt(leadDeficit)} {t('dash.marketing.behind')}</div>
            )}
            <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
              <span className="text-gray-500">{t('dash.marketing.budgetPlan')}</span>
              <span className="font-medium">₸ {fmt(summary.budgetPlan)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('dash.marketing.budgetFact')}</span>
              <span className="font-medium">₸ {fmt(summary.totalBudget)}</span>
            </div>
            {summary.leadCost > 0 && (
              <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                <span className="text-gray-500">{t('dash.rop.leadCostLabel')}</span>
                <span className="font-bold text-gray-800">₸ {fmt(summary.leadCost)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Block 3: Daily sales chart (clean single-axis) ── */}
      {dailyChart?.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{t('dash.chart.title')}</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Всего: <span className="font-bold text-gray-800">₸ {fmt(summary.totalSalesAmount)}</span></span>
              <span>{summary.totalSalesCount} сделок</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${Math.round(v / 1000000)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="amount" name="amount" radius={[4, 4, 0, 0]}>
                {dailyChart.map((entry: any, idx: number) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={entry.amount >= maxAmount * 0.8 ? '#3b82f6' : entry.amount >= maxAmount * 0.4 ? '#60a5fa' : '#bfdbfe'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Block 4: Closer rating with expandable rows ── */}
      {managerRating?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            {t('dash.closerRating.title')}
          </h3>
          <p className="text-xs text-gray-400 mb-4">{t('dash.closerRating.subtitle')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium w-6"></th>
                  <th className="pb-2 font-medium w-6">#</th>
                  <th className="pb-2 font-medium">{t('dash.table.manager')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.plan')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.fact')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.completion')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.deals')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.avgCheck')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.conversion')}</th>
                </tr>
              </thead>
              <tbody>
                {managerRating.map((m: any, i: number) => {
                  const isExpanded = expandedManager === m.id
                  return (
                    <>
                      <tr
                        key={m.id}
                        className={`border-b border-gray-50 cursor-pointer hover:bg-blue-50 transition-colors ${isExpanded ? 'bg-blue-50' : ''}`}
                        onClick={() => setExpandedManager(isExpanded ? null : m.id)}
                      >
                        <td className="py-2.5 text-gray-400">
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        </td>
                        <td className="py-2.5 text-gray-400 font-medium">{i + 1}</td>
                        <td className="py-2.5 font-medium text-gray-900">{m.name}</td>
                        <td className="py-2.5 text-right text-gray-500">₸ {fmt(m.plan)}</td>
                        <td className="py-2.5 text-right font-bold text-blue-600">₸ {fmt(m.salesAmount)}</td>
                        <td className="py-2.5 text-right">
                          <span className={`font-bold ${m.completion >= 75 ? 'text-green-600' : m.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {m.plan > 0 ? `${m.completion}%` : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-medium">{m.salesCount}</td>
                        <td className="py-2.5 text-right font-medium">{m.avgCheck > 0 ? `₸ ${fmt(m.avgCheck)}` : '—'}</td>
                        <td className="py-2.5 text-right text-gray-500">{m.conversion > 0 ? `${m.conversion}%` : '—'}</td>
                      </tr>
                      {isExpanded && <ManagerSalesDetail key={`${m.id}-detail`} m={m} />}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Block 5: Lider rating ── */}
      {liderRating?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600" />
            {t('dash.liderRating.title')}
          </h3>
          <p className="text-xs text-gray-400 mb-4">{t('dash.liderRating.subtitle')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium w-6">#</th>
                  <th className="pb-2 font-medium">{t('dash.table.lider')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.leadsCol')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.qualified')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.pctQual')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.scheduledCol')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.attended')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.attendance')}</th>
                </tr>
              </thead>
              <tbody>
                {liderRating.map((m: any, i: number) => {
                  const showRate = pct(m.meetingsAttended, m.meetingsScheduled)
                  return (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 text-gray-400 font-medium">{i + 1}</td>
                      <td className="py-2.5 font-medium text-gray-900">{m.name}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(m.leads)}</td>
                      <td className="py-2.5 text-right font-medium">{fmt(m.qualifiedLeads)}</td>
                      <td className="py-2.5 text-right text-gray-500">{m.qualRate}%</td>
                      <td className="py-2.5 text-right font-bold text-blue-600">{fmt(m.meetingsScheduled)}</td>
                      <td className="py-2.5 text-right">{fmt(m.meetingsAttended)}</td>
                      <td className="py-2.5 text-right">
                        <span className={showRate >= 70 ? 'text-green-600 font-medium' : showRate >= 40 ? 'text-amber-500' : 'text-red-500'}>
                          {m.meetingsScheduled > 0 ? `${showRate}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AIInsights data={summary} managerRating={managerRating} period={periodState.period} />
    </div>
  )
}
