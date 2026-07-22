import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import PeriodSelector, { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import { Phone, Calendar, User, ChevronDown, ChevronUp, Check, X, CheckSquare, Plus, ExternalLink, Banknote, Pencil } from 'lucide-react'

type Lead = {
  id: string
  clientName: string
  phone: string
  date: string
  isQualified: boolean
  isScheduled: boolean
  comment: string | null
  status: string
  salesChannel: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  assignedTo: { id: string; name: string } | null
  tasks: { id: string; title: string; dueDate: string; completed: boolean }[]
  amount: number | null
  paymentType: string | null
  paymentMethod: string | null
  bank: string | null
  months: number | null
  crmLink: string | null
  closerComment: string | null
}

const PAYMENT_TYPE = [
  { value: 'new_sale', label: 'Новая продажа' },
  { value: 'additional', label: 'Доплата' },
]
const PAYMENT_METHOD = [
  { value: 'cash', label: 'Нал' },
  { value: 'card', label: 'Безнал' },
  { value: 'credit', label: 'Кредит' },
  { value: 'installment', label: 'Рассрочка' },
]
const BANKS = ['Kaspi Bank', 'Halyk', 'BCC', 'Forte', 'Jusan', 'RBK', 'Другой']

function fmtDate(s: string) {
  if (!s) return ''
  return new Date(s + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function isOverdue(dueDate: string) {
  return dueDate < new Date().toISOString().slice(0, 10)
}

// ── Add Task Modal ────────────────────────────────────────────────────────────
function AddTaskModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(today)
  const [error, setError] = useState('')

  const createTask = useMutation({
    mutationFn: () => api.post('/lead-tasks', { leadId, title, dueDate }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-leads'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4">Добавить задачу</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Задача *</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Перезвонить, отправить КП..." autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Срок выполнения *</label>
            <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 btn-outline">Отмена</button>
          <button onClick={() => { if (!title.trim()) return setError('Введите задачу'); createTask.mutate() }}
            disabled={createTask.isPending} className="flex-1 btn-primary">
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Lead Modal ───────────────────────────────────────────────────────────
function EditLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    amount: lead.amount ? String(lead.amount) : '',
    paymentType: lead.paymentType || 'new_sale',
    paymentMethod: lead.paymentMethod || 'card',
    bank: lead.bank || '',
    months: lead.months ? String(lead.months) : '',
    crmLink: lead.crmLink || '',
    closerComment: lead.closerComment || '',
  })
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const saveMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}`, {
      ...form,
      amount: form.amount ? Number(form.amount) : null,
      months: form.months ? Number(form.months) : null,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-leads'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4">Редактировать заявку — {lead.clientName}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Сумма</label>
            <input type="number" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Тип оплаты</label>
            <select className="input" value={form.paymentType} onChange={e => set('paymentType', e.target.value)}>
              {PAYMENT_TYPE.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Способ оплаты</label>
            <select className="input" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
              {PAYMENT_METHOD.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Банк</label>
            <select className="input" value={form.bank} onChange={e => set('bank', e.target.value)}>
              <option value="">— не выбран —</option>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {(form.paymentMethod === 'credit' || form.paymentMethod === 'installment') && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Месяцев</label>
              <input type="number" className="input" value={form.months} onChange={e => set('months', e.target.value)} placeholder="12" />
            </div>
          )}
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1">Ссылка на сделку в CRM</label>
            <input type="url" className="input" value={form.crmLink} onChange={e => set('crmLink', e.target.value)} placeholder="https://..." />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1">Комментарий</label>
            <textarea className="input resize-none h-16" value={form.closerComment} onChange={e => set('closerComment', e.target.value)} placeholder="Заметки по сделке..." />
          </div>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 btn-outline">Отмена</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1 btn-primary">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

// ── In-Work Section (combined sell form + refuse + task) ──────────────────────
function InWorkSection({ lead }: { lead: Lead }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    amount: lead.amount ? String(lead.amount) : '',
    paymentType: lead.paymentType || 'new_sale',
    paymentMethod: lead.paymentMethod || 'card',
    bank: lead.bank || '',
    months: lead.months ? String(lead.months) : '',
    crmLink: lead.crmLink || '',
    closerComment: lead.closerComment || '',
  })
  const [error, setError] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const sellMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/sell`, {
      ...form,
      amount: Number(form.amount),
      months: form.months ? Number(form.months) : null,
    }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-leads'] }),
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  const saveMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}`, {
      ...form,
      amount: form.amount ? Number(form.amount) : null,
      months: form.months ? Number(form.months) : null,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-leads'] }); setError('') },
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  const refuseMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/refuse`, { crmLink: form.crmLink }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-leads'] }),
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Данные сделки</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Сумма</label>
          <input type="number" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Тип оплаты</label>
          <select className="input" value={form.paymentType} onChange={e => set('paymentType', e.target.value)}>
            {PAYMENT_TYPE.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Способ оплаты</label>
          <select className="input" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
            {PAYMENT_METHOD.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Банк</label>
          <select className="input" value={form.bank} onChange={e => set('bank', e.target.value)}>
            <option value="">— не выбран —</option>
            {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        {(form.paymentMethod === 'credit' || form.paymentMethod === 'installment') && (
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Месяцев</label>
            <input type="number" className="input" value={form.months} onChange={e => set('months', e.target.value)} placeholder="12" />
          </div>
        )}
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-500 block mb-1">
            Ссылка на сделку в CRM <span className="text-red-500">*</span>
            <span className="text-gray-400 font-normal ml-1">(обязательна для отказа и продажи)</span>
          </label>
          <input type="url" className="input" value={form.crmLink} onChange={e => set('crmLink', e.target.value)} placeholder="https://..." />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-500 block mb-1">Комментарий</label>
          <textarea className="input resize-none h-16" value={form.closerComment} onChange={e => set('closerComment', e.target.value)} placeholder="Заметки по сделке..." />
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Primary actions */}
      <div className="flex gap-2">
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="flex-1 btn-outline text-sm py-2">
          Сохранить черновик
        </button>
        <button onClick={() => {
          setError('')
          if (!form.amount || !form.crmLink) return setError('Заполните сумму и CRM-ссылку')
          sellMut.mutate()
        }} disabled={sellMut.isPending}
          className="flex-1 text-sm py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40">
          <Check className="w-4 h-4 inline mr-1" />Закрыть как продажу
        </button>
      </div>

      {/* Secondary actions */}
      <div className="flex gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={() => setShowTaskForm(true)}
          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors flex-1 justify-center"
        >
          <Plus className="w-4 h-4" /> Оставить в работе
        </button>
        <button
          onClick={() => {
            setError('')
            if (!form.crmLink) return setError('Заполните CRM-ссылку для отказа')
            refuseMut.mutate()
          }}
          disabled={refuseMut.isPending}
          className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" /> Отказ
        </button>
      </div>

      {showTaskForm && <AddTaskModal leadId={lead.id} onClose={() => setShowTaskForm(false)} />}
    </div>
  )
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, showAccept = false, showWork = false, readonly = false }: {
  lead: Lead
  showAccept?: boolean
  showWork?: boolean
  readonly?: boolean
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const acceptMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/accept`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-leads'] }),
  })

  const completedTasks = lead.tasks.filter(t => t.completed).length
  const totalTasks = lead.tasks.length

  const statusColor = lead.status === 'SOLD'
    ? 'text-green-600 bg-green-50'
    : lead.status === 'REFUSED'
    ? 'text-red-600 bg-red-50'
    : 'text-amber-600 bg-amber-50'

  const statusLabel = lead.status === 'SOLD' ? 'Продажа' : lead.status === 'REFUSED' ? 'Отказ' : 'В работе'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{lead.clientName}</p>
            {lead.isQualified && <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Квал.</span>}
            {lead.isScheduled && <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Записан</span>}
            {readonly && <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>}
            {totalTasks > 0 && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${completedTasks === totalTasks ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                <CheckSquare className="w-3 h-3 inline mr-0.5" />{completedTasks}/{totalTasks}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{lead.date}</span>
            {lead.salesChannel && <span>{lead.salesChannel.name}</span>}
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{lead.createdBy.name}</span>
            {lead.amount && <span className="flex items-center gap-1 text-green-600 font-medium"><Banknote className="w-3 h-3" />₸ {Number(lead.amount).toLocaleString('ru')}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showAccept && (
            <button
              onClick={e => { e.stopPropagation(); acceptMut.mutate() }}
              disabled={acceptMut.isPending}
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <Check className="w-4 h-4" /> Принять
            </button>
          )}
          {readonly && (
            <button
              onClick={e => { e.stopPropagation(); setShowEditModal(true) }}
              className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
              title="Редактировать"
            >
              <Pencil className="w-4 h-4" />
            </button>
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
              <span className="text-xs font-semibold text-blue-600 block mb-0.5">Комментарий лидоруба</span>
              {lead.comment}
            </p>
          )}

          {/* Existing tasks */}
          {lead.tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Задачи</p>
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

          {/* IN_WORK: sell/refuse/task section */}
          {showWork && <InWorkSection lead={lead} />}

          {/* CRM link for non-IN_WORK leads */}
          {!showWork && lead.crmLink && (
            <a href={lead.crmLink} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <ExternalLink className="w-4 h-4" /> Открыть в CRM
            </a>
          )}
        </div>
      )}

      {showEditModal && <EditLeadModal lead={lead} onClose={() => setShowEditModal(false)} />}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CloserLeadsPage() {
  const periodState = usePeriodStore()
  const params = buildPeriodParams(periodState)
  const [tab, setTab] = useState<'incoming' | 'inwork' | 'refused' | 'sold'>('incoming')

  const incomingQ = useQuery({
    queryKey: ['closer-leads', 'incoming'],
    queryFn: () => api.get('/leads/incoming').then(r => r.data),
    refetchInterval: 30000,
  })
  const inworkQ = useQuery({
    queryKey: ['closer-leads', 'inwork', params],
    queryFn: () => api.get(`/leads/in-work?${params}`).then(r => r.data),
  })
  const refusedQ = useQuery({
    queryKey: ['closer-leads', 'refused', params],
    queryFn: () => api.get(`/leads/refused?${params}`).then(r => r.data),
  })
  const soldQ = useQuery({
    queryKey: ['closer-leads', 'sold', params],
    queryFn: () => api.get(`/leads/sold?${params}`).then(r => r.data),
  })

  const incoming: Lead[] = incomingQ.data || []
  const inwork: Lead[] = inworkQ.data || []
  const refused: Lead[] = refusedQ.data || []
  const sold: Lead[] = soldQ.data || []

  const tabs = [
    { key: 'incoming', label: 'Входящие', count: incoming.length, dot: 'bg-blue-500', urgent: incoming.length > 0 },
    { key: 'inwork', label: 'В работе', count: inwork.length, dot: 'bg-amber-400' },
    { key: 'refused', label: 'Отказы', count: refused.length, dot: 'bg-red-400' },
    { key: 'sold', label: 'Продажи', count: sold.length, dot: 'bg-green-400' },
  ] as const

  const currentLeads = tab === 'incoming' ? incoming : tab === 'inwork' ? inwork : tab === 'refused' ? refused : sold
  const currentQ = tab === 'incoming' ? incomingQ : tab === 'inwork' ? inworkQ : tab === 'refused' ? refusedQ : soldQ

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Заявки</h1>
        <p className="text-sm text-gray-400 mt-0.5">Лиды от лидорубов</p>
      </div>

      {/* Period + tabs */}
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
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${(t as any).urgent ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-200 text-gray-600'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        {tab !== 'incoming' && <PeriodSelector />}
      </div>

      {/* Content */}
      {currentQ.isLoading && (
        <div className="card text-center text-gray-400 py-12">Загрузка...</div>
      )}

      {!currentQ.isLoading && currentLeads.length === 0 && (
        <div className="card text-center py-14">
          <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-gray-400 font-medium">
            {tab === 'incoming' ? 'Нет новых входящих заявок' :
             tab === 'inwork' ? 'Нет заявок в работе' :
             tab === 'refused' ? 'Нет отказов за период' : 'Нет продаж за период'}
          </p>
          {tab === 'incoming' && <p className="text-xs text-gray-300 mt-1">Лидорубы пришлют заявки сюда</p>}
        </div>
      )}

      {!currentQ.isLoading && currentLeads.length > 0 && (
        <div className="space-y-3">
          {currentLeads.map((lead: Lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              showAccept={tab === 'incoming'}
              showWork={tab === 'inwork'}
              readonly={tab === 'refused' || tab === 'sold'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
