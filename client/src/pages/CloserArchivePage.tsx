import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import PeriodSelector, { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import { Phone, Calendar, User, ExternalLink, Banknote, ChevronDown, ChevronUp, Pencil, Check, X, CheckSquare } from 'lucide-react'

type Lead = {
  id: string
  clientName: string
  phone: string
  date: string
  isQualified: boolean
  comment: string | null
  status: string
  salesChannel: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  tasks: { id: string; title: string; dueDate: string; completed: boolean }[]
  amount: number | null
  paymentType: string | null
  paymentMethod: string | null
  bank: string | null
  months: number | null
  crmLink: string | null
  closerComment: string | null
}

const PAYMENT_TYPE: Record<string, string> = { new_sale: 'Новая', additional: 'Доплата' }
const PAYMENT_METHOD: Record<string, string> = { cash: 'Нал', card: 'Безнал', credit: 'Кредит', installment: 'Рассрочка' }
const PAYMENT_TYPE_OPT = [{ value: 'new_sale', label: 'Новая продажа' }, { value: 'additional', label: 'Доплата' }]
const PAYMENT_METHOD_OPT = [{ value: 'cash', label: 'Нал' }, { value: 'card', label: 'Безнал' }, { value: 'credit', label: 'Кредит' }, { value: 'installment', label: 'Рассрочка' }]
const BANKS = ['Kaspi Bank', 'Halyk', 'BCC', 'Forte', 'Jusan', 'RBK', 'Другой']

function isOverdue(dueDate: string) {
  return dueDate < new Date().toISOString().slice(0, 10)
}

function fmtDate(s: string) {
  if (!s) return ''
  return new Date(s + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['archive-leads'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  // Restore REFUSED lead back to IN_WORK
  const restoreMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/restore`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['archive-leads'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Редактировать — {lead.clientName}</h3>
          {lead.status === 'REFUSED' && (
            <button onClick={() => restoreMut.mutate()} disabled={restoreMut.isPending}
              className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
              Вернуть в работу
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Сумма</label>
            <input type="number" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Тип оплаты</label>
            <select className="input" value={form.paymentType} onChange={e => set('paymentType', e.target.value)}>
              {PAYMENT_TYPE_OPT.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Способ оплаты</label>
            <select className="input" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
              {PAYMENT_METHOD_OPT.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
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
            <label className="text-xs font-medium text-gray-500 block mb-1">CRM-ссылка</label>
            <input type="url" className="input" value={form.crmLink} onChange={e => set('crmLink', e.target.value)} placeholder="https://..." />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 block mb-1">Комментарий</label>
            <textarea className="input resize-none h-16" value={form.closerComment} onChange={e => set('closerComment', e.target.value)} placeholder="Заметки..." />
          </div>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 btn-outline">Отмена</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1 btn-primary">Сохранить</button>
        </div>
      </div>
    </div>
  )
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const completedTasks = lead.tasks.filter(t => t.completed).length
  const totalTasks = lead.tasks.length
  const isRefused = lead.status === 'REFUSED'
  const dotColor = isRefused ? 'bg-red-400' : 'bg-amber-400'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{lead.clientName}</p>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${isRefused ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
              {isRefused ? 'Отказ' : 'В работе'}
            </span>
            {totalTasks > 0 && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${completedTasks === totalTasks ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                <CheckSquare className="w-3 h-3 inline mr-0.5" />{completedTasks}/{totalTasks}
              </span>
            )}
            {lead.amount && <span className="text-[11px] font-medium text-green-600 flex items-center gap-0.5"><Banknote className="w-3 h-3" />₸ {Number(lead.amount).toLocaleString('ru')}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{lead.date}</span>
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{lead.createdBy.name}</span>
            {lead.paymentType && <span>{PAYMENT_TYPE[lead.paymentType]}</span>}
            {lead.paymentMethod && <span>{PAYMENT_METHOD[lead.paymentMethod]}</span>}
            {lead.bank && <span>{lead.bank}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setShowEdit(true) }}
            className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
            title="Редактировать"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-3">
          {lead.comment && (
            <p className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border-l-2 border-blue-300">
              <span className="text-xs font-semibold text-blue-600 block mb-0.5">Комментарий лидоруба</span>
              {lead.comment}
            </p>
          )}
          {lead.closerComment && (
            <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              <span className="text-xs font-semibold text-gray-500 block mb-0.5">Комментарий клоузера</span>
              {lead.closerComment}
            </p>
          )}
          {lead.crmLink && (
            <a href={lead.crmLink} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium">
              <ExternalLink className="w-4 h-4" /> Открыть в CRM
            </a>
          )}
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
        </div>
      )}

      {showEdit && <EditLeadModal lead={lead} onClose={() => setShowEdit(false)} />}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CloserArchivePage() {
  const periodState = usePeriodStore()
  const params = buildPeriodParams(periodState)
  const [tab, setTab] = useState<'refused' | 'inwork'>('refused')

  const refusedQ = useQuery({
    queryKey: ['archive-leads', 'refused', params],
    queryFn: () => api.get(`/leads/refused?${params}`).then(r => r.data),
  })

  const inworkQ = useQuery({
    queryKey: ['archive-leads', 'inwork', params],
    queryFn: () => api.get(`/leads/in-work?${params}`).then(r => r.data),
  })

  const refused: Lead[] = refusedQ.data || []
  const inwork: Lead[] = inworkQ.data || []
  const currentLeads = tab === 'refused' ? refused : inwork
  const currentQ = tab === 'refused' ? refusedQ : inworkQ

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Архив заявок</h1>
        <p className="text-sm text-gray-400 mt-0.5">Отказники и заявки в работе за период</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTab('refused')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'refused' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Отказники
            {refused.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-gray-200 text-gray-600">{refused.length}</span>}
          </button>
          <button
            onClick={() => setTab('inwork')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'inwork' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            В работе
            {inwork.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-gray-200 text-gray-600">{inwork.length}</span>}
          </button>
        </div>
        <PeriodSelector />
      </div>

      {currentQ.isLoading && <div className="card text-center text-gray-400 py-12">Загрузка...</div>}

      {!currentQ.isLoading && currentLeads.length === 0 && (
        <div className="card text-center py-14">
          <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto flex items-center justify-center mb-3">
            <X className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-gray-400 font-medium">
            {tab === 'refused' ? 'Нет отказов за период' : 'Нет заявок в работе за период'}
          </p>
        </div>
      )}

      {!currentQ.isLoading && currentLeads.length > 0 && (
        <div className="space-y-3">
          {currentLeads.map((lead: Lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  )
}
