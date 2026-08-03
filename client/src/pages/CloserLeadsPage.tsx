import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import { useT } from '../i18n'
import { Phone, Calendar, User, ChevronDown, ChevronUp, Check, X, CheckSquare, Plus, ExternalLink, Banknote, Pencil, Package, ArrowRightLeft, CheckCircle2, XCircle, RefreshCw, AlertTriangle, RotateCcw, Trash2, ArchiveRestore } from 'lucide-react'

type Lead = {
  id: string
  clientName: string
  phone: string
  date: string
  createdAt: string
  isQualified: boolean
  isScheduled: boolean
  comment: string | null
  status: string
  subStatus: string | null
  appointmentDate: string | null
  appointmentTime: string | null
  consultationStatus: string | null
  postponedDate: string | null
  postponedTime: string | null
  salesChannel: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  assignedTo: { id: string; name: string } | null
  tasks: { id: string; title: string; dueDate: string; completed: boolean }[]
  amount: number | null
  netAmount: number | null
  paymentType: string | null
  paymentMethod: string | null
  bank: string | null
  months: number | null
  crmLink: string | null
  closerComment: string | null
  isRefund: boolean
  refundComment: string | null
  refundAmount: number | null
  deletedAt: string | null
}

// Payment type options — built inside components using t()


// Static fallback gateways (used if API not loaded yet)
const DEFAULT_GATEWAYS = [
  { value: 'GetPay',            label: 'GetPay',                                    fee: 0.13 },
  { value: 'TipTopPay_KZ',      label: 'Tip Top Pay (карта КЗ)',                    fee: 0.065 },
  { value: 'TipTopPay_Foreign', label: 'Tip Top Pay (карта зарубежного банка)',      fee: 0.079 },
  { value: 'Kaspi_Gold',        label: 'Каспи Пэй (GOLD)',                          fee: 0.0395 },
  { value: 'Kaspi_Account',     label: 'Каспи Пэй (Счет в Kaspi Pay)',              fee: 0.041 },
  { value: 'Kaspi_Credit',      label: 'Каспи Пэй (CREDIT)',                        fee: 0.165 },
  { value: 'Kaspi_Red',         label: 'Каспи Пэй (RED)',                           fee: 0.143 },
  { value: 'Kaspi_Terminal',    label: 'Apple Pay / Google Pay Терминал Каспи',     fee: 0.043 },
  { value: 'Cash',              label: 'Наличные',                                  fee: 0.03 },
  { value: 'Transfer_AE',       label: 'Перевод на карту АЕ',                       fee: 0.03 },
  { value: 'Card_Sberbank',     label: 'Карта / СберБанк',                          fee: 0.03 },
  { value: 'Kaspi_Bookkeeper',  label: 'Каспи счет (через бухгалтера)',              fee: 0.03 },
]

type GatewayItem = { value: string; label: string; fee: number }

function apiToGateway(g: any): GatewayItem { return { value: g.value, label: g.name, fee: g.feePct } }

function calcNetAmount(amount: number, gateway: string, gateways: GatewayItem[]) {
  const fee = gateways.find(g => g.value === gateway)?.fee ?? 0.03
  return Math.round(amount * (1 - fee) * 100) / 100
}

// Gateway label lookup — searches ALL gateways including inactive (for historical display)
function gatewayLabel(value: string | null, gateways: GatewayItem[]) {
  if (!value) return '—'
  return gateways.find(g => g.value === value)?.label ?? value
}

