import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import { Plus, Pencil, Trash2, ExternalLink, X, Check, Download, ChevronRight, Archive, Calendar, Clock, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useT } from '../i18n'
import { useAuthStore } from '../store/auth'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import GatewayAnalytics from '../components/ui/GatewayAnalytics'
import AIInsights from '../components/ui/AIInsights'

function fmt(n: number) { return n.toLocaleString('ru') }

interface Sale {
  id?: string
  amount: string
  paymentType: 'new_sale' | 'additional'
  paymentMethod: string
  bank: string
  months: string
  crmLink: string
  comment: string
}

const PAYMENT_GATEWAYS = [
  { value: 'GetPay',            label: 'GetPay',                                       fee: 0.13   },
  { value: 'TipTopPay_KZ',      label: 'Tip Top Pay (карта КЗ)',                       fee: 0.065  },
  { value: 'TipTopPay_Foreign', label: 'Tip Top Pay (карта зарубежного банка)',         fee: 0.079  },
  { value: 'Kaspi_Gold',        label: 'Каспи Пэй (GOLD)',                             fee: 0.0395 },
  { value: 'Kaspi_Account',     label: 'Каспи Пэй (Счет в Kaspi Pay)',                 fee: 0.041  },
  { value: 'Kaspi_Credit',      label: 'Каспи Пэй (CREDIT)',                           fee: 0.165  },
  { value: 'Kaspi_Red',         label: 'Каспи Пэй (RED)',                              fee: 0.143  },
  { value: 'Kaspi_Terminal',    label: 'Apple Pay / Google Pay Терминал Каспи',        fee: 0.043  },
  { value: 'Cash',              label: 'Наличные',                                     fee: 0.03   },
  { value: 'Transfer_AE',       label: 'Перевод на карту АЕ',                          fee: 0.03   },
  { value: 'Card_Sberbank',     label: 'Карта / СберБанк',                             fee: 0.03   },
  { value: 'Kaspi_Bookkeeper',  label: 'Каспи счет (через бухгалтера)',                fee: 0.03   },
]
const GATEWAY_FEE_MAP = Object.fromEntries(PAYMENT_GATEWAYS.map(g => [g.value, g.fee]))
const gatewayLabel = (v: string) => PAYMENT_GATEWAYS.find(g => g.value === v)?.label ?? v
const calcNetAmount = (amount: number, method: string) => {
  const fee = GATEWAY_FEE_MAP[method] ?? 0.03
  return Math.round(amount * (1 - fee) * 100) / 100
}

const emptySale = (): Sale => ({
  amount: '', paymentType: 'new_sale', paymentMethod: 'Cash',
  bank: '', months: '12', crmLink: '', comment: '',
})

const showMonths = (m: string) => ['Kaspi_Credit', 'Kaspi_Red'].includes(m)

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayStr = localDateStr(new Date())

const PAYMENT_TYPE_LABEL: Record<string, string> = { new_sale: 'Новая', additional: 'Доплата' }

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

