import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import { Plus, Pencil, Trash2, ExternalLink, X, Check, Download, ChevronRight, Archive } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useT } from '../i18n'
import { useAuthStore } from '../store/auth'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'

function fmt(n: number) { return n.toLocaleString('ru') }

interface Sale {
  id?: string
  amount: string
  paymentType: 'new_sale' | 'additional'
  paymentMethod: 'cash' | 'card' | 'credit' | 'installment'
  bank: string
  months: string
  crmLink: string
  comment: string
}

const BANKS = [
  'Kaspi Bank', 'Halyk Bank', 'Forte Bank', 'Bank CenterCredit',
  'Jusan Bank', 'Freedom Bank', 'ATF Bank', 'Нурбанк', 'RBK Bank',
  'Bereke Bank', 'Евразийский банк', 'Другой',
]

const emptySale = (): Sale => ({
  amount: '', paymentType: 'new_sale', paymentMethod: 'card',
  bank: 'Kaspi Bank', months: '12', crmLink: '', comment: '',
})

const showBank = (m: string) => ['card', 'credit', 'installment'].includes(m)
const showMonths = (m: string) => ['credit', 'installment'].includes(m)

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayStr = localDateStr(new Date())

const PAYMENT_TYPE_LABEL: Record<string, string> = { new_sale: 'Новая', additional: 'Доплата' }
const PAYMENT_METHOD_LABEL: Record<string, string> = { cash: 'Нал', card: 'Безнал', credit: 'Кредит', installment: 'Рассрочка' }

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

