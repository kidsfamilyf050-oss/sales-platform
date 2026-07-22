import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import PeriodSelector, { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import { Plus, Phone, User, Calendar, CheckCircle, XCircle, Trash2, UserCheck, ChevronDown, ChevronUp, Edit2, X, Check, RefreshCw } from 'lucide-react'

const CHANNELS_DEFAULT = [
  'Instagram', 'TikTok', 'OLX', 'Сайт', '2GIS', 'Холодный звонок', 'Реклама', 'Рекомендация',
]

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
  assignedTo: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  tasks: any[]
}

function statusLabel(s: string) {
  const map: Record<string, { label: string; color: string }> = {
    NEW: { label: 'Новый', color: 'bg-blue-100 text-blue-700' },
    ASSIGNED: { label: 'Передан', color: 'bg-purple-100 text-purple-700' },
    IN_WORK: { label: 'В работе', color: 'bg-amber-100 text-amber-700' },
    REFUSED: { label: 'Отказ', color: 'bg-red-100 text-red-600' },
    SOLD: { label: 'Продажа', color: 'bg-green-100 text-green-700' },
    UNQUALIFIED: { label: 'Неквал.', color: 'bg-gray-100 text-gray-500' },
  }
  return map[s] || { label: s, color: 'bg-gray-100 text-gray-500' }
}

