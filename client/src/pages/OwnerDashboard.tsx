import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronLeft, ChevronRight, ArrowRight, TrendingUp, Users } from 'lucide-react'
import { useT } from '../i18n'

function fmt(n: number) { return n.toLocaleString('ru-RU') }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0 }

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

function FunnelStep({ label, value, sub, color, dimmed }: {
  label: string; value: number; sub?: string; color: string; dimmed?: boolean
}) {
  return (
    <div className={`flex-1 min-w-[80px] ${dimmed ? 'opacity-60' : ''}`}>
      <div className="text-xs text-gray-500 mb-1 leading-tight">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{fmt(value)}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function OwnerDashboard() {
  const { t } = useT()
  const periodState = usePeriodStore()
  const [monthOffset, setMonthOffset] = useState(0)

  const queryParams = periodState.period === 'month'
    ? (() => { const r = getMonthRange(monthOffset); return `from=${r.from}&to=${r.to}` })()
    : buildPeriodParams(periodState)

  const queryKey = periodState.period === 'custom'
    ? ['dashboard-owner', 'custom', periodState.customFrom, periodState.customTo]
    : ['dashboard-owner', periodState.period, monthOffset]

  const { data, isLoading } = useQuery({
    queryKey,
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

  const leadDeficit = summary.leadsplan > 0 ? summary.leadsplan - summary.marketingLeads : 0
  const hasFunnel = summary.totalLiderLeads > 0 || summary.totalQualifiedLeads > 0

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

      {/* ── Block 2: Funnel (Lider → Sale) + Marketing side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funnel */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">{t('dash.funnel.title')}</h3>
          {hasFunnel ? (
            <>
              <div className="flex items-start gap-1 overflow-x-auto pb-2 flex-nowrap">
                <FunnelStep label="Лидов получено" value={summary.totalLiderLeads} color="text-blue-600" />
                <FunnelArrow pctVal={leadsToQual} />
                <FunnelStep label="Квалифицировано" value={summary.totalQualifiedLeads}
                  sub={`${leadsToQual}% от лидов`} color="text-purple-600" />
                {summary.totalMeetingsScheduled > 0 && (
                  <>
                    <FunnelArrow pctVal={qualToScheduled} />
                    <FunnelStep label="Записано" value={summary.totalMeetingsScheduled}
                      color="text-orange-500" />
                    <FunnelArrow pctVal={scheduledToAtt} />
                    <FunnelStep label="Пришло" value={summary.totalMeetingsAttended}
                      sub={`${scheduledToAtt}% явка`} color="text-orange-600" />
                  </>
                )}
                <FunnelArrow pctVal={summary.totalMeetingsAttended > 0 ? attToSale : leadsToSale} />
                <FunnelStep label="Продажи" value={summary.totalSalesCount}
                  sub={`₸ ${fmt(summary.totalSalesAmount)}`} color="text-green-600" />
              </div>
              {/* Conversion summary */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Лиды → квалиф.', val: leadsToQual },
                  { label: 'Квалиф. → встречи', val: qualToScheduled },
                  { label: 'Встречи → продажи', val: attToSale },
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
            <p className="text-sm text-gray-400 py-6 text-center">Нет данных от лидорубов за этот период</p>
          )}
        </div>

        {/* Marketing */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            Маркетинг
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Лидов план</span>
              <span className="font-medium">{fmt(summary.leadsplan)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Лидов факт</span>
              <span className={`font-bold ${summary.marketingLeads >= summary.leadsplan && summary.leadsplan > 0 ? 'text-green-600' : 'text-blue-600'}`}>
                {fmt(summary.marketingLeads)}
              </span>
            </div>
            {leadDeficit > 0 && (
              <div className="text-xs text-red-500 font-medium">−{fmt(leadDeficit)} отстаём</div>
            )}
            <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
              <span className="text-gray-500">Бюджет план</span>
              <span className="font-medium">₸ {fmt(summary.budgetPlan)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Бюджет факт</span>
              <span className="font-medium">₸ {fmt(summary.totalBudget)}</span>
            </div>
            {summary.leadCost > 0 && (
              <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                <span className="text-gray-500">Стоимость лида</span>
                <span className="font-bold text-gray-800">₸ {fmt(summary.leadCost)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Block 3: Daily sales chart ── */}
      {dailyChart?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">{t('dash.chart.title')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyChart}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} yAxisId="amount" orientation="left" tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <YAxis tick={{ fontSize: 11 }} yAxisId="sales" orientation="right" />
              <Tooltip
                formatter={(v: number, name: string) =>
                  name === 'amount' ? [`₸ ${fmt(v)}`, 'Сумма'] : [v, 'Продаж']
                }
              />
              <Bar dataKey="amount" name="amount" yAxisId="amount" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="sales"  name="sales"  yAxisId="sales"  fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Block 4: Closer rating ── */}
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
                  <th className="pb-2 font-medium w-6">#</th>
                  <th className="pb-2 font-medium">{t('dash.table.manager')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.plan')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.fact')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.completion')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.deals')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.conversion')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.avgCheck')}</th>
                </tr>
              </thead>
              <tbody>
                {managerRating.map((m: any, i: number) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 font-medium text-gray-900">{m.name}</td>
                    <td className="py-2.5 text-right text-gray-500">₸ {fmt(m.plan)}</td>
                    <td className="py-2.5 text-right font-medium">₸ {fmt(m.salesAmount)}</td>
                    <td className="py-2.5 text-right">
                      <span className={`font-bold ${m.completion >= 75 ? 'text-green-600' : m.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {m.plan > 0 ? `${m.completion}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">{m.salesCount}</td>
                    <td className="py-2.5 text-right">{m.conversion > 0 ? `${m.conversion}%` : '—'}</td>
                    <td className="py-2.5 text-right">{m.avgCheck > 0 ? `₸ ${fmt(m.avgCheck)}` : '—'}</td>
                  </tr>
                ))}
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
                  <th className="pb-2 font-medium text-right">Лидов</th>
                  <th className="pb-2 font-medium text-right">Квал.</th>
                  <th className="pb-2 font-medium text-right">% квал.</th>
                  <th className="pb-2 font-medium text-right">Записано</th>
                  <th className="pb-2 font-medium text-right">Пришло</th>
                  <th className="pb-2 font-medium text-right">Явка %</th>
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