export default function ManagerDashboard() {
  const { t } = useT()
  const periodStore = usePeriodStore()
  const { period } = periodStore
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Sales date selector
  const [salesDate, setSalesDate] = useState(todayStr)
  const isToday = salesDate === todayStr

  // Main dashboard data
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-manager', period],
    queryFn: () => api.get(`/dashboard/manager?period=${period}`).then(r => r.data),
    refetchInterval: 60000,
  })

  // Lider ranking (only used for lider view — shows competitive leaderboard)
  const { data: rankingData } = useQuery({
    queryKey: ['lider-ranking', period],
    queryFn: () => api.get(`/dashboard/lider-ranking?period=${period}`).then(r => r.data),
    refetchInterval: 60000,
  })

  // Closer ranking (only used for closer view — shows competitive leaderboard)
  const { data: closerRankingData } = useQuery({
    queryKey: ['closer-ranking', period],
    queryFn: () => api.get(`/dashboard/closer-ranking?period=${period}`).then(r => r.data),
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
    setSaleForm({ amount: String(s.amount), paymentType: s.paymentType, paymentMethod: s.paymentMethod, bank: s.bank || 'Kaspi Bank', months: String(s.months || '12'), crmLink: s.crmLink || '', comment: s.comment || '' })
    setEditingId(s.id)
  }

  const saveSale = () => {
    if (!saleForm || !saleForm.amount || !saleForm.crmLink) return
    const payload = {
      date: salesDate,
      amount: Number(saleForm.amount),
      paymentType: saleForm.paymentType,
      paymentMethod: saleForm.paymentMethod,
      bank: showBank(saleForm.paymentMethod) ? saleForm.bank : null,
      months: showMonths(saleForm.paymentMethod) ? Number(saleForm.months) : null,
      crmLink: saleForm.crmLink || null,
      comment: saleForm.comment || null,
    }
    if (editingId) updateSale.mutate({ id: editingId, data: payload })
    else createSale.mutate(payload)
  }

  const totalToday = (todaySales as any[]).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0)

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>
  if (!data) return null

  const { summary, todayReport, recentReports, periodSales: periodSalesData = [], type } = data
  const isCloser = type === 'CLOSER'
  const todayData = todayReport?.data as any

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dash.manager.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isCloser ? t('role.closer') : t('role.lider')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadExport('manager', buildPeriodParams(periodStore))}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            title="Скачать отчёт Excel"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Экспорт</span>
          </button>
          {/* Closer/Lider no longer fill daily reports */}
        </div>
      </div>

      {isCloser ? (
        <>
          {/* Period stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            <StatCard label={t('dash.manager.salesPlan')} value={`₸ ${fmt(summary.salesPlan)}`} />
            <StatCard label={t('dash.manager.salesPeriod')} value={`₸ ${fmt(summary.salesAmount)}`} color="blue" />
            <StatCard label={t('dash.completion')} value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
            <StatCard label={t('dash.manager.deals')} value={summary.salesCount} />
            <StatCard label={t('dash.conversion')} value={`${summary.leadConversion ?? summary.conversion}%`} />
            <StatCard label={t('dash.avgCheck')} value={`₸ ${fmt(summary.avgCheck)}`} />
          </div>

          {/* Lead-based stats for closer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div onClick={() => navigate('/closer/leads')} className="card cursor-pointer group transition-all hover:shadow-md hover:border-blue-200 hover:bg-blue-50/40 border border-transparent">
              <p className="text-xs font-medium text-gray-400 group-hover:text-blue-500 transition-colors uppercase tracking-wide mb-1">Входящих</p>
              <p className="text-2xl font-bold text-blue-600">{summary.pendingLeadsCount ?? 0}</p>
              <p className="text-xs text-gray-300 group-hover:text-blue-400 mt-1 transition-colors">новые заявки</p>
            </div>
            <div onClick={() => navigate('/closer/leads')} className="card cursor-pointer group transition-all hover:shadow-md hover:border-amber-200 hover:bg-amber-50/40 border border-transparent">
              <p className="text-xs font-medium text-gray-400 group-hover:text-amber-500 transition-colors uppercase tracking-wide mb-1">В работе</p>
              <p className="text-2xl font-bold text-amber-500">{summary.inWorkLeadsCount ?? 0}</p>
              <p className="text-xs text-gray-300 group-hover:text-amber-400 mt-1 transition-colors">активных</p>
            </div>
            <div onClick={() => navigate('/closer/archive')} className="card cursor-pointer group transition-all hover:shadow-md hover:border-red-100 hover:bg-red-50/30 border border-transparent">
              <p className="text-xs font-medium text-gray-400 group-hover:text-red-500 transition-colors uppercase tracking-wide mb-1">Отказы</p>
              <p className="text-2xl font-bold text-red-500">{summary.leadRefusedCount ?? 0}</p>
              <p className="text-xs text-gray-300 group-hover:text-red-400 mt-1 transition-colors">за период</p>
            </div>
            <div onClick={() => navigate('/closer/tasks')} className="card cursor-pointer group transition-all hover:shadow-md hover:border-purple-200 hover:bg-purple-50/40 border border-transparent">
              <p className="text-xs font-medium text-gray-400 group-hover:text-purple-500 transition-colors uppercase tracking-wide mb-1">Задач</p>
              <p className="text-2xl font-bold text-purple-600">{summary.pendingTasksCount ?? 0}</p>
              <p className="text-xs text-gray-300 group-hover:text-purple-400 mt-1 transition-colors">ожидает</p>
            </div>
          </div>

          <ProgressBar value={summary.planCompletion} label={t('dash.manager.planCompletionSales')} />

          {/* Closer leaderboard — competitive ranking */}
          {closerRankingData?.ranking?.length > 0 && (
            <div className="card">
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900">Рейтинг клоузеров</h3>
                <p className="text-xs text-gray-400 mt-0.5">Соревнуйся с коллегами — твоё место в команде</p>
              </div>
              <div className="space-y-1.5">
                {closerRankingData.ranking.map((r: any, idx: number) => {
                  const isMe = r.id === closerRankingData.currentUserId
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
                  return (
                    <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isMe
                        ? 'bg-blue-50 border-2 border-blue-300 shadow-sm'
                        : 'bg-gray-50 border border-gray-100'
                    }`}>
                      <span className="text-base w-7 text-center shrink-0">{medal}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold truncate ${isMe ? 'text-blue-800' : 'text-gray-800'}`}>{r.name}</span>
                          {isMe && <span className="text-xs font-bold text-blue-600 shrink-0">← Ты здесь</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${r.completion >= 75 ? 'bg-green-500' : r.completion >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(100, r.completion)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold w-12 text-right shrink-0 ${r.completion >= 75 ? 'text-green-600' : r.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
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
                    {(periodSalesData as any[]).length} сд. · ₸ {fmt((periodSalesData as any[]).reduce((s: number, x: any) => s + Number(x.amount), 0))}
                  </p>
                )}
              </div>
            </div>
            {(periodSalesData as any[]).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">{t('dash.noSalesPeriod')}</p>
            ) : (
              <div className="space-y-2">
                {(periodSalesData as any[]).map((s: any) => (
                  <div key={s.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {s.leadId ? (
                          <>
                            <span className="text-xs text-gray-400 shrink-0">Заявка: {new Date(s.date + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
                            <span className="text-xs text-gray-400 shrink-0">· Продажа: {new Date(s.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 w-16 shrink-0">{new Date(s.date + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
                        )}
                        <span className="font-bold text-gray-900">₸ {fmt(Number(s.amount))}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.paymentType === 'new_sale' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {PAYMENT_TYPE_LABEL[s.paymentType]}
                        </span>
                        <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABEL[s.paymentMethod]}</span>
                        {s.bank && showBank(s.paymentMethod) && <span className="text-xs text-gray-400">{s.bank}</span>}
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
                      <button onClick={() => { if (confirm('Удалить продажу?')) deleteSale.mutate(s.id) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── TODAY'S SALES ── entered throughout the day */}
          <div className="card">
            <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {t('report.closer.sales')} {isToday ? 'сегодня' : new Date(salesDate + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
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
                        <span className="font-bold text-gray-900">₸ {fmt(Number(s.amount))}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.paymentType === 'new_sale' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {PAYMENT_TYPE_LABEL[s.paymentType]}
                        </span>
                        <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABEL[s.paymentMethod]}</span>
                        {s.bank && showBank(s.paymentMethod) && <span className="text-xs text-gray-400">{s.bank}</span>}
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
                  <span className="text-gray-500">{t('report.closer.total')}: {(todaySales as any[]).length} сделок</span>
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
                    <select className="input" value={saleForm.paymentType}
                      onChange={e => setSaleForm(f => f ? { ...f, paymentType: e.target.value as any } : f)}>
                      <option value="new_sale">{t('report.closer.newSale')}</option>
                      <option value="additional">{t('report.closer.additional')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{t('report.closer.paymentMethod')}</label>
                    <select className="input" value={saleForm.paymentMethod}
                      onChange={e => {
                        const m = e.target.value as Sale['paymentMethod']
                        setSaleForm(f => f ? { ...f, paymentMethod: m, months: showMonths(m) ? (f.months || '12') : '' } : f)
                      }}>
                      <option value="cash">{t('report.closer.cash')}</option>
                      <option value="card">{t('report.closer.card')}</option>
                      <option value="credit">{t('report.closer.credit')}</option>
                      <option value="installment">{t('report.closer.installment')}</option>
                    </select>
                  </div>
                  {showBank(saleForm.paymentMethod) && (
                    <div>
                      <label className="label">{t('report.closer.bank')}</label>
                      <select className="input" value={saleForm.bank}
                        onChange={e => setSaleForm(f => f ? { ...f, bank: e.target.value } : f)}>
                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  )}
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
                  <textarea className="input" rows={2} placeholder="Заметки по сделке..."
                    value={saleForm.comment}
                    onChange={e => setSaleForm(f => f ? { ...f, comment: e.target.value } : f)} />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setSaleForm(null); setEditingId(null) }}
                    className="btn-secondary flex items-center gap-1.5 flex-1 justify-center py-2">
                    <X className="w-3.5 h-3.5" /> Отмена
                  </button>
                  <button onClick={saveSale} disabled={!saleForm.amount || !saleForm.crmLink || createSale.isPending || updateSale.isPending}
                    className="btn-primary flex items-center gap-1.5 flex-1 justify-center py-2 disabled:opacity-40" title={!saleForm?.crmLink ? 'Заполните ссылку CRM' : ''}>
                    <Check className="w-3.5 h-3.5" /> Сохранить
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
              <p className="text-sm font-semibold text-gray-700 group-hover:text-blue-700 transition-colors">Перейти к лидам</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {summary.newCount > 0 && <span className="text-blue-600 font-medium mr-2">{summary.newCount} активных</span>}
                {summary.assignedCount > 0 && <span className="text-purple-600 font-medium mr-2">{summary.assignedCount} передано</span>}
                {summary.unqualifiedCount > 0 && <span className="text-gray-500 font-medium">{summary.unqualifiedCount} неквал.</span>}
                {!summary.newCount && !summary.assignedCount && !summary.unqualifiedCount && 'Нет активных лидов'}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
          </div>

          {/* Lider stats — primary KPI: consultations conducted */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            <StatCard label={t('dash.manager.meetingsPlan')} value={summary.meetingsScheduledPlan} />
            <StatCard label={t('dash.manager.attended')} value={summary.meetingsAttended} color="blue" />
            <StatCard label={t('dash.completion')} value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
            <StatCard label={t('dash.manager.meetings')} value={summary.meetingsScheduled} />
            <StatCard label={t('dash.manager.qualified')} value={summary.qualifiedLeads} sub={`${summary.qualRate}% квал.`} />
            <StatCard label={t('dash.manager.leads')} value={summary.leads} sub={summary.leadsplan > 0 ? `план ${summary.leadsplan}` : undefined} />
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

          {todayData && (
            <div className="card border-purple-100 bg-purple-50/30">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">{t('dash.manager.today')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">{t('dash.manager.leads')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.leads || todayData.leadsReceived || 0}</p></div>
                <div><p className="text-xs text-gray-400">{t('dash.manager.qualified')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.qualifiedLeads || 0}</p></div>
                <div><p className="text-xs text-gray-400">{t('dash.manager.meetings')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.meetingsScheduled || 0}</p></div>
                <div><p className="text-xs text-gray-400">{t('dash.manager.attended')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.meetingsAttended || 0}</p></div>
              </div>
              {todayData.comment && <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-purple-100">💬 {todayData.comment}</p>}
            </div>
          )}

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
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
                  return (
                    <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isMe
                        ? 'bg-blue-50 border-2 border-blue-300 shadow-sm'
                        : 'bg-gray-50 border border-gray-100'
                    }`}>
                      <span className="text-base w-7 text-center shrink-0">{medal}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold truncate ${isMe ? 'text-blue-800' : 'text-gray-800'}`}>{r.name}</span>
                          {isMe && <span className="text-xs font-bold text-blue-600 shrink-0">{t('dash.lider.rankMe')}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {/* Progress bar */}
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${r.completion >= 75 ? 'bg-green-500' : r.completion >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(100, r.completion)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold w-12 text-right shrink-0 ${r.completion >= 75 ? 'text-green-600' : r.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
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