// Hook to get gateways from cache (active only for dropdown, all for labels)
function useGateways() {
  const { data } = useQuery<any[]>({
    queryKey: ['payment-gateways'],
    queryFn: () => api.get('/payment-gateways').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const all: GatewayItem[] = data?.length ? data.map(apiToGateway) : DEFAULT_GATEWAYS
  const active: GatewayItem[] = data?.length ? data.filter((g: any) => g.isActive).map(apiToGateway) : DEFAULT_GATEWAYS
  return { all, active }
}

function fmtDate(s: string) {
  if (!s) return ''
  return new Date(s + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function isOverdue(dueDate: string) {
  return dueDate < new Date().toISOString().slice(0, 10)
}

// ── Transfer Modal ─────────────────────────────────────────────────────────────
function TransferModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient()
  const { t } = useT()
  const [newCloserId, setNewCloserId] = useState('')
  const [error, setError] = useState('')

  const { data: closers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['closers-list'],
    queryFn: () => api.get('/users/closers').then(r => r.data),
  })

  const transferMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/transfer`, { newCloserId }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-leads'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || t('common.error')),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-1">{t('cl.transfer.title')}</h3>
        <p className="text-sm text-gray-500 mb-4">{lead.clientName}</p>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">{t('cl.transfer.chooseCloser')}</label>
          <select className="input" value={newCloserId} onChange={e => setNewCloserId(e.target.value)} autoFocus>
            <option value="">{t('cl.transfer.placeholder')}</option>
            {closers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 btn-outline">{t('common.cancel')}</button>
          <button
            onClick={() => { if (!newCloserId) return setError(t('cl.transfer.error')); transferMut.mutate() }}
            disabled={transferMut.isPending}
            className="flex-1 btn-primary"
          >
            {t('cl.transfer.btn')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Task Modal ────────────────────────────────────────────────────────────
function AddTaskModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { t } = useT()
  const today = new Date().toISOString().slice(0, 10)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(today)
  const [error, setError] = useState('')

  const createTask = useMutation({
    mutationFn: () => api.post('/lead-tasks', { leadId, title, dueDate }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-leads'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || t('common.error')),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4">{t('cl.addTask.title')}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">{t('cl.addTask.label')}</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t('cl.addTask.placeholder')} autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">{t('cl.addTask.due')}</label>
            <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 btn-outline">{t('common.cancel')}</button>
          <button onClick={() => { if (!title.trim()) return setError(t('common.error')); createTask.mutate() }}
            disabled={createTask.isPending} className="flex-1 btn-primary">
            {t('cl.addTask.btn')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Lead Modal ───────────────────────────────────────────────────────────
function EditLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient()
  const { t } = useT()
  const { all: allGateways, active: activeGateways } = useGateways()
  const [form, setForm] = useState({
    amount: lead.amount ? String(lead.amount) : '',
    paymentType: lead.paymentType || 'new_sale',
    paymentMethod: lead.paymentMethod || '',
    bank: lead.bank || '',
    months: lead.months ? String(lead.months) : '',
    crmLink: lead.crmLink || '',
    closerComment: lead.closerComment || '',
  })
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const paymentTypes = [
    { value: 'new_sale',   label: t('cl.payType.new') },
    { value: 'additional', label: t('cl.payType.additional') },
    { value: 'refund',     label: t('cl.payType.refund') },
  ]

  const selectedGateway = allGateways.find(g => g.value === form.paymentMethod)
  const numAmount = Number(form.amount) || 0
  const feePercent = selectedGateway ? Math.round(selectedGateway.fee * 1000) / 10 : null
  const netAmount = selectedGateway && numAmount > 0 ? calcNetAmount(numAmount, form.paymentMethod, allGateways) : null

  const saveMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}`, {
      ...form,
      amount: form.amount ? Number(form.amount) : null,
      months: form.months ? Number(form.months) : null,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-leads'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || t('common.error')),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4">{t('cl.edit.title')} — {lead.clientName}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">{t('cl.inwork.payType')}</label>
            <select className="input" value={form.paymentType} onChange={e => set('paymentType', e.target.value)}>
              {paymentTypes.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">{t('cl.inwork.amount')}</label>
            <input type="number" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1">{t('cl.inwork.gateway')}</label>
            <select className="input" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
              <option value="">{t('cl.inwork.gatewayPlaceholder')}</option>
              {activeGateways.map(g => (
                <option key={g.value} value={g.value}>{g.label} ({Math.round(g.fee * 1000) / 10}%)</option>
              ))}
            </select>
          </div>
          {selectedGateway && numAmount > 0 && (
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                <p className="text-[11px] text-amber-600 font-semibold">{t('cl.inwork.feeLabel')}</p>
                <p className="text-lg font-bold text-amber-700">{feePercent}%</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
                <p className="text-[11px] text-green-600 font-semibold">{t('cl.inwork.dealBudget')}</p>
                <p className="text-lg font-bold text-green-700">₸ {netAmount?.toLocaleString('ru')}</p>
              </div>
            </div>
          )}
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1">{t('cl.inwork.crmLink')}</label>
            <input type="url" className="input" value={form.crmLink} onChange={e => set('crmLink', e.target.value)} placeholder="https://..." />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1">{t('cl.inwork.comment')}</label>
            <textarea className="input resize-none h-16" value={form.closerComment} onChange={e => set('closerComment', e.target.value)} placeholder={t('cl.inwork.commentPlaceholder')} />
          </div>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 btn-outline">{t('common.cancel')}</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1 btn-primary">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Refund Button component ───────────────────────────────────────────────────
function RefundButton({ lead }: { lead: Lead }) {
  const qc = useQueryClient()
  const { t } = useT()
  const [show, setShow] = useState(false)
  const [comment, setComment] = useState('')
  const [refundAmount, setRefundAmount] = useState(lead.amount ? String(lead.amount) : '')
  const refundMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/refund`, {
      refundComment: comment,
      refundAmount: refundAmount ? Number(refundAmount) : null,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-leads'] }); setShow(false) },
  })
  if (!show) return (
    <button onClick={() => setShow(true)}
      className="flex items-center gap-1.5 text-sm text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg font-medium transition-colors w-full justify-center">
      <RotateCcw className="w-4 h-4" /> {t('cl.refund.btn')}
    </button>
  )
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
      <div>
        <p className="text-xs font-semibold text-orange-700 mb-1">{t('cl.refund.amountLabel')}</p>
        <input type="number" className="input text-sm" value={refundAmount}
          onChange={e => setRefundAmount(e.target.value)} placeholder="0" />
      </div>
      <div>
        <p className="text-xs font-semibold text-orange-700 mb-1">{t('cl.refund.reasonLabel')}</p>
        <input className="input text-sm" value={comment} onChange={e => setComment(e.target.value)} placeholder={t('cl.refund.reasonPlaceholder')} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => refundMut.mutate()} disabled={refundMut.isPending}
          className="flex-1 bg-orange-500 text-white text-xs font-semibold py-2 rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors">
          {t('cl.refund.confirm')}
        </button>
        <button onClick={() => setShow(false)} className="px-3 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}

// ── In-Work Section (combined sell form + refuse + task) ──────────────────────
function InWorkSection({ lead }: { lead: Lead }) {
  const qc = useQueryClient()
  const { t } = useT()
  const { all: allGateways, active: activeGateways } = useGateways()
  const [form, setForm] = useState({
    amount: lead.amount ? String(lead.amount) : '',
    paymentType: lead.paymentType || 'new_sale',
    paymentMethod: lead.paymentMethod || '',
    bank: lead.bank || '',
    months: lead.months ? String(lead.months) : '',
    crmLink: lead.crmLink || '',
    closerComment: lead.closerComment || '',
  })
  const [productId, setProductId] = useState<string>('')
  const [lossReasonId, setLossReasonId] = useState<string>('')
  const [error, setError] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const paymentTypes = [
    { value: 'new_sale',   label: t('cl.payType.new') },
    { value: 'additional', label: t('cl.payType.additional') },
    { value: 'refund',     label: t('cl.payType.refund') },
  ]

  // Derived fee/netAmount display
  const selectedGateway = allGateways.find(g => g.value === form.paymentMethod)
  const numAmount = Number(form.amount) || 0
  const feePercent = selectedGateway ? Math.round(selectedGateway.fee * 1000) / 10 : null
  const netAmount = selectedGateway && numAmount > 0 ? calcNetAmount(numAmount, form.paymentMethod, allGateways) : null

  // Fetch products for selector
  const { data: products = [] } = useQuery<{ id: string; name: string; price: number }[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then(r => r.data),
  })

  // Fetch loss reasons for selector
  const { data: lossReasons = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['loss-reasons'],
    queryFn: () => api.get('/loss-reasons').then(r => r.data),
  })

  // When product is selected, auto-fill the price if amount is empty
  const handleProductChange = (pid: string) => {
    setProductId(pid)
    if (pid) {
      const prod = products.find(p => p.id === pid)
      if (prod && !form.amount) {
        setForm(f => ({ ...f, amount: String(prod.price) }))
      }
    }
  }

  const sellMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/sell`, {
      ...form,
      amount: Number(form.amount),
      months: form.months ? Number(form.months) : null,
      productId: productId || null,
    }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-leads'] }),
    onError: (e: any) => setError(e.response?.data?.error || t('common.error')),
  })

  const saveMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}`, {
      ...form,
      amount: form.amount ? Number(form.amount) : null,
      months: form.months ? Number(form.months) : null,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-leads'] }); setError('') },
    onError: (e: any) => setError(e.response?.data?.error || t('common.error')),
  })

  const refuseMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/refuse`, {
      crmLink: form.crmLink,
      lossReasonId: lossReasonId || null,
    }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-leads'] }),
    onError: (e: any) => setError(e.response?.data?.error || t('common.error')),
  })

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('cl.inwork.header')}</p>
      <div className="grid grid-cols-2 gap-3">
        {/* Product selector */}
        {products.length > 0 && (
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> {t('cl.inwork.product')}
            </label>
            <select
              className="input"
              value={productId}
              onChange={e => handleProductChange(e.target.value)}
            >
              <option value="">{t('cl.inwork.productPlaceholder')}</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (₸ {p.price.toLocaleString('ru')})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Payment type */}
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">{t('cl.inwork.payType')}</label>
          <select className="input" value={form.paymentType} onChange={e => set('paymentType', e.target.value)}>
            {paymentTypes.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">{t('cl.inwork.amount')}</label>
          <input type="number" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
        </div>

        {/* Gateway selector */}
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-500 block mb-1">{t('cl.inwork.gateway')}</label>
          <select className="input" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
            <option value="">{t('cl.inwork.gatewayPlaceholder')}</option>
            {activeGateways.map(g => (
              <option key={g.value} value={g.value}>
                {g.label} — {Math.round(g.fee * 1000) / 10}%
              </option>
            ))}
          </select>
        </div>

        {/* Fee & Budget display */}
        {selectedGateway && numAmount > 0 && (
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[11px] text-amber-600 font-semibold uppercase tracking-wide">{t('cl.inwork.feeLabel')}</p>
              <p className="text-xl font-bold text-amber-700">{feePercent}%</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[11px] text-green-600 font-semibold uppercase tracking-wide">{t('cl.inwork.dealBudget')}</p>
              <p className="text-xl font-bold text-green-700">₸ {netAmount?.toLocaleString('ru')}</p>
            </div>
          </div>
        )}

        {/* CRM link */}
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-500 block mb-1">
            {t('cl.inwork.crmLink')} <span className="text-red-500">*</span>
            <span className="text-gray-400 font-normal ml-1">{t('cl.inwork.crmHint')}</span>
          </label>
          <input type="url" className="input" value={form.crmLink} onChange={e => set('crmLink', e.target.value)} placeholder="https://..." />
        </div>

        {/* Comment */}
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-500 block mb-1">{t('cl.inwork.comment')}</label>
          <textarea className="input resize-none h-16" value={form.closerComment} onChange={e => set('closerComment', e.target.value)} placeholder={t('cl.inwork.commentPlaceholder')} />
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Primary actions */}
      <div className="flex gap-2">
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="flex-1 btn-outline text-sm py-2">
          {t('cl.inwork.saveDraft')}
        </button>
        <button onClick={() => {
          setError('')
          if (!form.amount || !form.paymentMethod) return setError(t('cl.inwork.errorAmount'))
          if (!form.crmLink) return setError(t('cl.inwork.errorCrm'))
          if (products.length > 0 && !productId) return setError(t('cl.inwork.errorProduct'))
          sellMut.mutate()
        }} disabled={sellMut.isPending}
          className="flex-1 text-sm py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40">
          <Check className="w-4 h-4 inline mr-1" />{t('cl.inwork.closeSale')}
        </button>
      </div>

      {/* Возврат — only show for SOLD leads */}
      {lead.status === 'SOLD' && !lead.isRefund && (
        <div className="border-t border-gray-100 pt-3">
          <RefundButton lead={lead} />
        </div>
      )}
      {lead.isRefund && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-700 font-medium flex items-center gap-2">
          <RotateCcw className="w-4 h-4 shrink-0" />
          <div>
            <span>{t('cl.card.refundDone')}</span>
            {lead.amount && <span className="ml-2 font-bold">₸ {lead.amount.toLocaleString('ru')}</span>}
            {lead.refundComment && <p className="text-xs text-orange-500 mt-0.5">{lead.refundComment}</p>}
          </div>
        </div>
      )}

      {/* Secondary actions */}
      <div className="space-y-2 border-t border-gray-100 pt-3">
        {lossReasons.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">{t('cl.inwork.lossReason')}</label>
            <select
              className="input text-sm"
              value={lossReasonId}
              onChange={e => setLossReasonId(e.target.value)}
            >
              <option value="">{t('cl.inwork.lossReasonPlaceholder')}</option>
              {lossReasons.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setShowTaskForm(true)}
            className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors flex-1 justify-center"
          >
            <Plus className="w-4 h-4" /> {t('cl.inwork.keepInWork')}
          </button>
          <button
            onClick={() => {
              setError('')
              if (!form.crmLink) return setError(t('cl.inwork.errorCrmRefuse'))
              if (lossReasons.length > 0 && !lossReasonId) return setError(t('cl.inwork.errorLossReason'))
              refuseMut.mutate()
            }}
            disabled={refuseMut.isPending}
            className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" /> {t('cl.inwork.refuse')}
          </button>
        </div>
      </div>

      {showTaskForm && <AddTaskModal leadId={lead.id} onClose={() => setShowTaskForm(false)} />}
    </div>
  )
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
// ── Consultation Status Section ───────────────────────────────────────────────
function ConsultationStatusSection({ lead, compact = false }: { lead: Lead; compact?: boolean }) {
  const qc = useQueryClient()
  const { t } = useT()
  const today = new Date().toISOString().slice(0, 10)

  const [showPostpone, setShowPostpone] = useState(false)
  const tomorrowStr = () => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  const [pDate, setPDate] = useState(tomorrowStr())
  const [pTime, setPTime] = useState('')

  // For postpone — just updates fields, no status change
  const statusMut = useMutation({
    mutationFn: (payload: { consultationStatus: string; postponedDate?: string; postponedTime?: string }) =>
      api.put(`/leads/${lead.id}`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['closer-leads'] })
      setShowPostpone(false)
    },
  })

  // For happened/not_happened — transitions lead status (happened→IN_WORK, not_happened→REFUSED)
  const consultResultMut = useMutation({
    mutationFn: (result: 'happened' | 'not_happened') =>
      api.put(`/leads/${lead.id}/consult-result`, { result }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-leads'] }),
  })

  // 'planned' is not a real outcome — treat as no status so buttons always show
  const hasStatus = !!lead.consultationStatus && lead.consultationStatus !== 'planned'

  const statusLabels: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    happened:     { label: t('cl.consult.happened'),    cls: 'bg-green-100 text-green-700 border-green-200',   Icon: CheckCircle2 },
    not_happened: { label: t('cl.consult.notHappened'), cls: 'bg-red-100 text-red-700 border-red-200',         Icon: XCircle },
    postponed:    { label: t('cl.consult.postponed'),   cls: 'bg-orange-100 text-orange-700 border-orange-200', Icon: RefreshCw },
  }

  // When there's an appointment date, compute overdue/today flags for styling
  const displayDate = lead.postponedDate || lead.appointmentDate || null
  const displayTime = lead.postponedTime || lead.appointmentTime || null
  const isOverdueAppt = !!displayDate && displayDate < today
  const isTodayAppt = !!displayDate && displayDate === today
  const isFutureAppt = !!displayDate && displayDate > today

  const bgCls = isOverdueAppt && !hasStatus
    ? 'bg-red-50 border-red-200'
    : isTodayAppt && !hasStatus
    ? 'bg-blue-50 border-blue-200'
    : 'bg-gray-50 border-gray-100'

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${bgCls}`}>
      {/* Meeting date header — only when appointment was set */}
      {displayDate && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
            <Calendar className="w-3 h-3 shrink-0 text-blue-500" />
            {t('cl.consult.meetingPrefix')} {displayDate.split('-').reverse().join('.')}
            {displayTime && ` в ${displayTime}`}
            {lead.postponedDate && lead.postponedDate !== lead.appointmentDate && (
              <span className="ml-1 text-orange-500 font-normal">{t('cl.consult.postponedMark')}</span>
            )}
          </p>
          {hasStatus && (() => {
            const cfg = statusLabels[lead.consultationStatus!]
            const SIcon = cfg?.Icon
            return (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg?.cls ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {SIcon && <SIcon className="w-3 h-3" />}
                {cfg?.label ?? lead.consultationStatus}
              </span>
            )
          })()}
        </div>
      )}

      {/* Status chip when no appointment date */}
      {!displayDate && hasStatus && (() => {
        const cfg = statusLabels[lead.consultationStatus!]
        const SIcon = cfg?.Icon
        return (
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">{t('cl.consult.header')}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg?.cls ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {SIcon && <SIcon className="w-3 h-3" />}
              {cfg?.label ?? lead.consultationStatus}
            </span>
          </div>
        )
      })()}

      {/* Action buttons — always shown when no final outcome yet */}
      {(!hasStatus || lead.consultationStatus === 'postponed') && !showPostpone && (
        <div>
          {isFutureAppt ? (
            <p className="text-xs mb-2 flex items-center gap-1 text-blue-500 font-medium">
              <Calendar className="w-3 h-3 shrink-0" />
              {t('cl.consult.future')}
            </p>
          ) : (
            <p className={`text-xs mb-2 flex items-center gap-1 ${isOverdueAppt ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
              {isOverdueAppt && <AlertTriangle className="w-3 h-3 shrink-0" />}
              {isOverdueAppt ? t('cl.consult.overdue') : t('cl.consult.markResult')}
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            {/* happened/not_happened only allowed on or after the consultation date */}
            {!isFutureAppt && (['happened', 'not_happened'] as const).map(s => {
              const BIcon = statusLabels[s].Icon
              return (
                <button
                  key={s}
                  onClick={() => consultResultMut.mutate(s)}
                  disabled={consultResultMut.isPending}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80 disabled:opacity-40 flex items-center gap-1 ${statusLabels[s].cls}`}
                >
                  <BIcon className="w-3 h-3" />{statusLabels[s].label}
                </button>
              )
            })}
            <button
              onClick={() => { setPDate(tomorrowStr()); setPTime(''); setShowPostpone(true) }}
              disabled={statusMut.isPending}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80 disabled:opacity-40 flex items-center gap-1 ${statusLabels.postponed.cls}`}
            >
              <RefreshCw className="w-3 h-3" />{statusLabels.postponed.label}
            </button>
          </div>
        </div>
      )}

      {/* Postpone date picker */}
      {showPostpone && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-orange-700">{t('cl.consult.newDate')}</p>
          <div className="flex gap-2">
            <input type="date" value={pDate} min={today} onChange={e => setPDate(e.target.value)}
              className="flex-1 border border-orange-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
            <input type="time" value={pTime} onChange={e => setPTime(e.target.value)}
              className="w-24 border border-orange-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => statusMut.mutate({ consultationStatus: 'postponed', postponedDate: pDate, postponedTime: pTime || undefined })}
              disabled={!pDate || statusMut.isPending}
              className="flex-1 bg-orange-500 text-white text-xs font-semibold py-2 rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors"
            >{t('cl.consult.savePostpone')}</button>
            <button onClick={() => setShowPostpone(false)}
              className="px-3 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors"
            >{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {hasStatus && lead.consultationStatus !== 'postponed' && (
        <button onClick={() => statusMut.mutate({ consultationStatus: '' })} disabled={statusMut.isPending}
          className="text-xs text-gray-400 hover:text-gray-600 underline">
          {t('cl.consult.reset')}
        </button>
      )}
    </div>
  )
}

function LeadCard({ lead, showAccept = false, showConsult = false, showWork = false, readonly = false, highlightToday = false, showDelete = false, showRestore = false }: {
  lead: Lead
  showAccept?: boolean
  showConsult?: boolean
  showWork?: boolean
  readonly?: boolean
  highlightToday?: boolean
  showDelete?: boolean
  showRestore?: boolean
}) {
  const qc = useQueryClient()
  const { t } = useT()
  const { all: allGateways } = useGateways()
  const [open, setOpen] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const todayStr = new Date().toISOString().slice(0, 10)
  const isNew = lead.date === todayStr

  const acceptMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/accept`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-leads'] }),
  })

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/leads/${lead.id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-leads'] }); setShowConfirmDelete(false) },
  })

  const restoreMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/undelete`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-leads'] }),
  })

  const completedTasks = lead.tasks.filter(t => t.completed).length
  const totalTasks = lead.tasks.length

  const statusColor = lead.status === 'SOLD'
    ? 'text-green-600 bg-green-50'
    : lead.status === 'REFUSED'
    ? 'text-red-600 bg-red-50'
    : 'text-amber-600 bg-amber-50'

  const statusLabel = lead.status === 'SOLD' ? t('cl.card.statusSold') : lead.status === 'REFUSED' ? t('cl.card.statusRefused') : t('cl.card.statusInWork')

  // Display amount — prefer netAmount (бюджет сделки) when available
  const displayAmount = lead.netAmount ?? lead.amount

  // Show consultation section inline — only in Запланированные tab (showConsult=true)
  const showInlineConsult = showConsult
    && (!lead.consultationStatus || lead.consultationStatus === 'postponed' || lead.consultationStatus === 'planned')

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${highlightToday && isNew ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
      {highlightToday && isNew && (
        <div className="bg-green-500 text-white text-[11px] font-bold px-3 py-0.5 text-center tracking-wide uppercase">
          {t('cl.card.newToday')}
        </div>
      )}
      {/* Header */}
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{lead.clientName}</p>
            {lead.isQualified && <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{t('cl.card.qual')}</span>}
            {lead.isScheduled && <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{t('cl.card.scheduled')}</span>}
            {readonly && <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>}
            {totalTasks > 0 && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${completedTasks === totalTasks ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                <CheckSquare className="w-3 h-3 inline mr-0.5" />{completedTasks}/{totalTasks}
              </span>
            )}
            {showWork && (() => {
              const days = Math.floor((Date.now() - new Date(lead.date + 'T12:00:00').getTime()) / 86400000)
              if (days <= 0) return null
              const monthName = new Date(lead.date + 'T12:00:00').toLocaleDateString('ru', { month: 'long' })
              return (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {monthName} · {days} дн. в работе
                </span>
              )
            })()}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{lead.date}</span>
            {lead.appointmentDate && (
              <span className={`flex items-center gap-1 font-medium ${lead.consultationStatus === 'happened' ? 'text-green-600' : lead.consultationStatus === 'not_happened' ? 'text-red-500' : (lead.postponedDate || lead.appointmentDate) < new Date().toISOString().slice(0,10) && !lead.consultationStatus ? 'text-red-600' : 'text-blue-600'}`}>
                <Calendar className="w-3 h-3 shrink-0" />{(lead.postponedDate || lead.appointmentDate).split('-').reverse().join('.')}{(lead.postponedTime || lead.appointmentTime) ? ` ${lead.postponedTime || lead.appointmentTime}` : ''}
                {lead.postponedDate && lead.postponedDate !== lead.appointmentDate && <span className="text-orange-500 text-[10px] ml-0.5">↻</span>}
              </span>
            )}
            {lead.salesChannel && <span>{lead.salesChannel.name}</span>}
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{lead.createdBy.name}</span>
            {displayAmount != null && displayAmount > 0 && (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <Banknote className="w-3 h-3" />₸ {Number(displayAmount).toLocaleString('ru')}
                {lead.netAmount != null && <span className="text-[10px] text-green-400 ml-0.5">{t('cl.card.netto')}</span>}
              </span>
            )}
            {lead.paymentMethod && (
              <span className="text-gray-400">{gatewayLabel(lead.paymentMethod, allGateways)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showAccept && !showConsult && (
            <button
              onClick={e => { e.stopPropagation(); acceptMut.mutate() }}
              disabled={acceptMut.isPending}
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <Check className="w-4 h-4" /> {t('cl.card.accept')}
            </button>
          )}
          {showWork && (
            <button
              onClick={e => { e.stopPropagation(); setShowTransferModal(true) }}
              className="flex items-center gap-1.5 text-sm text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
              title={t('cl.card.transfer')}
            >
              <ArrowRightLeft className="w-4 h-4" /> {t('cl.card.transfer')}
            </button>
          )}
          {readonly && !showRestore && (
            <button
              onClick={e => { e.stopPropagation(); setShowEditModal(true) }}
              className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
              title="Редактировать"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {showRestore && (
            <button
              onClick={e => { e.stopPropagation(); restoreMut.mutate() }}
              disabled={restoreMut.isPending}
              className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40"
            >
              <ArchiveRestore className="w-4 h-4" /> {t('cl.card.restore')}
            </button>
          )}
          {showDelete && !showConfirmDelete && (
            <button
              onClick={e => { e.stopPropagation(); setShowConfirmDelete(true) }}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {showDelete && showConfirmDelete && (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <span className="text-xs text-red-600 font-medium">{t('cl.card.deleteConfirm')}</span>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="text-xs px-2 py-1 bg-red-500 text-white rounded-md font-medium disabled:opacity-40"
              >{t('cl.card.yes')}</button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="text-xs px-2 py-1 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50"
              >{t('cl.card.no')}</button>
            </div>
          )}
          <div className="text-gray-300">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expanded */}
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-3">
          {/* Lead info from lider */}
          {lead.comment && (
            <p className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border-l-2 border-blue-300">
              <span className="text-xs font-semibold text-blue-600 block mb-0.5">{t('cl.card.liderComment')}</span>
              {lead.comment}
            </p>
          )}

          {/* Sold details when readonly */}
          {readonly && lead.status === 'SOLD' && lead.paymentMethod && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm">
              <p className="text-xs font-semibold text-green-700 mb-1">{t('cl.card.saleDetails')}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-green-800">
                <span>{t('cl.card.gateway')} <b>{gatewayLabel(lead.paymentMethod, allGateways)}</b></span>
                {lead.amount && <span>{t('cl.card.amount')} <b>₸ {lead.amount.toLocaleString('ru')}</b></span>}
                {lead.netAmount && <span>{t('cl.card.dealBudget')} <b>₸ {lead.netAmount.toLocaleString('ru')}</b></span>}
                {lead.paymentType && <span>{t('cl.card.payType')} <b>{lead.paymentType === 'new_sale' ? t('cl.card.payNew') : t('cl.card.payAdditional')}</b></span>}
              </div>
            </div>
          )}

          {/* Existing tasks */}
          {lead.tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('cl.card.tasks')}</p>
              <div className="space-y-1.5">
                {lead.tasks.map(task => {
                  const overdue = !task.completed && isOverdue(task.dueDate)
                  return (
                    <div key={task.id} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${task.completed ? 'bg-green-50 text-green-700' : overdue ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
                      {task.completed
                        ? <Check className="w-4 h-4 text-green-600 shrink-0" />
                        : <div className="w-4 h-4 rounded-full border-2 border-current shrink-0" />
                      }
                      <span className={task.completed ? 'line-through opacity-60' : ''}>{task.title}</span>
                      <span className="ml-auto text-xs opacity-60">{fmtDate(task.dueDate)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Consultation status marking — only in Запланированные tab */}
          {showConsult && <ConsultationStatusSection lead={lead} />}

          {/* IN_WORK: sell/refuse/task section */}
          {showWork && <InWorkSection lead={lead} />}

          {/* CRM link for non-IN_WORK leads */}
          {!showWork && lead.crmLink && (
            <a href={lead.crmLink} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <ExternalLink className="w-4 h-4" /> {t('cl.card.crmLink')}
            </a>
          )}

          {/* Refund button for SOLD leads */}
          {readonly && lead.status === 'SOLD' && !lead.isRefund && (
            <RefundButton lead={lead} />
          )}
          {readonly && lead.status === 'SOLD' && lead.isRefund && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-sm text-orange-700 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 shrink-0" />
              <div>
                <p className="font-semibold">{t('cl.card.refundDone')}{(lead.refundAmount ?? lead.amount) ? ` — ₸ ${(lead.refundAmount ?? lead.amount)!.toLocaleString('ru')}` : ''}</p>
                {lead.refundComment && <p className="text-xs text-orange-500 mt-0.5">{lead.refundComment}</p>}
              </div>
            </div>
          )}

          {/* Closer comment */}
          {readonly && lead.closerComment && (
            <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              <span className="text-xs font-semibold text-gray-500 block mb-0.5">{t('cl.card.closerComment')}</span>
              {lead.closerComment}
            </p>
          )}
        </div>
      )}

      {/* Inline consultation buttons — visible WITHOUT expanding card */}
      {showInlineConsult && !open && (
        <div className="px-4 pb-3 border-t border-gray-50 pt-3">
          <ConsultationStatusSection lead={lead} compact />
        </div>
      )}

      {showEditModal && <EditLeadModal lead={lead} onClose={() => setShowEditModal(false)} />}
      {showTransferModal && <TransferModal lead={lead} onClose={() => setShowTransferModal(false)} />}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CloserLeadsPage() {
  const { t } = useT()
  const periodState = usePeriodStore()
  const params = buildPeriodParams(periodState)
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<'incoming' | 'inwork' | 'refused' | 'sold' | 'refunds' | 'trash'>(
    (searchParams.get('tab') as 'incoming' | 'inwork' | 'refused' | 'sold' | 'refunds' | 'trash') || 'incoming'
  )

  const incomingQ = useQuery({
    queryKey: ['closer-leads', 'incoming'],
    queryFn: () => api.get('/leads/incoming').then(r => r.data),
    refetchInterval: 30000,
  })
  // all=true → no date filter, returns ALL in-work leads regardless of period (sorted newest first)
  const inworkQ = useQuery({
    queryKey: ['closer-leads', 'inwork-all'],
    queryFn: () => api.get('/leads/in-work?all=true').then(r => r.data),
  })
  const refusedQ = useQuery({
    queryKey: ['closer-leads', 'refused-all'],
    queryFn: () => api.get('/leads/refused?all=true').then(r => r.data),
  })
  const soldQ = useQuery({
    queryKey: ['closer-leads', 'sold', params],
    queryFn: () => api.get(`/leads/sold?${params}`).then(r => r.data),
  })
  const refundsQ = useQuery({
    queryKey: ['closer-leads', 'refunds', params],
    queryFn: () => api.get(`/leads/refunds?${params}`).then(r => r.data),
  })
  const trashQ = useQuery({
    queryKey: ['closer-leads', 'trash'],
    queryFn: () => api.get('/leads/trash').then(r => r.data),
  })

  const notHappened: Lead[] = (inworkQ.data || []).filter((l: Lead) => l.consultationStatus === 'not_happened')
  const incoming: Lead[] = [...(incomingQ.data || []), ...notHappened]
  const inwork: Lead[] = (inworkQ.data || []).filter((l: Lead) => l.consultationStatus !== 'not_happened')
  const refused: Lead[] = refusedQ.data || []
  const sold: Lead[] = soldQ.data || []
  const refunds: Lead[] = refundsQ.data || []
  const trash: Lead[] = trashQ.data || []

  // Refunded leads show ONLY in Возвраты tab, not in Продажи
  const soldPure = sold.filter(l => !l.isRefund)
  const soldWithRefunds = sold.filter(l => l.isRefund)

  const tabs = [
    { key: 'incoming', label: t('cl.tab.incoming'), count: incoming.length,  dot: 'bg-blue-500', urgent: incoming.length > 0 },
    { key: 'inwork',   label: t('cl.tab.inwork'),   count: inwork.length,    dot: 'bg-amber-400' },
    { key: 'refused',  label: t('cl.tab.refused'),  count: refused.length,   dot: 'bg-red-400' },
    { key: 'sold',     label: t('cl.tab.sold'),     count: soldPure.length,  dot: 'bg-green-400' },
    { key: 'refunds',  label: t('cl.tab.refunds'),  count: refunds.length,   dot: 'bg-orange-400', urgent: refunds.length > 0 },
    { key: 'trash',    label: t('cl.tab.trash'),    count: trash.length,     dot: 'bg-gray-400' },
  ] as const

  const currentLeads = tab === 'incoming' ? incoming : tab === 'inwork' ? inwork : tab === 'refused' ? refused : tab === 'sold' ? soldPure : tab === 'trash' ? trash : refunds
  const currentQ = tab === 'incoming' ? incomingQ : tab === 'inwork' ? inworkQ : tab === 'refused' ? refusedQ : tab === 'sold' ? soldQ : tab === 'trash' ? trashQ : refundsQ

  // Net revenue + refund stats (use amount = gross for refund display)
  const soldNetTotal    = soldPure.reduce((s, l) => s + (l.netAmount ?? l.amount ?? 0), 0)
  const soldRefundTotal = soldWithRefunds.reduce((s, l) => s + (l.amount ?? 0), 0)
  const refundsGrossTotal = refunds.reduce((s, l) => s + (l.amount ?? 0), 0)
  const todayStr         = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto px-4 md:px-8 py-4 md:py-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('cl.title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('cl.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${t.dot}`} />
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${(t as any).urgent && t.key !== 'refunds' ? 'bg-blue-600 text-white animate-pulse' : t.key === 'refunds' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Net total + refund stats for sold tab */}
        {tab === 'sold' && sold.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-1.5 text-sm">
              <span className="text-green-600 font-medium">{t('cl.budget')} </span>
              <span className="text-green-700 font-bold">₸ {soldNetTotal.toLocaleString('ru')}</span>
            </div>
            {soldWithRefunds.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-1.5 text-sm flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-orange-600 font-medium">{t('cl.refunds.label')} </span>
                <span className="text-orange-700 font-bold">{soldWithRefunds.length} шт. / ₸ {soldRefundTotal.toLocaleString('ru')} (полная сумма)</span>
              </div>
            )}
          </div>
        )}
        {/* Refunds tab stats */}
        {tab === 'refunds' && refunds.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-1.5 text-sm flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-orange-600 font-medium">{t('cl.refunds.total')} </span>
              <span className="text-orange-700 font-bold">{refunds.length} шт. / ₸ {refundsGrossTotal.toLocaleString('ru')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {currentQ.isLoading && (
        <div className="card text-center text-gray-400 py-12">{t('common.loading')}</div>
      )}

      {!currentQ.isLoading && currentLeads.length === 0 && (
        <div className="card text-center py-14">
          <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-gray-400 font-medium">
            {tab === 'incoming' ? t('cl.empty.incoming') :
             tab === 'inwork' ? t('cl.empty.inwork') :
             tab === 'refused' ? t('cl.empty.refused') :
             tab === 'refunds' ? t('cl.empty.refunds') :
             tab === 'trash' ? t('cl.empty.trash') : t('cl.empty.sold')}
          </p>
          {tab === 'incoming' && <p className="text-xs text-gray-300 mt-1">{t('cl.empty.incomingHint')}</p>}
        </div>
      )}

      {!currentQ.isLoading && currentLeads.length > 0 && (
        <div className="space-y-3">
          {tab === 'incoming' ? (() => {
            // Sort: today's consultation first, then by appointmentDate asc, then no-date
            const todayConsults = incoming.filter(l => {
              const appt = l.postponedDate || l.appointmentDate
              return appt === todayStr
            })
            const otherLeads = incoming.filter(l => {
              const appt = l.postponedDate || l.appointmentDate
              return appt !== todayStr
            }).sort((a, b) => {
              const da = a.postponedDate || a.appointmentDate || '9999'
              const db = b.postponedDate || b.appointmentDate || '9999'
              return da.localeCompare(db)
            })
            return (
              <>
                {todayConsults.length > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-blue-200" />
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {t('cl.incoming.todayBadge')} — {todayConsults.length}
                      </span>
                      <div className="h-px flex-1 bg-blue-200" />
                    </div>
                    {todayConsults.map(lead => (
                      <LeadCard key={lead.id} lead={lead} showAccept={lead.status === 'ASSIGNED'} showConsult
                        readonly={false} highlightToday showDelete showRestore={false} />
                    ))}
                    {otherLeads.length > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="text-xs text-gray-400 uppercase tracking-wide">Остальные</span>
                        <div className="h-px flex-1 bg-gray-200" />
                      </div>
                    )}
                  </>
                )}
                {otherLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} showAccept={lead.status === 'ASSIGNED'} showConsult
                    readonly={false} highlightToday showDelete showRestore={false} />
                ))}
              </>
            )
          })() : tab === 'inwork' ? (
            <>
              {inwork.map((lead: Lead) => (
                <LeadCard key={lead.id} lead={lead} showAccept={false} showWork
                  readonly={false} highlightToday={false} showDelete showRestore={false} />
              ))}
            </>
          ) : (
            currentLeads.map((lead: Lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                showAccept={false}
                showWork={false}
                readonly={tab === 'refused' || tab === 'sold' || tab === 'refunds' || tab === 'trash'}
                highlightToday={false}
                showDelete={tab !== 'trash'}
                showRestore={tab === 'trash'}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
