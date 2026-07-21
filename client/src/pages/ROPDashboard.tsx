import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import { useT } from '../i18n'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('ru') }

const PAYMENT_TYPE_LABEL: Record<string, string> = { new_sale: 'Новая', additional: 'Доплата' }
const PAYMENT_METHOD_LABEL: Record<string, string> = { cash: 'Нал', card: 'Безнал', credit: 'Кредит', installment: 'Рассрочка' }

// Visual funnel component
function Funnel({ steps }: { steps: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...steps.map(s => s.value), 1)
  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const pct = Math.round((step.value / max) * 100)
        const conv = i > 0 && steps[i - 1].value > 0
          ? Math.round((step.value / steps[i - 1].value) * 100) : null
        return (
          <div key={step.label}>
            {conv !== null && (
              <div className="flex items-center gap-1 pl-1 py-0.5">
                <div className="w-px h-3 bg-gray-300 ml-1" />
                <span className={`text-[11px] font-medium ${conv >= 50 ? 'text-green-600' : conv >= 30 ? 'text-amber-500' : 'text-red-500'}`}>
                  ↓ {conv}%
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-[140px] shrink-0 leading-tight">{step.label}</span>
              <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                <div
                  className={`h-6 rounded transition-all ${step.color || 'bg-blue-500'}`}
                  style={{ width: `${pct}%`, minWidth: step.value > 0 ? '2%' : '0' }}
                />
              </div>
              <span className="text-sm font-bold text-gray-800 w-8 text-right">{step.value}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Expanded manager row — shows period sales and today's report
function ManagerDetail({ m }: { m: any }) {
  const { t } = useT()
  // m.sales = period sales (matches selected period); m.todaySales = today only (for status)
  const periodSales: any[] = m.sales || []
  const periodTotal = periodSales.reduce((s: number, x: any) => s + Number(x.amount), 0)
  const report = m.todayReport

  return (
    <tr>
      <td colSpan={12} className="pb-3 px-0">
        <div className="ml-6 mr-2 bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
          {/* Period sales */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t('dash.periodSales')}
              {periodSales.length > 0 && (
                <span className="text-blue-600 font-bold ml-1">· {periodSales.length} · ₸ {fmt(periodTotal)}</span>
              )}
            </p>
            {periodSales.length === 0 ? (
              <p className="text-xs text-gray-400">{t('dash.noSalesPeriod')}</p>
            ) : (
              <div className="space-y-1.5">
                {periodSales.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                    <span className="font-bold text-gray-900 whitespace-nowrap min-w-[90px]">₸ {fmt(Number(s.amount))}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${s.paymentType === 'new_sale' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {PAYMENT_TYPE_LABEL[s.paymentType] || s.paymentType}
                    </span>
                    {s.paymentMethod && <span className="text-gray-500 shrink-0">{PAYMENT_METHOD_LABEL[s.paymentMethod] || s.paymentMethod}</span>}
                    {s.bank && <span className="text-gray-400 shrink-0">{s.bank}</span>}
                    {s.months && <span className="text-gray-400 shrink-0">{s.months} мес.</span>}
                    {s.date && <span className="text-gray-400 shrink-0">{s.date}</span>}
                    {s.crmLink && (
                      <a href={s.crmLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline shrink-0">
                        <ExternalLink className="w-3 h-3" /> CRM
                      </a>
                    )}
                    {s.comment && <span className="text-gray-400 italic truncate">💬 {s.comment}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's report stats */}
          {report ? (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('dash.rop.dayStats')}</p>
              <div className="flex gap-6 text-xs flex-wrap">
                <span className="text-gray-500">{t('dash.rop.clientsLabel')}: <span className="font-bold text-gray-900">{report.clientsReceived || 0}</span></span>
                <span className="text-gray-500">{t('dash.rop.consultationsLabel')}: <span className="font-bold text-gray-900">{report.consultations || 0}</span></span>
                <span className="text-gray-500">{t('dash.rop.refusalsLabel')}: <span className="font-bold text-gray-900">{report.refusals || 0}</span></span>
                {report.comment && <span className="text-gray-400 italic">💬 {report.comment}</span>}
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400">{t('dash.rop.noReport')}</p>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// Lider expanded row
function LiderDetail({ m }: { m: any }) {
  const { t } = useT()
  const report = m.todayReport
  if (!report) return (
    <tr>
      <td colSpan={12} className="pb-3">
        <div className="ml-6 mr-2 bg-gray-50 rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-400">{t('dash.rop.noReport')}</p>
        </div>
      </td>
    </tr>
  )
  return (
    <tr>
      <td colSpan={12} className="pb-3">
        <div className="ml-6 mr-2 bg-gray-50 rounded-xl border border-gray-100 p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('dash.rop.dayStats')}</p>
          <div className="flex gap-6 text-xs flex-wrap">
            <span className="text-gray-500">{t('dash.funnel.leadsReceived')}: <span className="font-bold text-gray-900">{report.leadsReceived || report.leads || 0}</span></span>
            <span className="text-gray-500">{t('dash.rop.funnelStepQual')}: <span className="font-bold text-gray-900">{report.qualifiedLeads || 0}</span></span>
            <span className="text-gray-500">{t('dash.funnel.scheduled')}: <span className="font-bold text-gray-900">{report.meetingsScheduled || 0}</span></span>
            <span className="text-gray-500">{t('dash.funnel.attended')}: <span className="font-bold text-gray-900">{report.meetingsAttended || 0}</span></span>
            {report.comment && <span className="text-gray-400 italic">💬 {report.comment}</span>}
          </div>
        </div>
      </td>
    </tr>
  )
}

export default function ROPDashboard() {
  const { t } = useT()
  const periodState = usePeriodStore()
  const { period } = periodState
  const params = buildPeriodParams(periodState)
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-rop', params],
    queryFn: () => api.get(`/dashboard/rop?${params}`).then(r => r.data),
    refetchInterval: 60000, // refresh every minute — keep pulse live
  })

  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) => setExpandedManagers(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const STATUS = {
    green:  { dot: 'bg-green-400',  bg: '',              label: t('tracking.status.ok') },
    yellow: { dot: 'bg-yellow-400', bg: 'bg-yellow-50',  label: t('tracking.status.behind') },
    red:    { dot: 'bg-red-500',    bg: 'bg-red-50',     label: t('tracking.status.noReport') },
  }

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>
  if (!data) return null

  const { summary, funnel, marketing, managerRating, liderRating } = data

  const funnelSteps = [
    { label: t('dash.rop.funnelStepLeads'), value: funnel.leadsReceived,    color: 'bg-purple-400' },
    { label: t('dash.rop.funnelStepQual'),  value: funnel.qualifiedLeads,   color: 'bg-purple-500' },
    { label: t('dash.rop.funnelStepSched'), value: funnel.meetingsScheduled,color: 'bg-blue-400' },
    { label: t('dash.rop.funnelStepAtt'),   value: funnel.meetingsAttended, color: 'bg-blue-500' },
    { label: t('dash.rop.funnelStepSales'), value: funnel.salesCount,       color: 'bg-green-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dash.rop.title')}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{t('dash.rop.subtitle')}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <StatCard label={t('dash.rop.salesPlan')} value={`₸ ${fmt(summary.salesPlan)}`} />
        <StatCard label={t('dash.rop.salesFact')} value={`₸ ${fmt(summary.salesAmount)}`} color="blue" />
        <StatCard label={t('dash.completion')} value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
        <StatCard label={t('dash.rop.deals')} value={summary.salesCount} />
        <StatCard label={t('dash.conversion')} value={`${summary.conversion}%`} sub={t('dash.rop.conversionSub')} />
        <StatCard label={t('dash.avgCheck')} value={`₸ ${fmt(summary.avgCheck)}`} />
        <StatCard label={t('dash.consultations')} value={summary.totalConsultations ?? 0} />
        <StatCard label={t('dash.refusals')} value={summary.totalRefusals ?? 0} color="red" />
        <StatCard label={t('dash.inWork')} value={summary.totalInWork ?? 0} color="yellow" />
      </div>

      <ProgressBar value={summary.planCompletion} label={t('dash.rop.planCompletion')} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Funnel */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">{t('dash.funnel.title')}</h3>
          <Funnel steps={funnelSteps} />
        </div>

        {/* Marketing */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">{t('dash.rop.marketingSection')}</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">{t('dash.rop.leadsplanLabel')}</span><span className="font-medium">{marketing.leadsplan}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('dash.rop.leadsFactLabel')}</span><span className="font-medium text-blue-600">{marketing.totalLeads}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('dash.rop.qualifiedLabel')}</span><span className="font-medium">{marketing.qualifiedLeads}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-500">{t('dash.rop.leadCostLabel')}</span><span className="font-medium">₸ {fmt(marketing.leadCost)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('dash.rop.budgetLabel')}</span><span className="font-medium">₸ {fmt(marketing.totalBudget)}</span></div>
          </div>
        </div>
      </div>

      {/* ── CLOSER RATING — expandable ── */}
      {managerRating?.length > 0 && (
        <div className="card">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-0.5">{t('dash.closerRating.title')}</h3>
              <p className="text-xs text-gray-400">{t('dash.rop.closerRatingNote')} · {t('dash.clickToDetail')}</p>
            </div>
            {/* Status legend */}
            <div className="flex items-center gap-4 shrink-0">
              {Object.entries(STATUS).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  {cfg.label}
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium w-6" />
                  <th className="pb-2 font-medium w-6" />
                  <th className="pb-2 font-medium">{t('dash.table.manager')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.plan')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.fact')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.completion')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.deals')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.avgCheck')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.conversion')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.consultations')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.refusals')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.inWork')}</th>
                </tr>
              </thead>
              <tbody>
                {managerRating.map((m: any) => {
                  const isOpen = expandedManagers.has(m.id)
                  return (
                    <>
                      <tr key={m.id}
                        className={`border-b border-gray-50 cursor-pointer hover:opacity-90 transition-colors ${STATUS[m.status as keyof typeof STATUS]?.bg}`}
                        onClick={() => toggleExpand(m.id)}>
                        <td className="py-3 pl-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${STATUS[m.status as keyof typeof STATUS]?.dot}`} />
                        </td>
                        <td className="py-3 text-gray-400">
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </td>
                        <td className="py-3 font-medium text-gray-900">
                          {m.name}
                          {m.todaySales?.length > 0 && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-medium">
                              +{m.todaySales.length} сд сегодня
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right text-gray-500">₸ {fmt(m.plan)}</td>
                        <td className="py-2.5 text-right font-medium">₸ {fmt(m.salesAmount)}</td>
                        <td className="py-2.5 text-right">
                          <span className={`font-bold ${m.completion >= 75 ? 'text-green-600' : m.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {m.completion}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right">{m.salesCount}</td>
                        <td className="py-2.5 text-right text-gray-500">{m.avgCheck > 0 ? `₸ ${fmt(m.avgCheck)}` : '—'}</td>
                        <td className="py-2.5 text-right">{m.conversion}%</td>
                        <td className="py-2.5 text-right">{m.consultations ?? 0}</td>
                        <td className="py-2.5 text-right text-red-500">{m.refusals ?? 0}</td>
                        <td className="py-2.5 text-right text-amber-600">{m.inWork ?? 0}</td>
                      </tr>
                      {isOpen && <ManagerDetail key={`detail-${m.id}`} m={m} />}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LIDER RATING — expandable ── */}
      {liderRating?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-1">{t('dash.liderRating.title')}</h3>
          <p className="text-xs text-gray-400 mb-4">{t('dash.rop.liderRatingNote')} · {t('dash.clickToDetail')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium w-6" />
                  <th className="pb-2 font-medium w-6" />
                  <th className="pb-2 font-medium">{t('dash.table.lider')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.scheduledCol')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.attendedCol')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.leadsCol')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.qualified')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.pctQual')}</th>
                </tr>
              </thead>
              <tbody>
                {liderRating.map((m: any) => {
                  const isOpen = expandedManagers.has(m.id)
                  return (
                    <>
                      <tr key={m.id}
                        className={`border-b border-gray-50 cursor-pointer hover:opacity-90 transition-colors ${STATUS[m.status as keyof typeof STATUS]?.bg}`}
                        onClick={() => toggleExpand(m.id)}>
                        <td className="py-3 pl-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${STATUS[m.status as keyof typeof STATUS]?.dot}`} />
                        </td>
                        <td className="py-3 text-gray-400">
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </td>
                        <td className="py-3 font-medium text-gray-900">{m.name}</td>
                        <td className="py-2.5 text-right font-medium">{m.meetingsScheduled.toLocaleString('ru-RU')}</td>
                        <td className="py-2.5 text-right">{m.meetingsAttended.toLocaleString('ru-RU')}</td>
                        <td className="py-2.5 text-right text-gray-500">{m.leads.toLocaleString('ru-RU')}</td>
                        <td className="py-2.5 text-right text-gray-500">{m.qualifiedLeads.toLocaleString('ru-RU')}</td>
                        <td className="py-2.5 text-right text-gray-400">{m.qualRate}%</td>
                      </tr>
                      {isOpen && <LiderDetail key={`lider-detail-${m.id}`} m={m} />}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AIInsights data={summary} managerRating={managerRating} funnel={funnel} period={period} />
    </div>
  )
}
