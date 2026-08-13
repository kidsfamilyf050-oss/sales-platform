import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import GatewayAnalytics from '../components/ui/GatewayAnalytics'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ChevronDown, ArrowRight, TrendingUp, Users, ExternalLink } from 'lucide-react'
import { useT } from '../i18n'
import { useAuthStore } from '../store/auth'
import { getSphereConfig } from '../config/sphereConfig'

function fmt(n: number) { return n.toLocaleString('ru-RU') }
function pct(a: number, b: number) {
  if (b === 0) return 0
  const v = (a / b) * 100
  return v > 0 && v < 1 ? Math.round(v * 10) / 10 : Math.round(v)
}

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
  const { t } = useT()
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  const newAmt = entry?.newAmount || 0
  const dojimAmt = entry?.dojimAmount || 0
  const total = newAmt + dojimAmt
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {newAmt > 0 && (
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0" />
          <span className="text-gray-500 text-xs">{t('dash.chart.newLabel')}:</span>
          <span className="text-blue-600 font-bold text-xs ml-auto">₸ {fmt(newAmt)}</span>
        </div>
      )}
      {dojimAmt > 0 && (
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 shrink-0" />
          <span className="text-gray-500 text-xs">{t('dash.chart.dojimLabel')}:</span>
          <span className="text-amber-600 font-bold text-xs ml-auto">₸ {fmt(dojimAmt)}</span>
        </div>
      )}
      {total > 0 && (newAmt > 0 && dojimAmt > 0) && (
        <div className="border-t border-gray-100 mt-1 pt-1 flex items-center gap-2">
          <span className="text-gray-500 text-xs">{t('dash.chart.totalLabel')}:</span>
          <span className="text-gray-800 font-bold text-xs ml-auto">₸ {fmt(total)}</span>
        </div>
      )}
      {entry?.sales > 0 && (
        <p className="text-gray-400 text-xs mt-1">{entry.sales} {t('dash.sale.dealsShort')}</p>
      )}
    </div>
  )
}

