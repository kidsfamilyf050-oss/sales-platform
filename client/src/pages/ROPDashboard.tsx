import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { X, RotateCcw, ExternalLink as ExtLink } from 'lucide-react'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import GatewayAnalytics from '../components/ui/GatewayAnalytics'
import { useT } from '../i18n'
import { ChevronDown, ChevronRight, ExternalLink, Download } from 'lucide-react'
import { useAuthStore } from '../store/auth'

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

// Refunds drill-down modal
function RefundsModal({ leads, onClose }: { leads: any[]; onClose: () => void }) {
  const { t } = useT()
  const total = leads.reduce((s, l) => s + (l.amount ?? l.netAmount ?? 0), 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-red-500" />
            <h3 className="font-bold text-gray-900">{t('dash.rop.refundTitle')}</h3>
            <span className="text-sm text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
              {leads.length} шт. · −₸ {total.toLocaleString('ru')}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Возвратов нет</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {leads.map((l: any) => (
                <div key={l.id} className="px-4 py-3 hover:bg-red-50/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{l.clientName}</p>
                      {l.phone && <p className="text-xs text-gray-400">{l.phone}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-red-600 text-sm">−₸ {(l.amount ?? l.netAmount ?? 0).toLocaleString('ru')}</p>
                      <p className="text-xs text-gray-400">{l.date}</p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs text-gray-500">
                    {l.assignedTo && <span>👤 {l.assignedTo.name}</span>}
                    {l.salesChannel && <span>📢 {l.salesChannel.name}</span>}
                    {l.refundComment && (
                      <span className="text-red-500 italic">💬 {l.refundComment}</span>
                    )}
                    {l.crmLink && (
                      <a href={l.crmLink} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:underline ml-auto"
                        onClick={e => e.stopPropagation()}>
                        <ExtLink className="w-3 h-3" /> CRM
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Lead detail modal (for ROP drill-down)
function LeadModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead-detail', leadId],
    queryFn: () => api.get(`/leads/${leadId}`).then(r => r.data),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Заявка</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        {isLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : !lead ? (
          <div className="p-6 text-center text-gray-400 text-sm">Заявка не найдена</div>
        ) : (
          <div className="p-4 space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-bold text-gray-900 text-base">{lead.clientName}</p>
                {lead.phone && <p className="text-gray-500">{lead.phone}</p>}
              </div>
              <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                lead.status === 'SOLD' ? 'bg-green-100 text-green-700' :
                lead.status === 'REFUSED' ? 'bg-red-100 text-red-700' :
                lead.status === 'IN_WORK' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {lead.status === 'SOLD' ? 'Продажа' : lead.status === 'REFUSED' ? 'Отказ' : lead.status === 'IN_WORK' ? 'Дожим' : lead.status}
                {lead.isRefund && ' · Возврат'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-400">Дата заявки:</span> <span className="font-medium">{lead.date}</span></div>
              <div><span className="text-gray-400">Канал:</span> <span className="font-medium">{lead.salesChannel?.name || '—'}</span></div>
              {lead.assignedTo && <div><span className="text-gray-400">Клоузер:</span> <span className="font-medium">{lead.assignedTo.name}</span></div>}
              {lead.amount && <div><span className="text-gray-400">Сумма:</span> <span className="font-bold text-green-700">₸ {lead.amount?.toLocaleString('ru')}</span></div>}
              {lead.isRefund && lead.refundComment && <div className="col-span-2"><span className="text-gray-400">Причина возврата:</span> <span className="font-medium text-red-600">{lead.refundComment}</span></div>}
              {lead.crmLink && (
                <div className="col-span-2">
                  <a href={lead.crmLink} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-blue-500 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Открыть в CRM
                  </a>
                </div>
              )}
            </div>
            {lead.closerComment && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                💬 {lead.closerComment}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Expanded manager row — shows period sales and today's report
function ManagerDetail({ m }: { m: any }) {
  const { t } = useT()
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set())
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  // m.sales = period sales (matches selected period); m.todaySales = today only (for status)
  const periodSales: any[] = m.sales || []
  const net = (s: any) => Number(s.netAmount ?? s.amount) || 0
  const periodTotal = periodSales.reduce((acc: number, s: any) => acc + net(s), 0)
  const report = m.todayReport

  const toggleSale = (id: string) => setExpandedSales(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  return (
    <>
      {selectedLeadId && <LeadModal leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
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
              <div className="space-y-1">
                {periodSales.map((s: any) => {
                  const netAmt = net(s)
                  const grossAmt = Number(s.amount) || 0
                  const hasDiscount = s.netAmount && s.netAmount !== s.amount
                  const isOpen = expandedSales.has(s.id)
                  return (
                    <div key={s.id} className={`rounded-lg border overflow-hidden ${s.isRefund ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                      {/* Collapsed row — clickable */}
                      <div
                        className={`flex items-center gap-3 text-xs px-3 py-2 cursor-pointer transition-colors ${s.isRefund ? 'hover:bg-red-100' : 'hover:bg-gray-50'}`}
                        onClick={() => toggleSale(s.id)}
                      >
                        <ChevronRight className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        {s.isRefund && <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-red-200 text-red-700 shrink-0">Возврат</span>}
                        {/* Amount: for refund show gross (full paid amount), for normal show net */}
                        {s.isRefund ? (
                          <>
                            <span className="font-bold text-red-600 whitespace-nowrap min-w-[80px]">−₸ {fmt(grossAmt)}</span>
                            <span className="text-gray-400 line-through text-[11px]">₸ {fmt(netAmt)}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-gray-900 whitespace-nowrap min-w-[80px]">₸ {fmt(netAmt)}</span>
                            {hasDiscount && <span className="text-gray-400 line-through text-[11px]">₸ {fmt(grossAmt)}</span>}
                          </>
                        )}
                        {!s.isRefund && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${s.paymentType === 'new_sale' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {PAYMENT_TYPE_LABEL[s.paymentType] || s.paymentType}
                          </span>
                        )}
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
                        {s.leadId && (
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedLeadId(s.leadId) }}
                            className="ml-auto shrink-0 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            Заявка →
                          </button>
                        )}
                      </div>
                      {/* Expanded detail */}
                      {isOpen && (
                        <div className={`border-t px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs ${s.isRefund ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                          <div className="flex justify-between"><span className="text-gray-500">{t('dash.sale.gross')}</span><span className="font-medium">₸ {fmt(grossAmt)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">{t('dash.sale.netDeal')}</span><span className={`font-bold ${s.isRefund ? 'text-red-600' : 'text-green-700'}`}>₸ {fmt(netAmt)}</span></div>
                          {hasDiscount && <div className="flex justify-between"><span className="text-gray-500">{t('dash.sale.fee')}</span><span className="font-medium text-orange-600">{Math.round((1 - netAmt / grossAmt) * 100)}%</span></div>}
                          {s.productName && <div className="flex justify-between"><span className="text-gray-500">{t('dash.rop.productCol')}</span><span className="font-medium text-purple-700">📦 {s.productName}</span></div>}
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
    </>
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
            <span className="text-gray-500">{t('dash.funnel.attended')} <span className="text-gray-400 font-normal text-[10px]">{t('dash.funnel.attendedNote')}</span>: <span className="font-bold text-gray-900">{report.meetingsAttended || 0}</span></span>
            {report.comment && <span className="text-gray-400 italic">💬 {report.comment}</span>}
          </div>
        </div>
      </td>
    </tr>
  )
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

export default function ROPDashboard() {
  const { t } = useT()
  const navigate = useNavigate()
  const periodState = usePeriodStore()
  const { period } = periodState
  const params = buildPeriodParams(periodState)
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-rop', params],
    queryFn: () => api.get(`/dashboard/rop?${params}`).then(r => r.data),
    refetchInterval: 60000,
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

  const { summary, funnel, marketing, managerRating, liderRating, productStats = [], gatewayAnalytics = [], carryover } = data as any

  const funnelSteps = [
    { label: 'Лидов получено',      value: funnel.leadsReceived,    color: 'bg-purple-400' },
    { label: 'Квалифицировано',     value: funnel.qualifiedLeads,   color: 'bg-purple-500' },
    { label: 'Передано клоузеру',   value: funnel.meetingsScheduled,color: 'bg-blue-400' },
    { label: 'В работе у клоузера', value: funnel.meetingsAttended, color: 'bg-blue-500' },
    { label: 'Продажи (сделки)',    value: funnel.salesCount,       color: 'bg-green-500' },
  ]

  return (
    <div className="space-y-6 px-4 md:px-6 py-2 md:py-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dash.rop.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('dash.rop.subtitle')}</p>
        </div>
        <button
          onClick={() => downloadExport('rop', params)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
          title="Скачать отчёт Excel"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Экспорт в Excel</span>
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard label={t('dash.rop.salesPlan')} value={`₸ ${fmt(summary.salesPlan)}`} />
        <StatCard label={t('dash.rop.salesFact')} value={`₸ ${fmt(summary.factNetSales ?? summary.factSalesAmount ?? summary.netSalesAmount ?? summary.salesAmount)}`} color="blue" />
        <div
          onClick={() => navigate('/rop/links?tab=REFUND')}
          className="cursor-pointer group"
          title="Открыть список возвратов"
        >
          <div className="card transition-all duration-150 group-hover:shadow-md group-hover:border-red-200 group-hover:bg-red-50/40 border border-transparent">
            <p className="text-xs font-medium uppercase tracking-wide mb-1 text-gray-400 group-hover:text-red-500 transition-colors">Возвраты</p>
            <p className={`text-2xl font-bold ${summary.refundCount > 0 ? 'text-red-500' : 'text-gray-900'}`}>
              {summary.refundCount ?? 0} шт.
            </p>
            {summary.refundCount > 0
              ? <p className="text-xs text-gray-400 group-hover:text-red-400 mt-1 transition-colors">−₸ {fmt(summary.refundTotal)} · нажмите →</p>
              : <p className="text-xs text-gray-300 group-hover:text-red-300 mt-1 transition-colors">нажмите →</p>
            }
          </div>
        </div>
        <StatCard label={t('dash.completion')} value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
        <StatCard label={t('dash.rop.deals')} value={summary.salesCount} />
        <StatCard label={t('dash.conversion')} value={`${summary.conversion}%`} sub={t('dash.rop.conversionSub')} />
        <StatCard label={t('dash.avgCheck')} value={`₸ ${fmt(summary.factAvgCheck ?? summary.avgCheck)}`} />
        <StatCard label={t('dash.consultations')} value={summary.totalConsultations ?? 0} />
        <div
          onClick={() => navigate('/rop/links?tab=REFUSAL')}
          className="cursor-pointer group"
          title="Открыть CRM-ссылки отказников"
        >
          <div className="card transition-all duration-150 group-hover:shadow-md group-hover:border-red-200 group-hover:bg-red-50/40 border border-transparent">
            <p className="text-xs text-gray-400 group-hover:text-red-500 transition-colors font-medium uppercase tracking-wide mb-1">{t('dash.refusals')}</p>
            <p className="text-2xl font-bold text-red-500">{summary.totalRefusals ?? 0}</p>
            {summary.totalRefusalsAmount > 0 && (
              <p className="text-xs text-red-400 font-medium mt-0.5">−₸ {summary.totalRefusalsAmount.toLocaleString('ru')}</p>
            )}
            <p className="text-xs text-gray-300 group-hover:text-red-400 mt-1 transition-colors">нажмите → CRM-ссылки</p>
          </div>
        </div>
        <div
          onClick={() => navigate('/rop/links?tab=IN_WORK')}
          className="cursor-pointer group"
          title="Открыть CRM-ссылки сделок в работе"
        >
          <div className="card transition-all duration-150 group-hover:shadow-md group-hover:border-amber-200 group-hover:bg-amber-50/40 border border-transparent">
            <p className="text-xs text-gray-400 group-hover:text-amber-600 transition-colors font-medium uppercase tracking-wide mb-1">{t('dash.inWork')}</p>
            <p className="text-2xl font-bold text-amber-500">{summary.totalInWork ?? 0}</p>
            <p className="text-xs text-gray-300 group-hover:text-amber-400 mt-1 transition-colors">нажмите → CRM-ссылки</p>
          </div>
        </div>
      </div>

      <ProgressBar value={summary.planCompletion} label={t('dash.rop.planCompletion')} />

      {/* Carryover sales (дожим) */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
        <div>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">{t('dash.carryover.title')}</p>
          <p className="text-sm text-amber-600">{t('dash.carryover.subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-6 shrink-0">
          {(carryover?.avgCheck ?? 0) > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-800">₸ {fmt(carryover?.avgCheck ?? 0)}</p>
              <p className="text-xs text-amber-500">средний чек</p>
            </div>
          )}
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-800">{carryover?.count ?? 0}</p>
            <p className="text-xs text-amber-500">{t('dash.carryover.deals')}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-800">₸ {fmt(carryover?.revenue ?? 0)}</p>
            <p className="text-xs text-amber-500">{t('dash.carryover.revenue')}</p>
          </div>
        </div>
      </div>

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
                  <th className="pb-2 font-medium text-center">{t('dash.table.plan')}</th>
                  <th className="pb-2 font-medium text-center">{t('dash.table.fact')}</th>
                  <th className="pb-2 font-medium text-center">{t('dash.table.completion')}</th>
                  <th className="pb-2 font-medium text-center">{t('dash.table.deals')}</th>
                  <th className="pb-2 font-medium text-center">{t('dash.carryover.title')}</th>
                  <th className="pb-2 font-medium text-center">{t('dash.table.avgCheck')}</th>
                  <th className="pb-2 font-medium text-center">{t('dash.table.conversion')}</th>
                  <th className="pb-2 font-medium text-center">{t('dash.consultations')}</th>
                  <th className="pb-2 font-medium text-center">{t('dash.refusals')}</th>
                  <th className="pb-2 font-medium text-center">{t('dash.inWork')}</th>
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
                        <td className="py-2.5 text-center text-gray-500">₸ {fmt(m.plan)}</td>
                        <td className="py-2.5 text-center font-medium">₸ {fmt(Math.max(0, m.salesAmount - (m.carryover?.revenue ?? 0)))}</td>
                        <td className="py-2.5 text-center">
                          <span className={`font-bold ${m.completion >= 75 ? 'text-green-600' : m.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {m.completion}%
                          </span>
                        </td>
                        <td className="py-2.5 text-center">{Math.max(0, m.salesCount - (m.carryover?.count ?? 0))}</td>
                        <td className="py-2.5 text-center text-amber-700 font-medium">
                          {m.carryover?.count > 0 ? m.carryover.count : '—'}
                        </td>
                        <td className="py-2.5 text-center text-gray-500">{(() => { const factCnt = Math.max(0, m.salesCount - (m.carryover?.count ?? 0)); const factAmt = Math.max(0, m.salesAmount - (m.carryover?.revenue ?? 0)); return factCnt > 0 ? `₸ ${fmt(Math.round(factAmt / factCnt))}` : '—' })()}</td>
                        <td className="py-2.5 text-center">{m.conversion}%</td>
                        <td className="py-2.5 text-center">{m.consultations ?? 0}</td>
                        <td className="py-2.5 text-center">
                          <button onClick={(e) => { e.stopPropagation(); navigate('/rop/links?tab=REFUSAL') }}
                            className="text-red-500 hover:text-red-700 hover:underline font-semibold cursor-pointer transition-colors" title="Смотреть CRM ссылки отказников">
                            {m.refusals ?? 0}
                          </button>
                        </td>
                        <td className="py-2.5 text-center">
                          <button onClick={(e) => { e.stopPropagation(); navigate('/rop/links?tab=IN_WORK') }}
                            className="text-amber-600 hover:text-amber-800 hover:underline font-semibold cursor-pointer transition-colors" title="Смотреть CRM ссылки в работе">
                            {m.inWork ?? 0}
                          </button>
                        </td>
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
                  <th className="pb-2 font-medium text-center">План (лидов)</th>
                  <th className="pb-2 font-medium text-center">Лидов</th>
                  <th className="pb-2 font-medium text-center">% выполн.</th>
                  <th className="pb-2 font-medium text-center">% квал.</th>
                  <th className="pb-2 font-medium text-center">Квалиф.</th>
                  <th className="pb-2 font-medium text-center">% передано</th>
                  <th className="pb-2 font-medium text-center">Передано</th>
                  <th className="pb-2 font-medium text-center">% в работе</th>
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
                        {/* 1. План (кол-во лидов) */}
                        <td className="py-2.5 text-center text-gray-500">{m.leadsplan > 0 ? m.leadsplan.toLocaleString('ru-RU') : '—'}</td>
                        {/* 2. Лидов */}
                        <td className="py-2.5 text-center text-gray-700 font-medium">{m.leads.toLocaleString('ru-RU')}</td>
                        {/* 3. % выполнения плана */}
                        <td className="py-2.5 text-center">
                          <span className={`font-semibold ${m.completion >= 75 ? 'text-green-600' : m.completion > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                            {m.meetingsPlan > 0 ? `${m.completion}%` : '—'}
                          </span>
                        </td>
                        {/* 4. % квал. */}
                        <td className="py-2.5 text-center text-gray-500 text-xs">{m.qualRate}%</td>
                        {/* 4. Квалиф. кол-во */}
                        <td className="py-2.5 text-center text-gray-500">{m.qualifiedLeads.toLocaleString('ru-RU')}</td>
                        {/* 5. % записано */}
                        <td className="py-2.5 text-center text-gray-500 text-xs">{m.pctScheduled ?? 0}%</td>
                        {/* 6. Записано кол-во */}
                        <td className="py-2.5 text-center text-gray-500">{m.meetingsScheduled.toLocaleString('ru-RU')}</td>
                        {/* 7. % проведено (записано→консультация) */}
                        <td className="py-2.5 text-center font-bold text-blue-600">{m.pctAttended ?? 0}%</td>
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

      {/* ── PRODUCT ANALYTICS ── */}
      {productStats.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            📦 {t('dash.rop.productsTable')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs text-gray-400 font-medium">{t('dash.rop.productCol')}</th>
                  <th className="text-center py-2 text-xs text-gray-400 font-medium">{t('dash.rop.countCol')}</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-medium">{t('dash.rop.amountCol')}</th>
                  <th className="text-right py-2 text-xs text-gray-400 font-medium">Доля</th>
                </tr>
              </thead>
              <tbody>
                {productStats.map((p: any, i: number) => {
                  const totalAmt = productStats.reduce((s: number, x: any) => s + x.totalAmount, 0)
                  const share = totalAmt > 0 ? Math.round((p.totalAmount / totalAmt) * 100) : 0
                  return (
                    <tr key={p.productId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2.5 font-medium text-gray-900 flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'}`}>
                          {i + 1}
                        </span>
                        {p.productName}
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

      <AIInsights data={summary} managerRating={managerRating} liderRating={liderRating} funnel={funnel} productStats={productStats} period={period} />
    </div>
  )
}
