import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { usePeriodStore } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import { FileText, CheckCircle, Plus, Pencil, Trash2, ExternalLink, X, Check, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useT } from '../i18n'

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

export default function ManagerDashboard() {
  const { t } = useT()
  const { period } = usePeriodStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Sales date selector
  const [salesDate, setSalesDate] = useState(todayStr)
  const isToday = salesDate === todayStr

  // Main dashboard data
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-manager', period],
    queryFn: () => api.get(`/dashboard/manager?period=${period}`).then(r => r.data),
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
    if (!saleForm || !saleForm.amount) return
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

  const { summary, todayReport, recentReports, type } = data
  const isCloser = type === 'CLOSER'
  const todayData = todayReport?.data as any

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dash.manager.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isCloser ? t('role.closer') : t('role.lider')}</p>
        </div>
        <div>
          {todayReport ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded-lg text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              {t('dash.manager.reportDone')}
            </div>
          ) : (
            <button onClick={() => navigate('/report')} className="btn-primary flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('dash.manager.fillReport')}
            </button>
          )}
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
            <StatCard label={t('dash.conversion')} value={`${summary.conversion}%`} />
            <StatCard label={t('dash.avgCheck')} value={`₸ ${fmt(summary.avgCheck)}`} />
            <StatCard label={t('dash.consultations')} value={summary.consultations ?? 0} />
            <StatCard label={t('dash.refusals')} value={summary.refusals ?? 0} color="red" />
            <StatCard label={t('dash.inWork')} value={summary.inWork ?? 0} color="yellow" />
          </div>

          <ProgressBar value={summary.planCompletion} label={t('dash.manager.planCompletionSales')} />

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
                  <label className="label">{t('report.closer.crmLink')}</label>
                  <input type="url" className="input" placeholder="https://..."
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
                  <button onClick={saveSale} disabled={!saleForm.amount || createSale.isPending || updateSale.isPending}
                    className="btn-primary flex items-center gap-1.5 flex-1 justify-center py-2 disabled:opacity-40">
                    <Check className="w-3.5 h-3.5" /> Сохранить
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats from today's report (if submitted) */}
          {todayData && (
            <div className="card border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">{t('dash.manager.today')} — статистика</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">{t('dash.manager.clients')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.clientsReceived || 0}</p></div>
                <div><p className="text-xs text-gray-400">{t('dash.manager.consultations')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.consultations || 0}</p></div>
                <div><p className="text-xs text-gray-400">{t('report.closer.refusals')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.refusals || 0}</p></div>
              </div>
              {todayData.comment && (
                <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">💬 {todayData.comment}</p>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Lider stats — primary KPI: meetings scheduled */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <StatCard label={t('dash.manager.meetingsPlan')} value={summary.meetingsScheduledPlan} />
            <StatCard label={t('dash.manager.meetings')} value={summary.meetingsScheduled} color="blue" />
            <StatCard label={t('dash.completion')} value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
            <StatCard label={t('dash.manager.attended')} value={summary.meetingsAttended} />
            <StatCard label={t('dash.manager.qualified')} value={summary.qualifiedLeads} sub={`${summary.qualRate}% квал.`} />
            <StatCard label={t('dash.manager.leads')} value={summary.leads} sub={summary.leadsplan > 0 ? `план ${summary.leadsplan}` : undefined} />
          </div>
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
        </>
      )}

      {/* Recent reports (history) */}
      {recentReports?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">{t('dash.manager.history')}</h3>
          <div className="space-y-0">
            {recentReports.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-500 w-24 shrink-0">{format(new Date(r.date), 'd MMM', { locale: ru })}</span>
                {isCloser ? (
                  <div className="flex gap-6 text-right">
                    <span className="text-gray-500">{t('dash.manager.dealsLabel')} <span className="font-medium text-gray-900">{(r.data as any).salesCount || 0}</span></span>
                    <span className="text-gray-500">{t('dash.manager.amountLabel')} <span className="font-medium text-gray-900">₸ {fmt(Number((r.data as any).salesAmount) || 0)}</span></span>
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