// ── Add Lead Form ─────────────────────────────────────────────────────────────
function AddLeadModal({ onClose, closers, channels }: {
  onClose: () => void
  closers: { id: string; name: string }[]
  channels: { id: string; name: string }[]
}) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    clientName: '', phone: '', date: today,
    salesChannelId: '', isQualified: true, isScheduled: false,
    assignedToId: '', comment: '',
  })
  const [error, setError] = useState('')

  // DB channels + built-in defaults (only shown if not already in DB)
  const dbChannelNames = channels.map((c: { name: string }) => c.name)
  const allChannels = [
    ...channels,
    ...CHANNELS_DEFAULT.filter(n => !dbChannelNames.includes(n)).map(n => ({ id: `__builtin__${n}`, name: n })),
  ]

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/leads', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lider-leads'] })
      onClose()
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.clientName.trim()) return setError('Введите имя клиента')
    if (!form.phone.trim()) return setError('Введите телефон')
    setError('')
    // Built-in channels start with __builtin__ — pass null for salesChannelId (stored as name in comment instead)
    const channelId = form.salesChannelId?.startsWith('__builtin__') ? null : (form.salesChannelId || null)
    const channelName = form.salesChannelId?.startsWith('__builtin__') ? form.salesChannelId.replace('__builtin__', '') : null
    const commentWithChannel = channelName
      ? `[Канал: ${channelName}]${form.comment ? ' ' + form.comment : ''}`
      : form.comment
    createMutation.mutate({
      ...form,
      comment: commentWithChannel,
      salesChannelId: channelId,
      assignedToId: form.assignedToId || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-lg">Новый лид</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Имя клиента *</label>
              <input className="input" value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Иванов Иван" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Телефон *</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+7 (777) 000-00-00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Дата</label>
              <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Канал продаж</label>
              <select className="input" value={form.salesChannelId} onChange={e => set('salesChannelId', e.target.value)}>
                <option value="">— не выбран —</option>
                {allChannels.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Ответственный клоузер</label>
            <select className="input" value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)}>
              <option value="">— не назначен —</option>
              {closers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => set('isQualified', !form.isQualified)}
                className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${form.isQualified ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isQualified ? 'left-5' : 'left-1'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Квалифицированный</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => set('isScheduled', !form.isScheduled)}
                className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${form.isScheduled ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isScheduled ? 'left-5' : 'left-1'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Записан на встречу</span>
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Комментарий</label>
            <textarea
              className="input resize-none h-20"
              value={form.comment}
              onChange={e => set('comment', e.target.value)}
              placeholder="Источник, особенности, заметки..."
            />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 btn-outline">Отмена</button>
          <button
            onClick={submit}
            disabled={createMutation.isPending}
            className="flex-1 btn-primary"
          >
            {createMutation.isPending ? 'Сохраняем...' : 'Добавить лид'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Assign Modal ──────────────────────────────────────────────────────────────
function AssignModal({ lead, closers, onClose }: { lead: Lead; closers: { id: string; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [closerId, setCloserId] = useState(lead.assignedTo?.id || '')
  const assignMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/assign`, { assignedToId: closerId }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lider-leads'] }); onClose() },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-1">Назначить клоузера</h3>
        <p className="text-sm text-gray-400 mb-4">{lead.clientName} · {lead.phone}</p>
        <select className="input mb-4" value={closerId} onChange={e => setCloserId(e.target.value)}>
          <option value="">— выберите —</option>
          {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-outline">Отмена</button>
          <button onClick={() => assignMut.mutate()} disabled={!closerId || assignMut.isPending} className="flex-1 btn-primary">
            Передать лид
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, closers, onAssign, onDelete, onQualify, showQualify = false }: {
  lead: Lead
  closers: { id: string; name: string }[]
  onAssign?: (lead: Lead) => void
  onDelete: (id: string) => void
  onQualify?: (id: string) => void
  showQualify?: boolean
}) {
  const [open, setOpen] = useState(false)
  const st = statusLabel(lead.status)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{lead.clientName}</p>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
            {lead.isQualified && <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Квал.</span>}
            {lead.isScheduled && <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Записан</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{lead.date}</span>
            {lead.salesChannel && <span className="text-gray-500">{lead.salesChannel.name}</span>}
            {lead.assignedTo && (
              <span className="flex items-center gap-1 text-purple-600">
                <UserCheck className="w-3 h-3" />{lead.assignedTo.name}
              </span>
            )}
          </div>
        </div>
        <div className="text-gray-300 shrink-0">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-3">
          {lead.comment && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{lead.comment}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {onAssign && lead.status === 'NEW' && (
              <button
                onClick={() => onAssign(lead)}
                className="flex items-center gap-1.5 text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <UserCheck className="w-4 h-4" /> Назначить клоузера
              </button>
            )}
            {showQualify && onQualify && (
              <button
                onClick={() => onQualify(lead.id)}
                className="flex items-center gap-1.5 text-sm bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Взять в работу
              </button>
            )}
            <button
              onClick={() => { if (confirm('Удалить лид?')) onDelete(lead.id) }}
              className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LiderLeadsPage() {
  const qc = useQueryClient()
  const periodState = usePeriodStore()
  const params = buildPeriodParams(periodState)
  const [tab, setTab] = useState<'new' | 'assigned' | 'unqualified'>('new')
  const [showAddModal, setShowAddModal] = useState(false)
  const [assigningLead, setAssigningLead] = useState<Lead | null>(null)

  // Queries
  const newLeadsQ = useQuery({
    queryKey: ['lider-leads', 'new', params],
    queryFn: () => api.get(`/leads?${params}`).then(r => r.data),
  })
  const assignedLeadsQ = useQuery({
    queryKey: ['lider-leads', 'assigned', params],
    queryFn: () => api.get(`/leads/assigned?${params}`).then(r => r.data),
  })
  const unqualifiedLeadsQ = useQuery({
    queryKey: ['lider-leads', 'unqualified', params],
    queryFn: () => api.get(`/leads/unqualified?${params}`).then(r => r.data),
  })
  const channelsQ = useQuery({
    queryKey: ['sales-channels'],
    queryFn: () => api.get('/sales-channels').then(r => r.data),
  })
  const closersQ = useQuery({
    queryKey: ['closers'],
    queryFn: () => api.get('/users').then(r => (r.data as any[]).filter(u => u.managerType === 'CLOSER' && u.status === 'ACTIVE')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lider-leads'] }),
  })
  const qualifyMut = useMutation({
    mutationFn: (id: string) => api.put(`/leads/${id}/qualify`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lider-leads'] }),
  })

  const channels = channelsQ.data || []
  const closers = closersQ.data || []
  const newLeads: Lead[] = newLeadsQ.data || []
  const assignedLeads: Lead[] = assignedLeadsQ.data || []
  const unqualifiedLeads: Lead[] = unqualifiedLeadsQ.data || []

  const currentLeads = tab === 'new' ? newLeads : tab === 'assigned' ? assignedLeads : unqualifiedLeads
  const currentQuery = tab === 'new' ? newLeadsQ : tab === 'assigned' ? assignedLeadsQ : unqualifiedLeadsQ

  const tabs = [
    { key: 'new', label: 'Активные', count: newLeads.length, dot: 'bg-blue-400' },
    { key: 'assigned', label: 'Переданы клоузерам', count: assignedLeads.length, dot: 'bg-purple-400' },
    { key: 'unqualified', label: 'Неквалифицированные', count: unqualifiedLeads.length, dot: 'bg-gray-400' },
  ] as const

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Лиды</h1>
          <p className="text-sm text-gray-400 mt-0.5">Управление входящими заявками</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 btn-primary"
        >
          <Plus className="w-4 h-4" /> Добавить лид
        </button>
      </div>

      {/* Period + stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodSelector />
        <div className="flex gap-3 ml-auto text-sm">
          <div className="card py-2 px-4 text-center">
            <p className="text-xs text-gray-400">Активные</p>
            <p className="font-bold text-blue-600">{newLeads.length}</p>
          </div>
          <div className="card py-2 px-4 text-center">
            <p className="text-xs text-gray-400">Переданы</p>
            <p className="font-bold text-purple-600">{assignedLeads.length}</p>
          </div>
          <div className="card py-2 px-4 text-center">
            <p className="text-xs text-gray-400">Неквал.</p>
            <p className="font-bold text-gray-500">{unqualifiedLeads.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${t.dot}`} />
            {t.label}
            {t.count > 0 && (
              <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lead List */}
      {currentQuery.isLoading && (
        <div className="card text-center text-gray-400 py-12">Загрузка...</div>
      )}

      {!currentQuery.isLoading && currentLeads.length === 0 && (
        <div className="card text-center py-14">
          <User className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {tab === 'new' ? 'Нет активных лидов' : tab === 'assigned' ? 'Нет переданных лидов' : 'Нет неквалифицированных лидов'}
          </p>
          {tab === 'new' && (
            <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-blue-600 hover:underline">
              + Добавить первый лид
            </button>
          )}
          {tab === 'unqualified' && (
            <p className="text-xs text-gray-300 mt-1">При повторном контакте переведите в активные</p>
          )}
        </div>
      )}

      {!currentQuery.isLoading && currentLeads.length > 0 && (
        <div className="space-y-3">
          {currentLeads.map((lead: Lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              closers={closers}
              onAssign={tab === 'new' ? (l) => setAssigningLead(l) : undefined}
              onDelete={(id) => deleteMut.mutate(id)}
              onQualify={tab === 'unqualified' ? (id) => qualifyMut.mutate(id) : undefined}
              showQualify={tab === 'unqualified'}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          closers={closers}
          channels={channels}
        />
      )}
      {assigningLead && (
        <AssignModal
          lead={assigningLead}
          closers={closers}
          onClose={() => setAssigningLead(null)}
        />
      )}
    </div>
  )
}
