import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { CheckCircle, Plus, Pencil, Trash2, ExternalLink, X, Check } from 'lucide-react'
import { useT } from '../i18n'

interface Sale {
  id: string
  amount: string
  paymentType: 'new_sale' | 'additional'
  paymentMethod: 'cash' | 'card' | 'credit' | 'installment'
  bank: string
  months: string
  crmLink: string
}

const BANKS = [
  'Kaspi Bank',
  'Halyk Bank',
  'Forte Bank',
  'Bank CenterCredit',
  'Jusan Bank',
  'Freedom Bank',
  'ATF Bank',
  'Нурбанк',
  'RBK Bank',
  'Bereke Bank',
  'Евразийский банк',
  'Другой',
]

const emptySale = (): Sale => ({
  id: String(Date.now() + Math.random()),
  amount: '',
  paymentType: 'new_sale',
  paymentMethod: 'card',
  bank: 'Kaspi Bank',
  months: '12',
  crmLink: '',
})

export default function ReportPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Closer: general metrics
  const [closer, setCloser] = useState({ clientsReceived: '', consultations: '', refusals: '', comment: '' })

  // Closer: individual sales
  const [sales, setSales] = useState<Sale[]>([])
  const [saleForm, setSaleForm] = useState<Sale | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Lider & Marketer
  const [lider, setLider] = useState({ leadsReceived: '', processed: '', qualifiedLeads: '', transferredToCloser: '', comment: '' })
  const [marketer, setMarketer] = useState({ adBudget: '', leadsCount: '', qualifiedLeads: '', comment: '' })

  const isCloser = user?.managerType === 'CLOSER'
  const isLider = user?.managerType === 'LIDER'
  const isMarketer = user?.role === 'MARKETER'

  const showBank = (method: string) => ['card', 'credit', 'installment'].includes(method)
  const showMonths = (method: string) => ['credit', 'installment'].includes(method)

  const openAdd = () => {
    setSaleForm(emptySale())
    setEditingId(null)
  }

  const openEdit = (sale: Sale) => {
    setSaleForm({ ...sale })
    setEditingId(sale.id)
  }

  const saveSale = () => {
    if (!saleForm || !saleForm.amount) return
    if (editingId) {
      setSales(prev => prev.map(s => s.id === editingId ? { ...saleForm, id: editingId } : s))
    } else {
      setSales(prev => [...prev, saleForm])
    }
    setSaleForm(null)
    setEditingId(null)
  }

  const deleteSale = (id: string) => setSales(prev => prev.filter(s => s.id !== id))

  const totalAmount = sales.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  const fmt = (n: number) => n.toLocaleString('ru')

  const PAYMENT_TYPE_LABELS: Record<string, string> = {
    new_sale: t('report.closer.newSale'),
    additional: t('report.closer.additional'),
  }
  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: t('report.closer.cash'),
    card: t('report.closer.card'),
    credit: t('report.closer.credit'),
    installment: t('report.closer.installment'),
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let type: string, data: any
      if (isCloser) {
        type = 'CLOSER'
        data = {
          clientsReceived: closer.clientsReceived,
          consultations: closer.consultations,
          refusals: closer.refusals,
          comment: closer.comment,
          salesCount: sales.length,
          salesAmount: totalAmount,
          sales: sales.map(s => ({
            id: s.id,
            amount: Number(s.amount),
            paymentType: s.paymentType,
            paymentMethod: s.paymentMethod,
            bank: showBank(s.paymentMethod) ? s.bank : null,
            months: showMonths(s.paymentMethod) ? Number(s.months) : null,
            crmLink: s.crmLink || null,
          })),
        }
      } else if (isLider) {
        type = 'LIDER'; data = { ...lider }
      } else {
        type = 'MARKETER'; data = { ...marketer }
      }

      await api.post('/reports', { date: todayStr, type, data, comment: data.comment, departmentId: user?.departmentId })
      setDone(true)
      setTimeout(() => navigate(-1), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || t('report.error'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="text-xl font-bold text-gray-900">{t('report.done')}</h2>
        <p className="text-gray-500">{t('report.redirect')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('report.title')}</h1>
      <p className="text-gray-500 text-sm mb-6">{t('report.date')} {today.toLocaleDateString('ru')}</p>

      <form onSubmit={submit} className="space-y-4">

        {/* ── CLOSER ── */}
        {isCloser && (
          <>
            {/* Daily metrics */}
            <div className="card space-y-4">
              <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide text-gray-500">{t('report.closer.statsDay')}</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">{t('report.closer.clients')}</label>
                  <input type="number" className="input" min="0" value={closer.clientsReceived}
                    onChange={e => setCloser(f => ({ ...f, clientsReceived: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">{t('report.closer.consultations')}</label>
                  <input type="number" className="input" min="0" value={closer.consultations}
                    onChange={e => setCloser(f => ({ ...f, consultations: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{t('report.closer.refusals')}</label>
                  <input type="number" className="input" min="0" value={closer.refusals}
                    onChange={e => setCloser(f => ({ ...f, refusals: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Sales section */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{t('report.closer.sales')}</h3>
                  {sales.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">{sales.length} сд. · ₸ {fmt(totalAmount)}</p>
                  )}
                </div>
                {!saleForm && (
                  <button type="button" onClick={openAdd}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    {t('report.closer.addSale')}
                  </button>
                )}
              </div>

              {/* List of added sales */}
              {sales.length > 0 && !saleForm && (
                <div className="space-y-2">
                  {sales.map((s) => (
                    <div key={s.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">₸ {fmt(Number(s.amount))}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.paymentType === 'new_sale' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {PAYMENT_TYPE_LABELS[s.paymentType]}
                          </span>
                          <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[s.paymentMethod]}</span>
                          {s.bank && showBank(s.paymentMethod) && (
                            <span className="text-xs text-gray-400">{s.bank}</span>
                          )}
                          {s.months && showMonths(s.paymentMethod) && (
                            <span className="text-xs text-gray-400">{s.months} мес.</span>
                          )}
                        </div>
                        {s.crmLink && (
                          <a href={s.crmLink} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline mt-1 max-w-xs">
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{s.crmLink}</span>
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 ml-3 flex-shrink-0">
                        <button type="button" onClick={() => openEdit(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteSale(s.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                    <span className="text-sm text-gray-500">{t('report.closer.total')}: {sales.length} сделок</span>
                    <span className="font-bold text-gray-900">₸ {fmt(totalAmount)}</span>
                  </div>
                </div>
              )}

              {sales.length === 0 && !saleForm && (
                <p className="text-sm text-gray-400 text-center py-6">{t('report.closer.noSales')}</p>
              )}

              {/* Inline sale form */}
              {saleForm && (
                <div className="p-4 border-2 border-blue-100 rounded-xl bg-blue-50/30 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700">
                    {editingId ? t('report.closer.editSale') : t('report.closer.newSaleTitle')}
                  </h4>

                  {/* Amount + Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('report.closer.amount')} *</label>
                      <input type="number" className="input" min="0" placeholder="0"
                        value={saleForm.amount}
                        onChange={e => setSaleForm(f => f ? { ...f, amount: e.target.value } : f)}
                        autoFocus />
                    </div>
                    <div>
                      <label className="label">{t('report.closer.saleType')}</label>
                      <select className="input" value={saleForm.paymentType}
                        onChange={e => setSaleForm(f => f ? { ...f, paymentType: e.target.value as any } : f)}>
                        <option value="new_sale">{t('report.closer.newSale')}</option>
                        <option value="additional">{t('report.closer.additional')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Payment method + Bank */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('report.closer.paymentMethod')}</label>
                      <select className="input" value={saleForm.paymentMethod}
                        onChange={e => {
                          const method = e.target.value as Sale['paymentMethod']
                          setSaleForm(f => f ? {
                            ...f,
                            paymentMethod: method,
                            months: showMonths(method) ? (f.months || '12') : '',
                          } : f)
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

                  {/* Months (credit/installment only) */}
                  {showMonths(saleForm.paymentMethod) && (
                    <div>
                      <label className="label">{t('report.closer.months')}</label>
                      <div className="flex gap-2">
                        {['6', '12', '24', '36'].map(m => (
                          <button key={m} type="button"
                            onClick={() => setSaleForm(f => f ? { ...f, months: m } : f)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              saleForm.months === m
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                            }`}>
                            {m} мес.
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CRM Link */}
                  <div>
                    <label className="label">{t('report.closer.crmLink')}</label>
                    <input type="url" className="input" placeholder="https://..."
                      value={saleForm.crmLink}
                      onChange={e => setSaleForm(f => f ? { ...f, crmLink: e.target.value } : f)} />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button type="button"
                      onClick={() => { setSaleForm(null); setEditingId(null) }}
                      className="btn-secondary flex items-center gap-1.5 flex-1 justify-center py-2">
                      <X className="w-3.5 h-3.5" /> Отмена
                    </button>
                    <button type="button" onClick={saveSale}
                      disabled={!saleForm.amount}
                      className="btn-primary flex items-center gap-1.5 flex-1 justify-center py-2 disabled:opacity-40">
                      <Check className="w-3.5 h-3.5" /> Сохранить
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Comment */}
            <div className="card">
              <label className="label">{t('common.comment')}</label>
              <textarea className="input" rows={3} value={closer.comment}
                onChange={e => setCloser(f => ({ ...f, comment: e.target.value }))}
                placeholder={t('report.closer.commentPlaceholder')} />
            </div>
          </>
        )}

        {/* ── LIDER ── */}
        {isLider && (
          <div className="card space-y-4">
            <div><label className="label">{t('report.lider.leadsReceived')}</label><input type="number" className="input" min="0" value={lider.leadsReceived} onChange={e => setLider(f => ({ ...f, leadsReceived: e.target.value }))} required /></div>
            <div><label className="label">{t('report.lider.processed')}</label><input type="number" className="input" min="0" value={lider.processed} onChange={e => setLider(f => ({ ...f, processed: e.target.value }))} /></div>
            <div><label className="label">{t('report.lider.qualified')}</label><input type="number" className="input" min="0" value={lider.qualifiedLeads} onChange={e => setLider(f => ({ ...f, qualifiedLeads: e.target.value }))} required /></div>
            <div><label className="label">{t('report.lider.transferred')}</label><input type="number" className="input" min="0" value={lider.transferredToCloser} onChange={e => setLider(f => ({ ...f, transferredToCloser: e.target.value }))} /></div>
            <div><label className="label">{t('common.comment')}</label><textarea className="input" rows={3} value={lider.comment} onChange={e => setLider(f => ({ ...f, comment: e.target.value }))} placeholder={t('report.lider.commentPlaceholder')} /></div>
          </div>
        )}

        {/* ── MARKETER ── */}
        {isMarketer && (
          <div className="card space-y-4">
            <div><label className="label">{t('report.marketer.budget')}</label><input type="number" className="input" min="0" value={marketer.adBudget} onChange={e => setMarketer(f => ({ ...f, adBudget: e.target.value }))} required /></div>
            <div><label className="label">{t('report.marketer.leads')}</label><input type="number" className="input" min="0" value={marketer.leadsCount} onChange={e => setMarketer(f => ({ ...f, leadsCount: e.target.value }))} required /></div>
            <div><label className="label">{t('report.marketer.qualified')}</label><input type="number" className="input" min="0" value={marketer.qualifiedLeads} onChange={e => setMarketer(f => ({ ...f, qualifiedLeads: e.target.value }))} /></div>
            <div><label className="label">{t('common.comment')}</label><textarea className="input" rows={3} value={marketer.comment} onChange={e => setMarketer(f => ({ ...f, comment: e.target.value }))} placeholder={t('report.marketer.commentPlaceholder')} /></div>
          </div>
        )}

        {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2 pb-8">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? t('report.submitting') : t('report.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
