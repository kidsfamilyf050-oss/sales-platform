import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import PeriodSelector, { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import { Plus, Phone, Calendar, Trash2, UserCheck, ChevronDown, ChevronUp, X, ExternalLink, Clock, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react'

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
  leadLink: string | null
  subStatus: string | null        // "scheduled" | "refused" | "thinking"
  appointmentDate: string | null  // YYYY-MM-DD
  consultationStatus: string | null // "happened" | "not_happened" | "postponed"
  salesChannel: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  tasks: any[]
}

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(s: string) {
  if (!s) return ''
  return new Date(s + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function statusLabel(s: string) {
  const map: Record<string, { label: string; color: string }> = {
    NEW:         { label: 'Новый',    color: 'bg-blue-100 text-blue-700' },
    ASSIGNED:    { label: 'Передан',  color: 'bg-purple-100 text-purple-700' },
    IN_WORK:     { label: 'В работе', color: 'bg-amber-100 text-amber-700' },
    REFUSED:     { label: 'Отказ',    color: 'bg-red-100 text-red-600' },
    SOLD:        { label: 'Продажа',  color: 'bg-green-100 text-green-700' },
    UNQUALIFIED: { label: 'Неквал.', color: 'bg-gray-100 text-gray-500' },
  }
  return map[s] || { label: s, color: 'bg-gray-100 text-gray-500' }
}

const SUB_STATUS_OPTS = [
  { value: '',          label: '— не указан —' },
  { value: 'scheduled', label: 'Записан на консультацию' },
  { value: 'refused',   label: 'Отказ' },
  { value: 'thinking',  label: 'Думает' },
]

const KTS_STATUS_OPTS = [
  { value: 'in_work',      label: 'В работе КЦ',         desc: 'Ещё обрабатывается' },
  { value: 'qualified',    label: 'Квалифицирован',       desc: 'Прошёл квалификацию' },
  { value: 'unqualified',  label: 'Не квалифицирован',    desc: 'Не подходит' },
]

// ── Add Lead Modal ────────────────────────────────────────────────────────────
function AddLeadModal({ onClose, closers, channels }: {
  onClose: () => void
  closers: { id: string; name: string }[]
  channels: { id: string; name: string }[]
}) {
  const qc = useQueryClient()
  const today = localToday()
  const [form, setForm] = useState({
    clientName: '', phone: '', date: today,
    salesChannelId: '', leadLink: '',
    ktsStatus: 'qualified',    // "in_work" | "qualified" | "unqualified"
    subStatus: '',             // "scheduled" | "refused" | "thinking"
    appointmentDate: today,
    assignedToId: '',
    comment: '',
  })
  const [error, setError] = useState('')

  const dbChannelNames = channels.map((c: { name: string }) => c.name)
  const allChannels = [
    ...channels,
    ...CHANNELS_DEFAULT.filter(n => !dbChannelNames.includes(n)).map(n => ({ id: `__builtin__${n}`, name: n })),
  ]

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/leads', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lider-leads'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.clientName.trim()) return setError('Введите имя клиента')
    if (!form.phone.trim()) return setError('Введите телефон')
    setError('')

    const isQualified = form.ktsStatus === 'qualified'
    const isUnqualified = form.ktsStatus === 'unqualified'
    const channelId = form.salesChannelId?.startsWith('__builtin__') ? null : (form.salesChannelId || null)
    const channelName = form.salesChannelId?.startsWith('__builtin__') ? form.salesChannelId.replace('__builtin__', '') : null
    const commentFull = channelName
      ? `[Канал: ${channelName}]${form.comment ? ' ' + form.comment : ''}`
      : form.comment

    createMutation.mutate({
      clientName: form.clientName,
      phone: form.phone,
      date: form.date,
      salesChannelId: channelId,
      leadLink: form.leadLink || null,
      isQualified: isQualified && !isUnqualified,
      isScheduled: form.subStatus === 'scheduled',
      subStatus: (isQualified && form.subStatus) ? form.subStatus : null,
      appointmentDate: (isQualified && form.subStatus === 'scheduled' && form.appointmentDate) ? form.appointmentDate : null,
      assignedToId: (isQualified && form.subStatus === 'scheduled' && form.assignedToId) ? form.assignedToId : null,
      comment: commentFull,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-lg">Новый лид</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Basic info */}
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
              <label className="text-xs font-semibold text-gray-600 block mb-1">Дата поступления</label>
              <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Рекламный канал</label>
              <select className="input" value={form.salesChannelId} onChange={e => set('salesChannelId', e.target.value)}>
                <option value="">— не выбран —</option>
                {allChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Ссылка на лид</label>
            <input className="input" value={form.leadLink} onChange={e => set('leadLink', e.target.value)} placeholder="https://..." />
          </div>

          {/* KTs status */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">Статус в КЦ</label>
            <div className="grid grid-cols-3 gap-2">
              {KTS_STATUS_OPTS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set('ktsStatus', o.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors text-center ${
                    form.ktsStatus === o.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-status (only when qualified) */}
          {form.ktsStatus === 'qualified' && (
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Результат обзвона</label>
              <select className="input" value={form.subStatus} onChange={e => set('subStatus', e.target.value)}>
                {SUB_STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Appointment fields (only when subStatus = scheduled) */}
          {form.ktsStatus === 'qualified' && form.subStatus === 'scheduled' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Дата консультации</label>
                  <input type="date" className="input" value={form.appointmentDate} onChange={e => set('appointmentDate', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Клоузер</label>
                  <select className="input" value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)}>
                    <option value="">— не выбран —</option>
                    {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Комментарий</label>
            <textarea className="input resize-none h-16" value={form.comment} onChange={e => set('comment', e.target.value)} placeholder="Заметки..." />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 btn-outline">Отмена</button>
          <button onClick={submit} disabled={createMutation.isPending} className="flex-1 btn-primary">
            {createMutation.isPending ? 'Сохраняем...' : 'Добавить лид'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Today Appointments Widget ─────────────────────────────────────────────────
function TodayWidget() {
  const qc = useQueryClient()
  const [postponeId, setPostponeId] = useState<string | null>(null)
  const [postponeDate, setPostponeDate] = useState(localToday())

  const todayQ = useQuery({
    queryKey: ['today-appointments'],
    queryFn: () => api.get('/leads/today-appointments').then(r => r.data),
    refetchInterval: 60000,
  })

  const markMut = useMutation({
    mutationFn: ({ id, consultationStatus, appointmentDate }: { id: string; consultationStatus: string; appointmentDate?: string | null }) =>
      api.put(`/leads/${id}`, { consultationStatus, ...(appointmentDate !== undefined && { appointmentDate }) }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-appointments'] })
      qc.invalidateQueries({ queryKey: ['lider-leads'] })
      setPostponeId(null)
    },
  })

  const leads: Lead[] = todayQ.data || []
  if (!leads.length && !todayQ.isLoading) return null

  const handlePostpone = (id: string) => {
    if (!postponeDate || postponeDate <= localToday()) return
    // Reset consultationStatus to null with new appointmentDate so it appears on new date
    markMut.mutate({ id, consultationStatus: 'postponed', appointmentDate: postponeDate })
    // After short delay reset to null for next appearance
    setTimeout(() => {
      api.put(`/leads/${id}`, { consultationStatus: null, appointmentDate: postponeDate })
        .then(() => { qc.invalidateQueries({ queryKey: ['today-appointments'] }); qc.invalidateQueries({ queryKey: ['lider-leads'] }) })
    }, 300)
    setPostponeId(null)
  }

  return (
    <div className="card border-orange-200 bg-orange-50/40">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-orange-500" />
        <h3 className="font-semibold text-orange-700">Консультации сегодня — нужен статус</h3>
        <span className="ml-auto text-sm font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{leads.length}</span>
      </div>
      <div className="space-y-2">
        {leads.map(lead => (
          <div key={lead.id} className="bg-white rounded-xl border border-orange-100 p-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{lead.clientName}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                  {lead.assignedTo && (
                    <span className="flex items-center gap-1 text-purple-600"><UserCheck className="w-3 h-3" />{lead.assignedTo.name}</span>
                  )}
                  {lead.leadLink && (
                    <a href={lead.leadLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Ссылка
                    </a>
                  )}
                </div>
              </div>
              {postponeId === lead.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    className="input py-1 px-2 text-xs w-36"
                    value={postponeDate}
                    min={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()}
                    onChange={e => setPostponeDate(e.target.value)}
                  />
                  <button
                    onClick={() => handlePostpone(lead.id)}
                    disabled={!postponeDate || postponeDate <= localToday() || markMut.isPending}
                    className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
                  >
                    Сохранить
                  </button>
                  <button onClick={() => setPostponeId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => markMut.mutate({ id: lead.id, consultationStatus: 'happened' })}
                    disabled={markMut.isPending}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Состоялась
                  </button>
                  <button
                    onClick={() => markMut.mutate({ id: lead.id, consultationStatus: 'not_happened' })}
                    disabled={markMut.isPending}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Не состоялась
                  </button>
                  <button
                    onClick={() => { setPostponeId(lead.id); setPostponeDate((() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()) }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Перенос
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Edit Lead Modal ───────────────────────────────────────────────────────────
function EditLeadModal({ lead, closers, channels, onClose }: {
  lead: Lead
  closers: { id: string; name: string }[]
  channels: { id: string; name: string }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    clientName: lead.clientName,
    phone: lead.phone,
    date: lead.date,
    salesChannelId: lead.salesChannel?.id || '',
    leadLink: lead.leadLink || '',
    ktsStatus: lead.status === 'UNQUALIFIED' ? 'unqualified' : lead.isQualified ? 'qualified' : 'in_work',
    subStatus: lead.subStatus || '',
    appointmentDate: lead.appointmentDate || localToday(),
    assignedToId: lead.assignedTo?.id || '',
    consultationStatus: lead.consultationStatus || '',
    comment: lead.comment || '',
  })
  const [error, setError] = useState('')

  const dbChannelNames = channels.map((c: { name: string }) => c.name)
  const allChannels = [...channels, ...CHANNELS_DEFAULT.filter(n => !dbChannelNames.includes(n)).map(n => ({ id: `__builtin__${n}`, name: n }))]

  const updateMut = useMutation({
    mutationFn: (data: any) => api.put(`/leads/${lead.id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lider-leads'] }); qc.invalidateQueries({ queryKey: ['today-appointments'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.clientName.trim()) return setError('Введите имя')
    setError('')
    const isQualified = form.ktsStatus === 'qualified'
    const channelId = form.salesChannelId?.startsWith('__builtin__') ? null : (form.salesChannelId || null)
    updateMut.mutate({
      clientName: form.clientName,
      phone: form.phone,
      date: form.date,
      salesChannelId: channelId,
      leadLink: form.leadLink || null,
      isQualified,
      isScheduled: form.subStatus === 'scheduled',
      subStatus: (isQualified && form.subStatus) ? form.subStatus : null,
      appointmentDate: (isQualified && form.subStatus === 'scheduled' && form.appointmentDate) ? form.appointmentDate : null,
      assignedToId: (isQualified && form.subStatus === 'scheduled' && form.assignedToId) ? form.assignedToId : null,
      consultationStatus: form.consultationStatus || null,
      comment: form.comment,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-lg">Редактировать лид</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Имя клиента</label>
              <input className="input" value={form.clientName} onChange={e => set('clientName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Телефон</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Дата поступления</label>
              <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Рекламный канал</label>
              <select className="input" value={form.salesChannelId} onChange={e => set('salesChannelId', e.target.value)}>
                <option value="">— не выбран —</option>
                {allChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Ссылка на лид</label>
            <input className="input" value={form.leadLink} onChange={e => set('leadLink', e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">Статус в КЦ</label>
            <div className="grid grid-cols-3 gap-2">
              {KTS_STATUS_OPTS.map(o => (
                <button key={o.value} type="button" onClick={() => set('ktsStatus', o.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors text-center ${form.ktsStatus === o.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {form.ktsStatus === 'qualified' && (
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Результат обзвона</label>
              <select className="input" value={form.subStatus} onChange={e => set('subStatus', e.target.value)}>
                {SUB_STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          {form.ktsStatus === 'qualified' && form.subStatus === 'scheduled' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Дата консультации</label>
                <input type="date" className="input" value={form.appointmentDate} onChange={e => set('appointmentDate', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Клоузер</label>
                <select className="input" value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)}>
                  <option value="">— не выбран —</option>
                  {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Consultation status (only when appointment was set) */}
          {(lead.appointmentDate || (form.ktsStatus === 'qualified' && form.subStatus === 'scheduled')) && (
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-2">Статус консультации</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { v: '', label: '— не отмечена —', cls: 'border-gray-200 text-gray-500' },
                  { v: 'happened', label: '✓ Состоялась', cls: 'border-green-300 text-green-700 bg-green-50' },
                  { v: 'not_happened', label: '✗ Не состоялась', cls: 'border-red-300 text-red-600 bg-red-50' },
                  { v: 'postponed', label: '→ Перенос', cls: 'border-blue-300 text-blue-700 bg-blue-50' },
                ].map(o => (
                  <button key={o.v} type="button" onClick={() => set('consultationStatus', o.v)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${form.consultationStatus === o.v ? 'ring-2 ring-offset-1 ring-blue-400 ' + o.cls : 'bg-white ' + o.cls}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Комментарий</label>
            <textarea className="input resize-none h-16" value={form.comment} onChange={e => set('comment', e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 btn-outline">Отмена</button>
          <button onClick={submit} disabled={updateMut.isPending} className="flex-1 btn-primary">
            {updateMut.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, closers, channels, onDelete }: {
  lead: Lead
  closers: { id: string; name: string }[]
  channels: { id: string; name: string }[]
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const st = statusLabel(lead.status)

  const subStatusBadge = () => {
    if (!lead.subStatus) return null
    const map: Record<string, { label: string; color: string }> = {
      scheduled:    { label: 'Записан', color: 'bg-blue-100 text-blue-700' },
      refused:      { label: 'Отказ', color: 'bg-red-100 text-red-600' },
      thinking:     { label: 'Думает', color: 'bg-yellow-100 text-yellow-700' },
    }
    const b = map[lead.subStatus]
    if (!b) return null
    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${b.color}`}>{b.label}</span>
  }

  const consultBadge = () => {
    if (!lead.consultationStatus) return null
    const map: Record<string, { label: string; color: string }> = {
      happened:     { label: '✓ Состоялась', color: 'bg-green-100 text-green-700' },
      not_happened: { label: '✗ Не состоялась', color: 'bg-red-100 text-red-600' },
      postponed:    { label: '→ Перенос', color: 'bg-blue-100 text-blue-700' },
    }
    const b = map[lead.consultationStatus]
    if (!b) return null
    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${b.color}`}>{b.label}</span>
  }

  return (
    <>
      {editing && <EditLeadModal lead={lead} closers={closers} channels={channels} onClose={() => setEditing(false)} />}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 text-sm">{lead.clientName}</p>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
              {lead.isQualified && <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Квал.</span>}
              {subStatusBadge()}
              {consultBadge()}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{lead.date}</span>
              {lead.salesChannel && <span className="text-gray-500">{lead.salesChannel.name}</span>}
              {lead.appointmentDate && (
                <span className="flex items-center gap-1 text-orange-600">
                  <Clock className="w-3 h-3" /> Конс: {fmtDate(lead.appointmentDate)}
                </span>
              )}
              {lead.assignedTo && (
                <span className="flex items-center gap-1 text-purple-600"><UserCheck className="w-3 h-3" />{lead.assignedTo.name}</span>
              )}
            </div>
          </div>
          <div className="text-gray-300 shrink-0">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {open && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-3">
            {lead.leadLink && (
              <a href={lead.leadLink} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                <ExternalLink className="w-3.5 h-3.5" /> Ссылка на лид
              </a>
            )}
            {lead.comment && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{lead.comment}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                ✎ Редактировать
              </button>
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
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LiderLeadsPage() {
  const qc = useQueryClient()
  const periodState = usePeriodStore()
  const params = buildPeriodParams(periodState)
  const [tab, setTab] = useState<'new' | 'assigned' | 'unqualified'>('new')
  const [showAddModal, setShowAddModal] = useState(false)

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
  const channelsQ = useQuery({ queryKey: ['sales-channels'], queryFn: () => api.get('/sales-channels').then(r => r.data) })
  const closersQ = useQuery({ queryKey: ['closers'], queryFn: () => api.get('/users/closers').then(r => r.data) })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lider-leads'] }); qc.invalidateQueries({ queryKey: ['today-appointments'] }) },
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
      {showAddModal && <AddLeadModal onClose={() => setShowAddModal(false)} closers={closers} channels={channels} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Лиды</h1>
          <p className="text-sm text-gray-400 mt-0.5">Управление входящими заявками</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 btn-primary">
          <Plus className="w-4 h-4" /> Добавить лид
        </button>
      </div>

      {/* Today appointments widget */}
      <TodayWidget />

      {/* Period + stats */}
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
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${t.dot}`} />
            {t.label}
            {t.count > 0 && <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Lead list */}
      {currentQuery.isLoading && <div className="card text-center text-gray-400 py-12">Загрузка...</div>}

      {!currentQuery.isLoading && currentLeads.length === 0 && (
        <div className="card text-center py-14">
          <p className="text-gray-400 font-medium">Нет лидов в этом периоде</p>
          <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-blue-500 hover:underline">
            + Добавить лид
          </button>
        </div>
      )}

      {!currentQuery.isLoading && currentLeads.length > 0 && (
        <div className="space-y-2">
          {currentLeads.map((lead: Lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              closers={closers}
              channels={channels}
              onDelete={id => { if (confirm('Удалить лид?')) deleteMut.mutate(id) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