// ── Portal-based custom dropdown (avoids overflow clipping) ─────────────────
function SelectDropdown({
  value, onChange, options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) })
    }
    setOpen(p => !p)
  }

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (
        listRef.current && !listRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onOut)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onOut)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <>
      <button ref={btnRef} type="button" onClick={handleOpen}
        className="input flex items-center justify-between gap-2 text-left">
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div ref={listRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-2xl border border-gray-100 py-1 overflow-hidden max-h-72 overflow-y-auto">
          {options.map(opt => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${value === opt.value ? 'font-semibold text-blue-700 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}>
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

export default function ManagerDashboard() {
  const { t } = useT()
  const periodStore = usePeriodStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const params = buildPeriodParams(periodStore)

  // Sales date selector
  const [salesDate, setSalesDate] = useState(todayStr)
  const isToday = salesDate === todayStr

  // Main dashboard data
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-manager', params],
    queryFn: () => api.get(`/dashboard/manager?${params}`).then(r => r.data),
    refetchInterval: 60000,
  })

  // Lider ranking (only used for lider view — shows competitive leaderboard)
  const { data: rankingData } = useQuery({
    queryKey: ['lider-ranking', params],
    queryFn: () => api.get(`/dashboard/lider-ranking?${params}`).then(r => r.data),
    refetchInterval: 60000,
  })

  // Closer ranking (only used for closer view — shows competitive leaderboard)
  const { data: closerRankingData } = useQuery({
    queryKey: ['closer-ranking', params],
    queryFn: () => api.get(`/dashboard/closer-ranking?${params}`).then(r => r.data),
    refetchInterval: 60000,
  })

  // Lider: today's scheduled consultations
  const { data: todayAppointments = [] } = useQuery<any[]>({
    queryKey: ['today-appointments-dash'],
    queryFn: () => api.get('/leads/today-appointments').then(r => r.data),
    refetchInterval: 60000,
  })

  // Lider: recent leads (last 5)
  const { data: recentLeadsData } = useQuery<any>({
    queryKey: ['lider-recent-leads'],
    queryFn: () => api.get('/leads/lider-report?period=week').then(r => r.data),
    refetchInterval: 60000,
  })
  const recentLeads: any[] = (recentLeadsData?.leads || []).slice(0, 6)

  // Closer: refunded leads for the selected period
  const { data: refundLeads = [] } = useQuery<any[]>({
    queryKey: ['closer-refunds', params],
    queryFn: () => api.get(`/leads/refunds?${params}`).then(r => r.data),
    refetchInterval: 60000,
  })


  // Sales for selected date
  const { data: todaySales = [] } = useQuery({
    queryKey: ['sales-today', salesDate],
    queryFn: () => api.get(`/sales?date=${salesDate}`).then(r => r.data),
    refetchInterval: 30000,
  })

  // Sale form state
  const [saleForm, setSaleForm] = useState<Sale | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const createSale = useMutation({
    mutationFn: (data: any) => api.post('/sales', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales-today'] }); qc.invalidateQueries({ queryKey: ['dashboard-manager'] }); setSaleForm(null); setEditingId(null) },
  })

  const updateSale = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/sales/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales-today'] }); qc.invalidateQueries({ queryKey: ['dashboard-manager'] }); setSaleForm(null); setEditingId(null) },
  })

  const deleteSale = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales-today'] }); qc.invalidateQueries({ queryKey: ['dashboard-manager'] }) },
  })

  const openAdd = () => { setSaleForm(emptySale()); setEditingId(null) }
  const openEdit = (s: any) => {
    setSaleForm({ amount: String(s.amount), paymentType: s.paymentType, paymentMethod: s.paymentMethod || 'Cash', bank: '', months: String(s.months || '12'), crmLink: s.crmLink || '', comment: s.comment || '' })
    setEditingId(s.id)
  }

  const saveSale = () => {
    if (!saleForm || !saleForm.amount || !saleForm.crmLink) return
    const numAmount = Number(saleForm.amount)
    const netAmount = calcNetAmount(numAmount, saleForm.paymentMethod)
    const payload = {
      date: salesDate,
      amount: numAmount,
      netAmount,
      paymentType: saleForm.paymentType,
      paymentMethod: saleForm.paymentMethod,
      months: showMonths(saleForm.paymentMethod) ? Number(saleForm.months) : null,
      crmLink: saleForm.crmLink || null,
      comment: saleForm.comment || null,
    }
    if (editingId) updateSale.mutate({ id: editingId, data: payload })
    else createSale.mutate(payload)
  }

  const net = (x: any) => Number(x.netAmount ?? x.amount) || 0
  const totalToday = (todaySales as any[]).reduce((s: number, x: any) => s + net(x), 0)

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>
  if (!data) return null

  const { summary, todayReport, recentReports, periodSales: periodSalesData = [], gatewayAnalytics = [], type } = data as any
  const isCloser = type === 'CLOSER'
  const todayData = todayReport?.data as any

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto px-4 md:px-8 py-4 md:py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dash.manager.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isCloser ? t('role.closer') : t('role.lider')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadExport(isCloser ? 'manager' : 'lider-full', buildPeriodParams(periodStore))}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            title="Скачать отчёт Excel"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('dash.closer.exportBtn')}</span>
          </button>
          {/* Closer/Lider no longer fill daily reports */}
        </div>
      </div>

      {isCloser ? (
        <>
          {/* Period stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            <StatCard label={t('dash.manager.salesPlan')} value={`₸ ${fmt(summary.salesPlan)}`} />
            <StatCard label={t('dash.manager.salesPeriod')} value={`₸ ${fmt(summary.factNetSales ?? summary.factSalesAmount ?? summary.netSalesAmount ?? summary.salesAmount)}`} color="blue"
              sub={summary.refundCount > 0 ? `−₸ ${fmt(summary.refundTotal)} ${t('dash.closer.refundsSuffix')}` : undefined} />
            <StatCard label={t('dash.completion')} value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
            <StatCard label={t('dash.manager.deals')} value={summary.factSalesCount ?? summary.salesCount} />
            <StatCard label={t('dash.conversion')} value={`${summary.leadConversion ?? summary.conversion}%`} />
            <StatCard label={t('dash.avgCheck')} value={`₸ ${fmt(summary.factAvgCheck ?? summary.avgCheck)}`} />
          </div>

          {/* Carryover sales (дожим) */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">{t('dash.carryover.title')}</p>
              <p className="text-sm text-amber-600">{t('dash.carryover.subtitle')}</p>
            </div>
            <div className="ml-auto flex items-center gap-6 shrink-0">
              {(summary.carryover?.avgCheck ?? 0) > 0 && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-800">₸ {fmt(summary.carryover?.avgCheck ?? 0)}</p>
                  <p className="text-xs text-amber-500">средний чек</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-800">{summary.carryover?.count ?? 0}</p>
                <p className="text-xs text-amber-500">{t('dash.carryover.deals')}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-800">₸ {fmt(summary.carryover?.revenue ?? 0)}</p>
                <p className="text-xs text-amber-500">{t('dash.carryover.revenue')}</p>
              </div>
            </div>
          </div>

          {/* Lead-based stats for closer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div onClick={() => navigate('/closer/leads')} className="card cursor-pointer group transition-all hover:shadow-md hover:border-blue-200 hover:bg-blue-50/40 border border-transparent">
              <p className="text-xs font-medium text-gray-400 group-hover:text-blue-500 transition-colors uppercase tracking-wide mb-1">{t('dash.closer.incoming')}</p>
              <p className="text-2xl font-bold text-blue-600">{summary.pendingLeadsCount ?? 0}</p>
              <p className="text-xs text-gray-300 group-hover:text-blue-400 mt-1 transition-colors">{t('dash.closer.newApps')}</p>
            </div>
            <div onClick={() => navigate('/closer/leads?tab=inwork')} className="card cursor-pointer group transition-all hover:shadow-md hover:border-amber-200 hover:bg-amber-50/40 border border-transparent">
              <p className="text-xs font-medium text-gray-400 group-hover:text-amber-500 transition-colors uppercase tracking-wide mb-1">{t('dash.inWork')}</p>
              <p className="text-2xl font-bold text-amber-500">{summary.inWorkLeadsCount ?? 0}</p>
              <p className="text-xs text-gray-300 group-hover:text-amber-400 mt-1 transition-colors">{t('dash.closer.activeLabel')}</p>
            </div>
            <div onClick={() => navigate('/closer/leads?tab=refused')} className="card cursor-pointer group transition-all hover:shadow-md hover:border-red-100 hover:bg-red-50/30 border border-transparent">
              <p className="text-xs font-medium text-gray-400 group-hover:text-red-500 transition-colors uppercase tracking-wide mb-1">{t('dash.refusals')}</p>
              <p className="text-2xl font-bold text-red-500">{summary.leadRefusedCount ?? 0}</p>
              <p className="text-xs text-gray-300 group-hover:text-red-400 mt-1 transition-colors">{t('dash.closer.forPeriod')}</p>
            </div>
            <div onClick={() => navigate('/closer/leads?tab=refunds')} className="card cursor-pointer group transition-all hover:shadow-md hover:border-red-200 hover:bg-red-50/40 border border-transparent">
              <p className="text-xs font-medium text-gray-400 group-hover:text-red-500 transition-colors uppercase tracking-wide mb-1">{t('dash.closer.refunds')}</p>
              <p className="text-2xl font-bold text-red-500">{summary.refundCount ?? 0}</p>
              <p className="text-xs text-gray-300 group-hover:text-red-400 mt-1 transition-colors">{summary.refundCount > 0 ? `−₸ ${fmt(summary.refundTotal ?? 0)}` : t('dash.closer.noPeriod')}</p>
            </div>
          </div>

          {/* Closer leaderboard — competitive ranking */}
          {closerRankingData?.ranking?.length > 0 && (
            <div className="card">
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900">{t('dash.closer.ratingTitle')}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{t('dash.closer.ratingNote')}</p>
              </div>
              <div className="space-y-1.5">
                {closerRankingData.ranking.map((r: any, idx: number) => {
                  const isMe = r.id === closerRankingData.currentUserId
                  const medalCls = idx === 0 ? 'text-yellow-500 font-black' : idx === 1 ? 'text-gray-400 font-black' : idx === 2 ? 'text-amber-600 font-black' : 'text-gray-400 font-medium'
                  return (
                    <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isMe
                        ? 'bg-blue-50 border-2 border-blue-300 shadow-sm'
                        : 'bg-gray-50 border border-gray-100'
                    }`}>
                      <span className={`text-sm w-7 text-center shrink-0 ${medalCls}`}>{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold truncate ${isMe ? 'text-blue-800' : 'text-gray-800'}`}>{r.name}</span>
                          {isMe && <span className="text-xs font-bold text-blue-600 shrink-0">{t('dash.lider.rankMe')}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 relative h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 bg-gradient-to-r ${r.completion >= 75 ? 'from-emerald-400 to-green-600' : r.completion >= 50 ? 'from-yellow-300 to-amber-500' : 'from-red-400 to-rose-500'}`}
                              style={{ width: r.completion > 0 ? `max(${Math.min(100, r.completion)}%, 5px)` : '0%' }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
                          </div>
                          <span className={`text-xs font-bold w-10 text-right shrink-0 ${r.completion >= 75 ? 'text-green-600' : r.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {r.plan > 0 ? `${r.completion}%` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isMe ? 'text-blue-700' : 'text-gray-700'}`}>₸ {fmt(r.salesAmount)}</p>
                        <p className="text-xs text-gray-400">{r.salesCount} сд.</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── PERIOD SALES ── all sales in selected period */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{t('dash.periodSales')}</h3>
                {(periodSalesData as any[]).length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(periodSalesData as any[]).length} сд. · ₸ {fmt((periodSalesData as any[]).reduce((s: number, x: any) => s + net(x), 0))}
                  </p>
                )}
              </div>
            </div>
            {(periodSalesData as any[]).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">{t('dash.noSalesPeriod')}</p>
            ) : (
              <div className="space-y-2">
                {(periodSalesData as any[]).map((s: any) => (
                  <div key={s.id} className={`flex items-start justify-between p-3 rounded-xl border ${s.isRefund ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {s.isRefund && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-200 text-red-700">{t('dash.closer.refundBadge')}</span>}
                        {s.leadId ? (
                          <>
                            <span className="text-xs text-gray-400 shrink-0">Заявка: {new Date(s.date + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
                            <span className="text-xs text-gray-400 shrink-0">· Продажа: {new Date(s.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 w-16 shrink-0">{new Date(s.date + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
                        )}
                        {s.isRefund ? (
                          <>
                            <span className="font-bold text-red-600">−₸ {fmt(Number(s.amount))}</span>
                            <span className="text-xs text-gray-400 line-through">₸ {fmt(net(s))}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-gray-900">₸ {fmt(net(s))}</span>
                            {s.netAmount && s.netAmount !== s.amount && <span className="text-xs text-gray-400 line-through">₸ {fmt(Number(s.amount))}</span>}
                          </>
                        )}
                        {!s.isRefund && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.paymentType === 'new_sale' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {PAYMENT_TYPE_LABEL[s.paymentType]}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">{gatewayLabel(s.paymentMethod)}</span>
                        {!s.isRefund && s.netAmount && <span className="text-xs text-green-600 font-medium">{t('dash.closer.budgetLabel')} {s.netAmount.toLocaleString('ru')} ₸</span>}
                        {s.months && showMonths(s.paymentMethod) && <span className="text-xs text-gray-400">{s.months} мес.</span>}
                      </div>
                      {s.crmLink && (
                        <a href={s.crmLink} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1 max-w-xs">
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{s.crmLink}</span>
                        </a>
                      )}
                      {s.comment && <p className="text-xs text-gray-500 mt-1">💬 {s.comment}</p>}
                    </div>
                    <div className="flex gap-0.5 ml-2 flex-shrink-0">
                      <button onClick={() => { setSalesDate(s.date); openEdit(s) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(t('dash.closer.deleteSale'))) deleteSale.mutate(s.id) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── REFUNDS ── */}
          {(refundLeads as any[]).length > 0 && (
            <div className="card border-l-4 border-l-red-400">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-red-600">{t('dash.closer.refundsTitle')}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(refundLeads as any[]).length} шт. · −₸ {fmt((refundLeads as any[]).reduce((s: number, l: any) => s + (l.netAmount ?? l.amount ?? 0), 0))}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {(refundLeads as any[]).map((l: any) => (
                  <div key={l.id} className="flex items-start justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-200 text-red-700">{t('dash.closer.refundBadge')}</span>
                        <span className="font-bold text-red-600">−₸ {fmt(l.netAmount ?? l.amount ?? 0)}</span>
                        <span className="text-xs text-gray-400">
                          {new Date((l.refundedAt ?? l.date + 'T12:00:00')).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      {l.name && <p className="text-xs text-gray-600 mt-1 font-medium">{l.name}</p>}
                      {l.refundComment && <p className="text-xs text-gray-500 mt-0.5">💬 {l.refundComment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TODAY'S SALES ── entered throughout the day */}
          <div className="card">
            <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {t('report.closer.sales')} {isToday ? t('period.today').toLowerCase() : new Date(salesDate + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                </h3>
                {(todaySales as any[]).length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">{(todaySales as any[]).length} сд. · ₸ {fmt(totalToday)}</p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <input
                  type="date"
                  className="input text-xs py-1.5 w-auto"
                  value={salesDate}
                  max={todayStr}
                  onChange={e => { setSalesDate(e.target.value); setSaleForm(null); setEditingId(null) }}
                  title="Выбрать дату"
                />
                {!saleForm && (
                  <button onClick={openAdd}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
                    <Plus className="w-3.5 h-3.5" /> {t('report.closer.addSale')}
                  </button>
                )}
              </div>
            </div>

            {/* Sale list */}
            {(todaySales as any[]).length > 0 && !saleForm && (
              <div className="space-y-2 mb-3">
                {(todaySales as any[]).map((s: any) => (
                  <div key={s.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">₸ {fmt(net(s))}</span>
                        {s.netAmount && s.netAmount !== s.amount && <span className="text-xs text-gray-400 line-through">₸ {fmt(Number(s.amount))}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.paymentType === 'new_sale' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {PAYMENT_TYPE_LABEL[s.paymentType]}
                        </span>
                        <span className="text-xs text-gray-500">{gatewayLabel(s.paymentMethod)}</span>
                        {s.netAmount && <span className="text-xs text-green-600 font-medium">Бюджет: {s.netAmount.toLocaleString('ru')} ₸</span>}
                        {s.months && showMonths(s.paymentMethod) && <span className="text-xs text-gray-400">{s.months} мес.</span>}
                      </div>
                      {s.crmLink && (
                        <a href={s.crmLink} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1 max-w-xs">
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{s.crmLink}</span>
                        </a>
                      )}
                      {s.comment && (
                        <p className="text-xs text-gray-500 mt-1">💬 {s.comment}</p>
                      )}
                    </div>
                    <div className="flex gap-0.5 ml-2 flex-shrink-0">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm('Удалить продажу?')) deleteSale.mutate(s.id) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1 border-t border-gray-100 text-sm">
                  <span className="text-gray-500">{t('report.closer.total')}: {(todaySales as any[]).length} {t('dash.closer.dealsCount')}</span>
                  <span className="font-bold text-gray-900">₸ {fmt(totalToday)}</span>
                </div>
              </div>
            )}

            {(todaySales as any[]).length === 0 && !saleForm && (
              <p className="text-sm text-gray-400 text-center py-6">{t('report.closer.noSales')}</p>
            )}

            {/* Inline sale form */}
            {saleForm && (
              <div className="p-4 border-2 border-blue-100 rounded-xl bg-blue-50/30 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">
                  {editingId ? t('report.closer.editSale') : t('report.closer.newSaleTitle')}
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t('report.closer.amount')} *</label>
                    <input type="number" className="input" min="0" placeholder="0" autoFocus
                      value={saleForm.amount}
                      onChange={e => setSaleForm(f => f ? { ...f, amount: e.target.value } : f)} />
                  </div>
                  <div>
                    <label className="label">{t('report.closer.saleType')}</label>
                    <SelectDropdown
                      value={saleForm.paymentType}
                      onChange={v => setSaleForm(f => f ? { ...f, paymentType: v as any } : f)}
                      options={[
                        { value: 'new_sale',   label: t('report.closer.newSale') },
                        { value: 'additional', label: t('report.closer.additional') },
                      ]}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">{t('dash.closer.gatewayLabel')}</label>
                    <SelectDropdown
                      value={saleForm.paymentMethod}
                      onChange={m => setSaleForm(f => f ? { ...f, paymentMethod: m, months: showMonths(m) ? (f.months || '12') : '' } : f)}
                      options={PAYMENT_GATEWAYS.map(g => ({ value: g.value, label: g.label }))}
                    />
                    {(() => {
                      const fee = GATEWAY_FEE_MAP[saleForm.paymentMethod] ?? 0.03
                      const numAmt = Number(saleForm.amount)
                      const net = numAmt > 0 ? calcNetAmount(numAmt, saleForm.paymentMethod) : null
                      return (
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 font-medium">
                            {t('dash.closer.feeLabel')} {(fee * 100).toFixed(1)}%
                          </span>
                          {net !== null && (
                            <span className="text-xs px-2 py-1 bg-green-50 border border-green-200 rounded-lg text-green-700 font-medium">
                              {t('dash.closer.dealBudget')} {net.toLocaleString('ru')} ₸
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {showMonths(saleForm.paymentMethod) && (
                  <div>
                    <label className="label">{t('report.closer.months')}</label>
                    <div className="flex gap-2">
                      {['6', '12', '24', '36'].map(m => (
                        <button key={m} type="button"
                          onClick={() => setSaleForm(f => f ? { ...f, months: m } : f)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            saleForm.months === m ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                          }`}>
                          {m} мес.
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">{t('report.closer.crmLink')} <span className="text-red-500">*</span></label>
                  <input type="url" className="input" placeholder="https://..." required
                    value={saleForm.crmLink}
                    onChange={e => setSaleForm(f => f ? { ...f, crmLink: e.target.value } : f)} />
                </div>

                <div>
                  <label className="label">{t('report.closer.comment')}</label>
                  <textarea className="input" rows={2} placeholder={t('dash.closer.saleNotesPlaceholder')}
                    value={saleForm.comment}
                    onChange={e => setSaleForm(f => f ? { ...f, comment: e.target.value } : f)} />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setSaleForm(null); setEditingId(null) }}
                    className="btn-secondary flex items-center gap-1.5 flex-1 justify-center py-2">
                    <X className="w-3.5 h-3.5" /> {t('common.cancel')}
                  </button>
                  <button onClick={saveSale} disabled={!saleForm.amount || !saleForm.crmLink || createSale.isPending || updateSale.isPending}
                    className="btn-primary flex items-center gap-1.5 flex-1 justify-center py-2 disabled:opacity-40" title={!saleForm?.crmLink ? t('dash.closer.saveSaleHint') : ''}>
                    <Check className="w-3.5 h-3.5" /> {t('common.save')}
                  </button>
                </div>
              </div>
            )}
          </div>

        </>
      ) : (
        <>
          {/* Quick-access: active leads */}
          <div onClick={() => navigate('/lider/leads')}
            className="card cursor-pointer group transition-all hover:shadow-md hover:border-blue-200 hover:bg-blue-50/30 border border-transparent flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700 group-hover:text-blue-700 transition-colors">{t('dash.closer.toLeads')}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {summary.newCount > 0 && <span className="text-blue-600 font-medium mr-2">{summary.newCount} {t('dash.closer.activeLabel')}</span>}
                {summary.assignedCount > 0 && <span className="text-purple-600 font-medium mr-2">{summary.assignedCount} {t('dash.closer.transferredLabel')}</span>}
                {summary.unqualifiedCount > 0 && <span className="text-gray-500 font-medium">{summary.unqualifiedCount} {t('dash.closer.unqualLabel')}</span>}
                {!summary.newCount && !summary.assignedCount && !summary.unqualifiedCount && t('dash.noSalesPeriod')}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
          </div>

          {/* Lider stats — primary KPI: consultations conducted */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            <StatCard label={t('dash.manager.leads')} value={summary.leads} sub={summary.leadsplan > 0 ? `план ${summary.leadsplan}` : undefined} />
            <StatCard label={t('dash.manager.qualified')} value={summary.qualifiedLeads} sub={`${summary.qualRate}% квал.`} />
            <StatCard label={t('dash.manager.meetings')} value={summary.meetingsScheduled} />
            <StatCard label={t('dash.manager.attended')} value={summary.meetingsAttended} color="blue" />
            <StatCard label={t('dash.manager.schedToAtt')} value={summary.meetingsScheduled > 0 ? `${Math.round(summary.meetingsAttended / summary.meetingsScheduled * 100)}%` : '—'} color="yellow" />
            <StatCard label={t('dash.manager.meetingsPlan')} value={summary.meetingsScheduledPlan} sub={summary.planCompletion > 0 ? `${summary.planCompletion}% выполн.` : undefined} />
          </div>

          {/* Несостоявшиеся — lider's own metric */}
          {(summary.notHappened ?? 0) > 0 && (
            <div
              onClick={() => navigate('/lider/not-happened')}
              className="card cursor-pointer group transition-all hover:shadow-md hover:border-orange-200 hover:bg-orange-50/30 border border-transparent flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-gray-400 group-hover:text-orange-600 uppercase tracking-wide mb-1 transition-colors">
                  {t('dash.lider.notHappened')}
                </p>
                <p className="text-2xl font-bold text-orange-500">{summary.notHappened}</p>
                <p className="text-xs text-gray-300 group-hover:text-orange-400 mt-1 transition-colors">
                  {t('dash.lider.notHappenedHint')}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-orange-400 transition-colors shrink-0" />
            </div>
          )}

          {/* ── Today's consultations ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-500" /> {t('dash.lider.consultToday')}
              </h3>
              <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${todayAppointments.length > 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {todayAppointments.length}
              </span>
            </div>
            {todayAppointments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">{t('dash.noAppointments')}</p>
            ) : (
              <div className="space-y-2">
                {todayAppointments.map((lead: any) => {
                  const usePostponed = lead.postponedDate === todayStr
                  const time = usePostponed ? lead.postponedTime : lead.appointmentTime
                  const statusColor = lead.consultationStatus === 'happened' ? 'text-green-600' : lead.consultationStatus === 'not_happened' ? 'text-red-500' : lead.consultationStatus === 'postponed' ? 'text-orange-500' : 'text-gray-400'
                  const statusLabel = lead.consultationStatus === 'happened' ? 'Состоялась' : lead.consultationStatus === 'not_happened' ? 'Не состоялась' : lead.consultationStatus === 'postponed' ? 'Перенос' : 'Ожидается'
                  return (
                    <div key={lead.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="text-sm font-bold text-blue-700 w-12 shrink-0 text-center">
                        {time || '—'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{lead.clientName}</p>
                        <p className="text-xs text-gray-400 truncate">{lead.assignedTo?.name || 'Без клоузера'}</p>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${statusColor}`}>{statusLabel}</span>
                    </div>
                  )
                })}
                <button onClick={() => navigate('/lider/leads')}
                  className="w-full text-xs text-blue-500 hover:text-blue-700 font-medium pt-1 text-center hover:underline">
                  Перейти к списку лидов →
                </button>
              </div>
            )}
          </div>

          {/* Conversion: записано → проведено */}
          {summary.meetingsScheduled > 0 && (
            <div className="card bg-blue-50/40 border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{t('dash.manager.schedToAtt')}</p>
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-blue-700 text-xl">{summary.schedToAttRate}%</span>
                    <span className="ml-2 text-gray-400">({summary.meetingsAttended} из {summary.meetingsScheduled} записанных)</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">лиды → записано</p>
                  <p className="font-semibold text-gray-700">{summary.leadsToSchedRate}%</p>
                </div>
              </div>
            </div>
          )}

          <ProgressBar value={summary.planCompletion} label={t('dash.manager.planCompletionMeetings')} />

          {/* Lider leaderboard — competitive ranking */}
          {rankingData?.ranking?.length > 0 && (
            <div className="card">
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900">{t('dash.lider.ranking')}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{t('dash.lider.rankingNote')}</p>
              </div>
              <div className="space-y-1.5">
                {rankingData.ranking.map((r: any, idx: number) => {
                  const isMe = r.id === rankingData.currentUserId
                  const medalCls = idx === 0 ? 'text-yellow-500 font-black' : idx === 1 ? 'text-gray-400 font-black' : idx === 2 ? 'text-amber-600 font-black' : 'text-gray-400 font-medium'
                  return (
                    <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isMe
                        ? 'bg-blue-50 border-2 border-blue-300 shadow-sm'
                        : 'bg-gray-50 border border-gray-100'
                    }`}>
                      <span className={`text-sm w-7 text-center shrink-0 ${medalCls}`}>{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold truncate ${isMe ? 'text-blue-800' : 'text-gray-800'}`}>{r.name}</span>
                          {isMe && <span className="text-xs font-bold text-blue-600 shrink-0">{t('dash.lider.rankMe')}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 relative h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 bg-gradient-to-r ${r.completion >= 75 ? 'from-emerald-400 to-green-600' : r.completion >= 50 ? 'from-yellow-300 to-amber-500' : 'from-red-400 to-rose-500'}`}
                              style={{ width: r.completion > 0 ? `max(${Math.min(100, r.completion)}%, 5px)` : '0%' }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
                          </div>
                          <span className={`text-xs font-bold w-10 text-right shrink-0 ${r.completion >= 75 ? 'text-green-600' : r.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {r.plan > 0 ? `${r.completion}%` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isMe ? 'text-blue-700' : 'text-gray-700'}`}>{r.meetingsAttended}</p>
                        <p className="text-xs text-gray-400">из {r.plan}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── GATEWAY ANALYTICS (for closer) ── */}
      {isCloser && gatewayAnalytics.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            {t('dash.gateway.title')}
          </h3>
          <GatewayAnalytics data={gatewayAnalytics} />
        </div>
      )}

      {/* ── Archive link (for closer) ── */}
      {isCloser && (
        <button
          onClick={() => navigate('/closer/archive')}
          className="w-full card flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
              <Archive className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Архив заявок</p>
              <p className="text-xs text-gray-400 mt-0.5">Отказники и заявки в работе</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 shrink-0" />
        </button>
      )}

      {/* AI Insights — manual only, no auto-load */}
      <AIInsights data={summary} period={params} autoLoad={false} />

      {/* Recent reports (history) — only for liders */}
      {!isCloser && recentReports?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">{t('dash.manager.history')}</h3>
          <div className="space-y-0">
            {recentReports.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-500 w-24 shrink-0">{format(new Date(r.date), 'd MMM', { locale: ru })}</span>
                {isCloser ? (
                  <div className="flex gap-4 text-right flex-wrap">
                    <span className="text-gray-500">{t('dash.rop.consultationsLabel')}: <span className="font-medium text-gray-900">{(r.data as any).consultations || 0}</span></span>
                    <span className="text-gray-500">{t('dash.rop.refusalsLabel')}: <span className="font-medium text-gray-900">{(r.data as any).refusals || 0}</span></span>
                  </div>
                ) : (
                  <div className="flex gap-6 text-right">
                    <span className="text-gray-500">{t('dash.manager.leadsLabel')} <span className="font-medium text-gray-900">{(r.data as any).leads || (r.data as any).leadsReceived || 0}</span></span>
                    <span className="text-gray-500">{t('dash.manager.qualLabel')} <span className="font-medium text-gray-900">{(r.data as any).qualifiedLeads || 0}</span></span>
                    <span className="text-gray-500">{t('dash.manager.attendedLabel')} <span className="font-medium text-gray-900">{(r.data as any).meetingsAttended || 0}</span></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