// Expandable sales detail for a manager
function ManagerSalesDetail({ m }: { m: any }) {
  const { t } = useT()
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set())
  const sales: any[] = m.sales || []
  const net = (s: any) => Number(s.netAmount ?? s.amount) || 0
  const periodTotal = sales.reduce((acc: number, s: any) => acc + net(s), 0)

  const toggleSale = (id: string) => setExpandedSales(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  return (
    <tr>
      <td colSpan={12} className="pb-3 px-0">
        <div className="ml-6 mr-2 bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {t('dash.periodSales')}
            {sales.length > 0 && (
              <span className="text-blue-600 font-bold ml-2">· {sales.length} · ₸ {fmt(periodTotal)}</span>
            )}
          </p>
          {sales.length === 0 ? (
            <p className="text-xs text-gray-400">{t('dash.noSalesPeriod')}</p>
          ) : (
            <div className="space-y-1">
              {sales.map((s: any) => {
                const netAmt = net(s)
                const grossAmt = Number(s.amount) || 0
                const hasDiscount = s.netAmount && s.netAmount !== s.amount
                const isOpen = expandedSales.has(s.id)
                return (
                  <div key={s.id} className={`rounded-lg border overflow-hidden ${s.isDojim ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                    <div
                      className="flex items-center gap-3 text-xs px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleSale(s.id)}
                    >
                      <ChevronDown className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                      <span className="font-bold text-gray-900 whitespace-nowrap min-w-[80px]">₸ {fmt(netAmt)}</span>
                      {s.isDojim && <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-700 shrink-0">ДОЖИМ</span>}
                      {hasDiscount && <span className="text-gray-400 line-through text-[11px]">₸ {fmt(grossAmt)}</span>}
                      <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${s.paymentType === 'new_sale' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {PAYMENT_TYPE_LABEL[s.paymentType] || s.paymentType}
                      </span>
                      {s.productName && (
                        <span className="px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700 shrink-0">
                          📦 {s.productName}
                        </span>
                      )}
                      {s.paymentMethod && <span className="text-gray-500 shrink-0">{PAYMENT_METHOD_LABEL[s.paymentMethod] || s.paymentMethod}</span>}
                      {s.date && <span className="text-gray-400 shrink-0">{s.date}</span>}
                      {s.crmLink && (
                        <a href={s.crmLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-blue-500 hover:underline shrink-0">
                          <ExternalLink className="w-3 h-3" /> CRM
                        </a>
                      )}
                    </div>
                    {isOpen && (
                      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                        <div className="flex justify-between"><span className="text-gray-500">{t('dash.sale.gross')}</span><span className="font-medium">₸ {fmt(grossAmt)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{t('dash.sale.netDeal')}</span><span className="font-bold text-green-700">₸ {fmt(netAmt)}</span></div>
                        {hasDiscount && <div className="flex justify-between"><span className="text-gray-500">{t('dash.sale.fee')}</span><span className="font-medium text-orange-600">{Math.round((1 - netAmt / grossAmt) * 100)}%</span></div>}
                        {s.productName && <div className="flex justify-between"><span className="text-gray-500">{t('dash.owner.productCol')}</span><span className="font-medium text-purple-700">📦 {s.productName}</span></div>}
                        {s.paymentMethod && <div className="flex justify-between"><span className="text-gray-500">{t('dash.sale.gateway')}</span><span className="font-medium">{PAYMENT_METHOD_LABEL[s.paymentMethod] || s.paymentMethod}</span></div>}
                        {s.bank && <div className="flex justify-between"><span className="text-gray-500">{t('dash.sale.bank')}</span><span className="font-medium">{s.bank}</span></div>}
                        {s.months && <div className="flex justify-between"><span className="text-gray-500">{t('dash.sale.months')}</span><span className="font-medium">{s.months} мес.</span></div>}
                        {s.comment && <div className="col-span-2 flex gap-2"><span className="text-gray-500">{t('dash.sale.comment')}</span><span className="text-gray-700 italic">{s.comment}</span></div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function OwnerDashboard() {
  const { t } = useT()
  const navigate = useNavigate()
  const periodState = usePeriodStore()
  const { monthOffset } = periodState
  const { user } = useAuthStore()
  const sc = getSphereConfig(user?.businessSphere)
  const [expandedManager, setExpandedManager] = useState<string | null>(null)

  // Build query params — uses global period + monthOffset from store
  const queryParams = buildPeriodParams(periodState)

  // Use queryParams string as key so React Query refetches whenever params change
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-owner', queryParams],
    queryFn: () => api.get(`/dashboard/owner?${queryParams}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>
  if (!data) return null

  const { summary, dailyChart, managerRating, liderRating, productStats = [], gatewayAnalytics = [], carryover } = data as any

  const STATUS = {
    green:  { dot: 'bg-green-400',  bg: '',             label: t('dash.status.ok') },
    yellow: { dot: 'bg-yellow-400', bg: 'bg-yellow-50', label: t('dash.status.behind') },
    red:    { dot: 'bg-red-500',    bg: 'bg-red-50',    label: t('dash.status.noSales') },
  }

  // Funnel conversions — using LIDER data as source of truth
  const leadsToQual     = pct(summary.totalQualifiedLeads, summary.totalLiderLeads)
  const qualToScheduled = pct(summary.totalMeetingsScheduled, summary.totalQualifiedLeads)
  const scheduledToAtt  = pct(summary.totalMeetingsAttended, summary.totalMeetingsScheduled)
  const factSalesCount  = summary.factSalesCount ?? summary.totalSalesCount
  const attToSale       = pct(factSalesCount, summary.totalMeetingsAttended)
  const leadsToSale     = pct(factSalesCount, summary.totalLiderLeads)
  const hasFunnel       = summary.totalLiderLeads > 0 || summary.totalQualifiedLeads > 0
  const leadDeficit     = summary.leadsplan > 0 ? summary.leadsplan - summary.marketingLeads : 0

  return (
    <div className="space-y-6 px-4 md:px-6 py-2 md:py-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dash.owner.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('dash.owner.subtitle')}</p>
        </div>
        {periodState.period === 'month' && (
          <p className="text-sm text-gray-400 self-center">
            {t(`month.${getMonthRange(monthOffset).monthNum}` as any)} {getMonthRange(monthOffset).year}
          </p>
        )}
      </div>

      {/* ── Block 1: Sales KPIs — Row 1 (4): Finance ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-5">
        <StatCard label={t('dash.salesPlan')} value={`₸ ${fmt(summary.salesPlan)}`} />
        <StatCard label={t('dash.salesFact')} value={`₸ ${fmt(summary.totalNetSales ?? summary.totalSalesAmount)}`} color="blue" />
        <div onClick={() => navigate('/owner/leads?tab=new-sales')} className="h-full cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:ring-2 hover:ring-blue-300 rounded-xl transition-all duration-150">
          <StatCard label={t('dash.owner.newSales')} value={`₸ ${fmt(summary.factNetSales ?? 0)}`} color="blue"
            sub={`${summary.factSalesCount ?? 0} ${t('dash.sale.dealsShort')}`} />
        </div>
        <div onClick={() => navigate('/owner/leads?tab=refunds')} className="h-full cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:ring-2 hover:ring-red-300 rounded-xl transition-all duration-150">
          <StatCard label={t('dash.owner.refunds')} value={`${summary.totalRefundCount ?? 0} шт.`}
            color={summary.totalRefundCount > 0 ? 'red' : 'default'}
            sub={summary.totalRefundCount > 0 ? `−₸ ${fmt(summary.totalRefundAmount)}` : undefined} />
        </div>
      </div>
      {/* ── Row 2 (4): Performance ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-5">
        <StatCard label={t('dash.completion')} value={summary.planCompletion != null ? `${summary.planCompletion}%` : '—'}
          color={summary.planCompletion == null ? 'default' : summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
        <StatCard label={t('dash.conversion')} value={`${summary.conversion}%`}
          sub={summary.totalMeetingsAttended > 0 ? t('dash.owner.conversionSubMeetings') : t('dash.owner.conversionSubClients')}
          color={summary.conversion >= 20 ? 'green' : summary.conversion >= 10 ? 'yellow' : 'red'} />
        <div onClick={() => navigate('/owner/leads?tab=all-sales')} className="h-full cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:ring-2 hover:ring-blue-200 rounded-xl transition-all duration-150">
          <StatCard label={t('dash.salesCount')} value={summary.totalSalesCount ?? 0} />
        </div>
        <StatCard label={t('dash.owner.avgCheckFact')} value={`₸ ${fmt(summary.avgCheck ?? 0)}`} />
      </div>
      {/* ── Row 3 (3): Additional metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
        <div onClick={() => navigate('/planned-payments')} className="h-full cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:ring-2 hover:ring-purple-300 rounded-xl transition-all duration-150">
          <StatCard label={t('dash.plannedPayments')} value={`₸ ${fmt(summary.plannedPaymentsAmount ?? 0)}`} color="purple"
            sub={`${summary.plannedPaymentsCount ?? 0} ${t('dash.sale.dealsShort')}`} />
        </div>
        <div onClick={() => navigate('/owner/leads?tab=consultations')} className="h-full cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:ring-2 hover:ring-blue-200 rounded-xl transition-all duration-150">
          <StatCard label={sc.tracking.consultations} value={summary.totalConsultations ?? 0} />
        </div>
        <div onClick={() => navigate('/owner/leads?tab=refusals')} className="h-full cursor-pointer group">
          <div className="h-full card text-center flex flex-col items-center justify-center transition-all duration-150 group-hover:shadow-md group-hover:border-red-200 group-hover:bg-red-50/40 border border-transparent">
            <p className="text-xs font-medium uppercase tracking-wide mb-1 text-gray-400 group-hover:text-red-500 transition-colors">{t('dash.refusals')}</p>
            <p className={`text-2xl font-bold ${(summary.totalRefusals ?? 0) > 0 ? 'text-red-500' : 'text-gray-900'}`}>{summary.totalRefusals ?? 0}</p>
            {summary.totalRefusalsAmount > 0 && <p className="text-xs text-red-400 font-medium mt-0.5">−₸ {fmt(summary.totalRefusalsAmount)}</p>}
            <p className="text-xs text-gray-300 group-hover:text-red-400 mt-1 transition-colors">нажмите →</p>
          </div>
        </div>
      </div>

      {/* НДС */}
      {summary.isVatPayer && summary.vatAmount != null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-0.5">НДС (16%)</p>
            <p className="text-sm text-emerald-600">Включён в стоимость продаж</p>
          </div>
          <div className="ml-auto flex items-center gap-6 shrink-0">
            <div className="text-center">
              <p className="text-xs text-emerald-500 mb-0.5">Сумма НДС</p>
              <p className="text-2xl font-bold text-emerald-800">₸ {fmt(summary.vatAmount)}</p>
            </div>
          </div>
        </div>
      )}

      {summary.planCompletion != null && <ProgressBar value={summary.planCompletion} label={t('dash.planCompletion')} />}

      {/* Carryover sales (дожим) */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
        <div>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">{t('dash.carryover.title')}</p>
          <p className="text-sm text-amber-600">{t('dash.carryover.subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* В работе — click to see IN_WORK leads */}
          <div
            className="text-center px-4 py-2 rounded-xl cursor-pointer hover:bg-amber-100 hover:shadow-sm transition-all"
            onClick={() => navigate('/owner/leads?tab=inwork')}
            title="Список лидов в работе"
          >
            <p className="text-2xl font-bold text-amber-800">{summary.totalInWork ?? 0}</p>
            <p className="text-xs text-amber-500">{t('dash.inWork')}</p>
            <p className="text-[10px] text-amber-400 mt-0.5">нажмите →</p>
          </div>
          <div className="w-px h-10 bg-amber-200" />
          {/* Закрытые дожимы — click to see dojim SALES */}
          <div
            className="text-center px-4 py-2 rounded-xl cursor-pointer hover:bg-amber-100 hover:shadow-sm transition-all"
            onClick={() => navigate('/owner/leads?tab=dojim-sales')}
            title="Список закрытых дожимов"
          >
            <p className="text-2xl font-bold text-amber-800">{carryover?.count ?? 0}</p>
            <p className="text-xs text-amber-500">{t('dash.carryover.deals')}</p>
            <p className="text-[10px] text-amber-400 mt-0.5">нажмите →</p>
          </div>
          <div
            className="text-center px-4 py-2 rounded-xl cursor-pointer hover:bg-amber-100 hover:shadow-sm transition-all"
            onClick={() => navigate('/owner/leads?tab=dojim-sales')}
            title="Список закрытых дожимов"
          >
            <p className="text-2xl font-bold text-amber-800">₸ {fmt(carryover?.revenue ?? 0)}</p>
            <p className="text-xs text-amber-500">{t('dash.carryover.revenue')}</p>
            <p className="text-[10px] text-amber-400 mt-0.5">нажмите →</p>
          </div>
        </div>
      </div>

      {/* Installments (Доплаты) block */}
      {(summary.installmentCount ?? 0) > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-4">
          <div>
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-0.5">{t('dash.installments.title')}</p>
            <p className="text-sm text-purple-500">{t('dash.installments.subtitle')}</p>
          </div>
          <div className="ml-auto flex items-center gap-6 shrink-0">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-800">{summary.installmentCount}</p>
              <p className="text-xs text-purple-400">{t('dash.installments.payments')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-800">₸ {fmt(summary.installmentRevenue ?? 0)}</p>
              <p className="text-xs text-purple-400">{t('dash.installments.budget')}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Block 2: Funnel + Marketing ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funnel */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">{t('dash.funnel.title')}</h3>
          {hasFunnel ? (
            <>
              <div className="flex items-start gap-1 overflow-x-auto pb-2 flex-nowrap">
                <FunnelStep label={sc.funnel.leads} value={summary.totalLiderLeads} color="text-blue-600" />
                <FunnelArrow pctVal={leadsToQual} />
                <FunnelStep label={sc.funnel.qualified} value={summary.totalQualifiedLeads}
                  color="text-purple-600" />
                {summary.totalMeetingsScheduled > 0 && (
                  <>
                    <FunnelArrow pctVal={qualToScheduled} />
                    <FunnelStep label={sc.funnel.meetingsScheduled} value={summary.totalMeetingsScheduled} color="text-orange-500" />
                    <FunnelArrow pctVal={scheduledToAtt} />
                    <FunnelStep label={sc.funnel.meetingsAttended} value={summary.totalMeetingsAttended}
                      color="text-orange-600" />
                  </>
                )}
                <FunnelArrow pctVal={summary.totalMeetingsAttended > 0 ? attToSale : leadsToSale} />
                <FunnelStep label={sc.funnel.sales} value={factSalesCount}
                  sub={`₸ ${fmt(summary.factNetSales ?? summary.factSalesAmount ?? summary.totalSalesAmount)}`} color="text-green-600" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: t('dash.funnel.leadsQual'), val: leadsToQual },
                  { label: `Квалиф. → ${sc.tracking.meetingsScheduled.toLowerCase()}`, val: qualToScheduled },
                  { label: `→ ${sc.funnel.sales.toLowerCase()}`, val: attToSale },
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

      {/* ── Block 3: Daily sales chart — new (blue) vs дожим (yellow) ── */}
      {dailyChart?.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">{t('dash.chart.title')}</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span>{t('dash.chart.newLabel')}: <span className="font-bold text-gray-800">₸ {fmt(summary.factNetSales ?? summary.factSalesAmount ?? 0)}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                <span>{t('dash.chart.dojimLabel')}: <span className="font-bold text-gray-800">₸ {fmt(carryover?.revenue ?? 0)}</span></span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={28} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => v ? `${v.split('-')[2]}.${v.split('-')[1]}` : ''}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false} tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${Math.round(v / 1000000)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="newAmount" name="Новые" stackId="a" fill="#3b82f6" />
              <Bar dataKey="dojimAmount" name="Дожим" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Block 4: Closer rating with expandable rows ── */}
      {managerRating?.length > 0 && (
        <div className="card">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-0.5 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                {t('dash.closerRating.title')}
              </h3>
              <p className="text-xs text-gray-400">{t('dash.closerRating.subtitle')}</p>
            </div>
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
                  <th className="pb-2 font-medium w-6"></th>
                  <th className="pb-2 font-medium w-6">#</th>
                  <th className="pb-2 font-medium">{t('dash.table.manager')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.plan')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.fact')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.completion')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.deals')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.carryover.title')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.avgCheck')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.conversion')}</th>
                  <th className="pb-2 font-medium text-right">{sc.tracking.consultations}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.refusals')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.inWork')}</th>
                </tr>
              </thead>
              <tbody>
                {managerRating.map((m: any, i: number) => {
                  const isExpanded = expandedManager === m.id
                  return (
                    <>
                      <tr
                        key={m.id}
                        className={`border-b border-gray-50 cursor-pointer hover:opacity-90 transition-colors ${isExpanded ? 'bg-blue-50' : STATUS[m.status as keyof typeof STATUS]?.bg || ''}`}
                        onClick={() => setExpandedManager(isExpanded ? null : m.id)}
                      >
                        <td className="py-2.5 pl-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${STATUS[m.status as keyof typeof STATUS]?.dot || 'bg-gray-300'}`} />
                        </td>
                        <td className="py-2.5 text-gray-400 font-medium">{i + 1}</td>
                        <td className="py-2.5 font-medium text-gray-900">{m.name}</td>
                        <td className="py-2.5 text-right text-gray-500">₸ {fmt(m.plan)}</td>
                        <td className="py-2.5 text-right font-bold text-blue-600">₸ {fmt(Math.max(0, m.salesAmount - (m.carryover?.revenue ?? 0)))}</td>
                        <td className="py-2.5 text-right">
                          <span className={`font-bold ${m.completion >= 75 ? 'text-green-600' : m.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {m.plan > 0 ? `${m.completion}%` : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-medium">{Math.max(0, m.salesCount - (m.carryover?.count ?? 0))}</td>
                        <td className="py-2.5 text-right text-amber-700 font-medium">
                          {m.carryover?.count > 0 ? m.carryover.count : '—'}
                        </td>
                        <td className="py-2.5 text-right font-medium">{(() => { const factCnt = Math.max(0, m.salesCount - (m.carryover?.count ?? 0)); const factAmt = Math.max(0, m.salesAmount - (m.carryover?.revenue ?? 0)); return factCnt > 0 ? `₸ ${fmt(Math.round(factAmt / factCnt))}` : '—' })()}</td>
                        <td className="py-2.5 text-right text-gray-500">{m.conversion > 0 ? `${m.conversion}%` : '—'}</td>
                        <td className="py-2.5 text-right">{m.consultations ?? 0}</td>
                        <td className="py-2.5 text-right text-red-500">{m.refusals ?? 0}</td>
                        <td className="py-2.5 text-right text-amber-600">{m.inWork ?? 0}</td>
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
      {liderRating && (
        <div className="card">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-0.5 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                {t('dash.liderRating.title')}
              </h3>
              <p className="text-xs text-gray-400">{t('dash.liderRating.subtitle')}</p>
            </div>
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
                  <th className="pb-2 font-medium w-6">#</th>
                  <th className="pb-2 font-medium">{t('dash.table.lider')}</th>
                  <th className="pb-2 font-medium text-right">План (лидов)</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.leadsCol')}</th>
                  <th className="pb-2 font-medium text-right">% выполн.</th>
                  <th className="pb-2 font-medium text-right">{sc.tracking.meetingsScheduled}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.qualified')}</th>
                  <th className="pb-2 font-medium text-right">{t('dash.table.pctQual')}</th>
                </tr>
              </thead>
              <tbody>
                {liderRating.map((m: any, i: number) => (
                  <tr key={m.id} className={`border-b border-gray-50 hover:opacity-90 transition-colors ${STATUS[m.status as keyof typeof STATUS]?.bg || ''}`}>
                    <td className="py-2.5 pl-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${STATUS[m.status as keyof typeof STATUS]?.dot || 'bg-gray-300'}`} />
                    </td>
                    <td className="py-2.5 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 font-medium text-gray-900">{m.name}</td>
                    <td className="py-2.5 text-right text-gray-500">{m.leadsplan > 0 ? fmt(m.leadsplan) : '—'}</td>
                    <td className="py-2.5 text-right font-medium text-gray-700">{fmt(m.leads)}</td>
                    <td className="py-2.5 text-right">
                      <span className={`font-semibold ${m.completion >= 75 ? 'text-green-600' : m.completion > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                        {m.meetingsPlan > 0 ? `${m.completion}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-gray-500">{fmt(m.meetingsScheduled)}</td>
                    <td className="py-2.5 text-right font-medium">{fmt(m.qualifiedLeads)}</td>
                    <td className="py-2.5 text-right text-gray-500">{m.qualRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PRODUCT ANALYTICS ── */}
      {productStats.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            📦 {t('dash.owner.productStats')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs text-gray-400 font-medium">{t('dash.owner.productCol')}</th>
                  <th className="text-center py-2 text-xs text-gray-400 font-medium">{t('dash.owner.countCol')}</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-medium">{t('dash.owner.amountCol')}</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-medium">Доля</th>
                </tr>
              </thead>
              <tbody>
                {productStats.map((p: any, i: number) => {
                  const totalAmt = productStats.reduce((s: number, x: any) => s + x.totalAmount, 0)
                  const share = totalAmt > 0 ? Math.round((p.totalAmount / totalAmt) * 100) : 0
                  return (
                    <tr key={p.productId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2.5 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'}`}>
                            {i + 1}
                          </span>
                          {p.productName}
                        </div>
                      </td>
                      <td className="py-2.5 text-center font-semibold text-gray-700">{p.count}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-900">₸ {fmt(p.totalAmount)}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{share}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GATEWAY ANALYTICS ── */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          {t('dash.gateway.title')}
        </h3>
        <GatewayAnalytics data={gatewayAnalytics} />
      </div>

      <AIInsights
        data={summary}
        managerRating={managerRating}
        liderRating={liderRating}
        funnel={{
          leadsReceived: summary.totalLiderLeads,
          qualifiedLeads: summary.totalQualifiedLeads,
          meetingsScheduled: summary.totalMeetingsScheduled,
          meetingsAttended: summary.totalMeetingsAttended,
          salesCount: summary.totalSalesCount,
        }}
        productStats={productStats}
        period={periodState.period}
      />

    </div>
  )
}
