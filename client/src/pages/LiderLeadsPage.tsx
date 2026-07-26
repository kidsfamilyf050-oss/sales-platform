import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import {
  Plus, Search, X, ExternalLink, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, MoreVertical, Bell, Clock,
  AlertCircle, Download, RefreshCw, Calendar, Phone, Check, Pencil,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Lead {
  id: string
  clientName: string
  phone: string
  date: string
  createdAt: string
  leadLink?: string | null
  salesChannelId?: string | null
  salesChannel?: { id: string; name: string } | null
  isQualified: boolean
  status: string
  assignedToId?: string | null
  assignedTo?: { id: string; name: string } | null
  subStatus?: string | null
  appointmentDate?: string | null
  appointmentTime?: string | null
  consultationStatus?: string | null
  postponedDate?: string | null
  postponedTime?: string | null
  comment?: string | null
}

interface Stats {
  totalLeads: number
  totalScheduledToday: number
  totalHappened: number
  totalCancelled: number
  totalPostponed: number
  totalScheduled: number
  conversionToScheduled: number
  funnel: { total: number; qualified: number; scheduled: number; happened: number; sold: number }
}

interface Reminders {
  needStatusUpdate: number
  thinkingTooLong: number
  postponedNoDate: number
}

interface ReportData {
  leads: Lead[]
  stats: Stats
  reminders: Reminders
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) =>
  d ? d.split('-').reverse().join('.') : '—'

const fmtDateTime = (date?: string | null, time?: string | null) => {
  if (!date) return '—'
  return time ? `${fmtDate(date)} ${time}` : fmtDate(date)
}

const fmtCreatedAt = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0

// Local date string (device timezone — correct for KZ users)
const localDateStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const tomorrowDateStr = () => {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function KtsBadge({ lead }: { lead: Lead }) {
  if (!lead.isQualified || lead.status === 'UNQUALIFIED')
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Не квал</span>
  if (lead.assignedToId)
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">В работе КЦ</span>
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Квал</span>
}

function SubStatusBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-gray-300 text-xs">—</span>
  const map: Record<string, { label: string; cls: string }> = {
    scheduled: { label: 'Записан', cls: 'bg-green-100 text-green-700' },
    refused:   { label: 'Отказ',  cls: 'bg-red-100 text-red-700' },
    thinking:  { label: 'Думает', cls: 'bg-orange-100 text-orange-700' },
  }
  const s = map[value]
  if (!s) return <span className="text-gray-400 text-xs">{value}</span>
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
}

function ConsultationBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-gray-300 text-xs">—</span>
  const map: Record<string, { label: string; cls: string }> = {
    happened:     { label: 'Состоялась',    cls: 'bg-green-100 text-green-700' },
    not_happened: { label: 'Не состоялась', cls: 'bg-red-100 text-red-700' },
    postponed:    { label: 'Перенос',       cls: 'bg-orange-100 text-orange-700' },
    planned:      { label: 'Запланировано', cls: 'bg-cyan-100 text-cyan-700' },
  }
  const s = map[value]
  if (!s) return <span className="text-gray-400 text-xs">{value}</span>
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
}

// ── Row Menu (portal — fixes overflow clipping) ───────────────────────────────
function RowMenu({ lead, onEdit, onStatus, onDelete }: {
  lead: Lead
  onEdit: () => void
  onStatus: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: Math.max(8, r.right - 180) })
    }
    setOpen(p => !p)
  }

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const canSetStatus = !!(lead.appointmentDate || lead.subStatus === 'scheduled')

  return (
    <>
      <button ref={btnRef} onClick={handleOpen}
        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 w-48">
          <button onClick={() => { setOpen(false); onEdit() }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            ✏️ Редактировать
          </button>
          {canSetStatus && (
            <button onClick={() => { setOpen(false); onStatus() }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              📋 Статус встречи
            </button>
          )}
          <div className="border-t border-gray-100 my-1" />
          <button onClick={() => { setOpen(false); onDelete() }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
            🗑 Удалить
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

// ── AddLeadModal ──────────────────────────────────────────────────────────────
function AddLeadModal({
  onClose, channels, closers,
}: {
  onClose: () => void
  channels: { id: string; name: string }[]
  closers: { id: string; name: string }[]
}) {
  const qc = useQueryClient()
  const [clientName, setClientName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(localDateStr()) // fix: use local timezone date
  const [leadLink, setLeadLink] = useState('')
  const [salesChannelId, setSalesChannelId] = useState('')
  const [ktsMode, setKtsMode] = useState<'qual' | 'unqual' | 'inwork'>('qual')
  const [subStatus, setSubStatus] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [comment, setComment] = useState('')

  // Fix: when switching to unqual, clear subStatus and appointment fields
  const handleKtsModeChange = (mode: 'qual' | 'unqual' | 'inwork') => {
    setKtsMode(mode)
    if (mode === 'unqual') {
      setSubStatus('')
      setAppointmentDate('')
      setAppointmentTime('')
    }
  }

  // Fix: when switching subStatus to 'refused', clear appointment fields
  const handleSubStatusChange = (val: string) => {
    setSubStatus(val)
    if (val === 'refused' || val === 'thinking') {
      setAppointmentDate('')
      setAppointmentTime('')
    }
  }

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/leads', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lider-report'] }); onClose() },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim() || !phone.trim()) return
    const isQualified = ktsMode !== 'unqual'
    // Fix: only set assignedToId when ktsMode === 'inwork' (not for qual+scheduled)
    const chosenAssignee = ktsMode === 'inwork' ? assignedToId || undefined : undefined
    mutation.mutate({
      clientName: clientName.trim(), phone: phone.trim(), date,
      leadLink: leadLink || undefined,
      salesChannelId: salesChannelId || undefined,
      isQualified, assignedToId: chosenAssignee,
      subStatus: (ktsMode !== 'unqual' && subStatus) ? subStatus : undefined,
      appointmentDate: subStatus === 'scheduled' ? appointmentDate || undefined : undefined,
      appointmentTime: subStatus === 'scheduled' ? appointmentTime || undefined : undefined,
      comment: comment || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Добавить лид</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Имя клиента *</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Иван Иванов" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Телефон *</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+7 999 000 00 00" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Дата поступления</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Рекламный канал</label>
              <select value={salesChannelId} onChange={e => setSalesChannelId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">— не выбран —</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Ссылка на лид в рекламном кабинете</label>
            <input value={leadLink} onChange={e => setLeadLink(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Квалификация</label>
            <div className="grid grid-cols-3 gap-2">
              {(['qual', 'unqual', 'inwork'] as const).map(mode => {
                const cfg = {
                  qual:   { label: 'Квал',        on: 'bg-green-600 text-white shadow-sm' },
                  unqual: { label: 'Не квал',      on: 'bg-red-500 text-white shadow-sm' },
                  inwork: { label: 'В работе КЦ',  on: 'bg-blue-600 text-white shadow-sm' },
                }[mode]
                return (
                  <button key={mode} type="button" onClick={() => handleKtsModeChange(mode)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${ktsMode === mode ? cfg.on : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {ktsMode !== 'unqual' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Статус: Записан / Отказ / Думает</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['scheduled', 'Записан',  'bg-green-600 text-white'],
                  ['refused',   'Отказ',    'bg-red-500 text-white'],
                  ['thinking',  'Думает',   'bg-orange-500 text-white'],
                ].map(([val, label, cls]) => (
                  <button key={val} type="button" onClick={() => handleSubStatusChange(subStatus === val ? '' : val)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${subStatus === val ? cls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {ktsMode !== 'unqual' && subStatus === 'scheduled' && (
            <div className="p-3.5 bg-green-50 border border-green-100 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-green-700">Дата и время консультации</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)}
                  className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)}
                  className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            </div>
          )}

          {/* Fix: only show closer dropdown when ktsMode === 'inwork' */}
          {ktsMode === 'inwork' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Клоузер</label>
              <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">— не назначен —</option>
                {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Комментарий</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Необязательно" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
              {mutation.isPending ? 'Сохранение...' : 'Добавить лид'}
            </button>
          </div>
          {mutation.isError && <p className="text-xs text-red-600 text-center">Ошибка при сохранении</p>}
        </form>
      </div>
    </div>
  )
}

// ── EditLeadModal ─────────────────────────────────────────────────────────────
function EditLeadModal({
  lead, onClose, channels, closers,
}: {
  lead: Lead
  onClose: () => void
  channels: { id: string; name: string }[]
  closers: { id: string; name: string }[]
}) {
  const qc = useQueryClient()
  const [clientName, setClientName] = useState(lead.clientName)
  const [phone, setPhone] = useState(lead.phone)
  const [date, setDate] = useState(lead.date)
  const [leadLink, setLeadLink] = useState(lead.leadLink || '')
  const [salesChannelId, setSalesChannelId] = useState(lead.salesChannelId || '')
  const [ktsMode, setKtsMode] = useState<'qual' | 'unqual' | 'inwork'>(
    !lead.isQualified ? 'unqual' : lead.assignedToId ? 'inwork' : 'qual'
  )
  const [subStatus, setSubStatus] = useState(lead.subStatus || '')
  const [appointmentDate, setAppointmentDate] = useState(lead.appointmentDate || '')
  const [appointmentTime, setAppointmentTime] = useState(lead.appointmentTime || '')
  const [assignedToId, setAssignedToId] = useState(lead.assignedToId || '')
  const [consultationStatus, setConsultationStatus] = useState(lead.consultationStatus || '')
  const [postponedDate, setPostponedDate] = useState(lead.postponedDate || '')
  const [postponedTime, setPostponedTime] = useState(lead.postponedTime || '')
  const [comment, setComment] = useState(lead.comment || '')

  const mutation = useMutation({
    mutationFn: (data: any) => api.put(`/leads/${lead.id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lider-report'] })
      qc.invalidateQueries({ queryKey: ['today-appointments'] })
      qc.invalidateQueries({ queryKey: ['overdue-appointments'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const isQualified = ktsMode !== 'unqual'
    // Fix: only set assignedToId when ktsMode === 'inwork'
    const chosenAssignee = ktsMode === 'inwork' ? assignedToId || null : null
    mutation.mutate({
      clientName: clientName.trim(), phone: phone.trim(), date,
      leadLink: leadLink || null, salesChannelId: salesChannelId || null,
      isQualified, assignedToId: chosenAssignee,
      subStatus: (ktsMode !== 'unqual' && subStatus) ? subStatus : null,
      appointmentDate: subStatus === 'scheduled' ? appointmentDate || null : null,
      appointmentTime: subStatus === 'scheduled' ? appointmentTime || null : null,
      consultationStatus: consultationStatus || null,
      postponedDate: consultationStatus === 'postponed' ? postponedDate || null : null,
      postponedTime: consultationStatus === 'postponed' ? postponedTime || null : null,
      comment: comment || null,
    })
  }

  const hasAppointment = !!(subStatus === 'scheduled' || lead.subStatus === 'scheduled' || lead.appointmentDate)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Редактировать лид</h2>
            <p className="text-xs text-gray-400 mt-0.5">{lead.clientName} · {lead.phone}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Имя клиента</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Дата поступления</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Рекламный канал</label>
              <select value={salesChannelId} onChange={e => setSalesChannelId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">— не выбран —</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Ссылка на лид</label>
            <input value={leadLink} onChange={e => setLeadLink(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Квалификация</label>
            <div className="grid grid-cols-3 gap-2">
              {(['qual', 'unqual', 'inwork'] as const).map(mode => {
                const cfg = {
                  qual:   { label: 'Квал',       on: 'bg-green-600 text-white' },
                  unqual: { label: 'Не квал',     on: 'bg-red-500 text-white' },
                  inwork: { label: 'В работе КЦ', on: 'bg-blue-600 text-white' },
                }[mode]
                return (
                  <button key={mode} type="button" onClick={() => setKtsMode(mode)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${ktsMode === mode ? cfg.on : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {ktsMode !== 'unqual' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Статус: Записан / Отказ / Думает</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['scheduled', 'Записан', 'bg-green-600 text-white'],
                  ['refused',   'Отказ',   'bg-red-500 text-white'],
                  ['thinking',  'Думает',  'bg-orange-500 text-white'],
                ].map(([val, label, cls]) => (
                  <button key={val} type="button" onClick={() => setSubStatus(subStatus === val ? '' : val)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${subStatus === val ? cls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {ktsMode !== 'unqual' && subStatus === 'scheduled' && (
            <div className="p-3.5 bg-green-50 border border-green-100 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-green-700">Дата и время консультации</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)}
                  className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)}
                  className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            </div>
          )}

          {/* Fix: only show closer dropdown when ktsMode === 'inwork' */}
          {ktsMode === 'inwork' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Клоузер</label>
              <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">— не назначен —</option>
                {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {hasAppointment && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Статус встречи</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['planned',      'Запланировано', 'bg-cyan-600 text-white'],
                  ['happened',     'Состоялась',    'bg-green-600 text-white'],
                  ['not_happened', 'Не состоялась', 'bg-red-500 text-white'],
                  ['postponed',    'Перенос',       'bg-orange-500 text-white'],
                ].map(([val, label, cls]) => (
                  <button key={val} type="button"
                    onClick={() => {
                      const newVal = consultationStatus === val ? '' : val
                      setConsultationStatus(newVal)
                      // Auto-fill postponedDate with tomorrow when selecting postponed
                      if (newVal === 'postponed' && !postponedDate) setPostponedDate(tomorrowDateStr())
                    }}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${consultationStatus === val ? cls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {consultationStatus === 'postponed' && (
            <div className="p-3.5 bg-orange-50 border border-orange-100 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-orange-700">Перенесено на</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={postponedDate} onChange={e => setPostponedDate(e.target.value)}
                  className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <input type="time" value={postponedTime} onChange={e => setPostponedTime(e.target.value)}
                  className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Комментарий</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
              {mutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
          {mutation.isError && <p className="text-xs text-red-600 text-center">Ошибка при сохранении</p>}
        </form>
      </div>
    </div>
  )
}

// ── QuickStatusModal ──────────────────────────────────────────────────────────
function QuickStatusModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(lead.consultationStatus || '')
  const [pDate, setPDate] = useState(lead.postponedDate || '')
  const [pTime, setPTime] = useState(lead.postponedTime || '')

  const mutation = useMutation({
    mutationFn: (data: any) => api.put(`/leads/${lead.id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lider-report'] })
      qc.invalidateQueries({ queryKey: ['today-appointments'] })
      qc.invalidateQueries({ queryKey: ['overdue-appointments'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Статус встречи</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <p className="text-sm font-semibold text-gray-900">{lead.clientName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{lead.phone}</p>
          {(lead.appointmentDate || lead.postponedDate) && (
            <p className="text-xs text-blue-600 mt-1">
              📅 {fmtDateTime(lead.postponedDate || lead.appointmentDate, lead.postponedTime || lead.appointmentTime)}
              {lead.assignedTo ? ` · ${lead.assignedTo.name}` : ''}
            </p>
          )}
        </div>
        <div className="space-y-2 mb-4">
          {[
            ['planned',      '📅 Запланировано', 'border-cyan-500 bg-cyan-50 text-cyan-800'],
            ['happened',     '✅ Состоялась',    'border-green-500 bg-green-50 text-green-800'],
            ['not_happened', '❌ Не состоялась', 'border-red-500 bg-red-50 text-red-800'],
            ['postponed',    '🔄 Перенос',       'border-orange-500 bg-orange-50 text-orange-800'],
          ].map(([val, label, cls]) => (
            <button key={val} onClick={() => {
              setStatus(val)
              // Auto-fill postponedDate with tomorrow when selecting 'postponed'
              if (val === 'postponed' && !pDate) setPDate(tomorrowDateStr())
            }}
              className={`w-full py-3 rounded-xl text-sm font-semibold border-2 transition-all ${status === val ? cls : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        {status === 'postponed' && (
          <div className="p-3.5 bg-orange-50 border border-orange-100 rounded-xl mb-4 space-y-2">
            <p className="text-xs font-semibold text-orange-700">Перенесено на</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={pDate} onChange={e => setPDate(e.target.value)}
                className="w-full border border-orange-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <input type="time" value={pTime} onChange={e => setPTime(e.target.value)}
                className="w-full border border-orange-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={() => mutation.mutate({
            consultationStatus: status || null,
            postponedDate: status === 'postponed' ? pDate || null : null,
            postponedTime: status === 'postponed' ? pTime || null : null,
          })} disabled={!status || mutation.isPending}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            {mutation.isPending ? '...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LiderLeadsPage() {
  const qc = useQueryClient()

  // Global period (from header PeriodSelector)
  const periodStore = usePeriodStore()

  // Pending filters (not yet applied — user fills then clicks "Применить")
  const [pendingSearch, setPendingSearch] = useState('')
  const [pendingChannelId, setPendingChannelId] = useState('')
  const [pendingKtsStatus, setPendingKtsStatus] = useState('')
  const [pendingSubStatus, setPendingSubStatus] = useState('')
  const [pendingConsultation, setPendingConsultation] = useState('')
  const [pendingDate, setPendingDate] = useState('')

  // Applied filters (drive the query)
  const [search, setSearch] = useState('')
  const [channelId, setChannelId] = useState('')
  const [ktsStatus, setKtsStatus] = useState('')
  const [subStatusFilter, setSubStatusFilter] = useState('')
  const [consultationFilter, setConsultationFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  // Sort
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // Inline add row
  const [showInlineAdd, setShowInlineAdd] = useState(false)
  const [inlineName, setInlineName] = useState('')
  const [inlinePhone, setInlinePhone] = useState('')
  const [inlineKtsMode, setInlineKtsMode] = useState<'qual' | 'unqual' | 'inwork'>('qual')
  const [inlineDate, setInlineDate] = useState(localDateStr())
  const [inlineChannelId, setInlineChannelId] = useState('')
  const [inlineLeadLink, setInlineLeadLink] = useState('')
  const [inlineCloserId, setInlineCloserId] = useState('')
  const [inlineSubStatus, setInlineSubStatus] = useState('')
  const [inlineAppointmentDate, setInlineAppointmentDate] = useState('')
  const [inlineAppointmentTime, setInlineAppointmentTime] = useState('')
  const [inlineConsultationStatus, setInlineConsultationStatus] = useState('')

  // Modals
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [statusLead, setStatusLead] = useState<Lead | null>(null)
  const [showAllToday, setShowAllToday] = useState(true)

  const resetPage = () => setPage(1)

  const applyFilters = () => {
    setSearch(pendingSearch)
    setChannelId(pendingChannelId)
    setKtsStatus(pendingKtsStatus)
    setSubStatusFilter(pendingSubStatus)
    setConsultationFilter(pendingConsultation)
    setDateFilter(pendingDate)
    resetPage()
  }

  const resetFilters = () => {
    setPendingSearch(''); setPendingChannelId(''); setPendingKtsStatus('')
    setPendingSubStatus(''); setPendingConsultation(''); setPendingDate('')
    setSearch(''); setChannelId(''); setKtsStatus('')
    setSubStatusFilter(''); setConsultationFilter(''); setDateFilter('')
    resetPage()
  }

  // Set reminder-based filter (also syncs pending)
  const applyQuickFilter = (updates: Record<string, string>) => {
    const ns = updates.subStatus ?? subStatusFilter
    const nc = updates.consultationStatus ?? consultationFilter
    setSubStatusFilter(ns); setPendingSubStatus(ns)
    setConsultationFilter(nc); setPendingConsultation(nc)
    resetPage()
  }

  // Build params using global period + applied filters
  const buildParams = () => {
    const p = new URLSearchParams(buildPeriodParams(periodStore))
    if (search) p.set('search', search)
    if (channelId) p.set('channelId', channelId)
    if (ktsStatus) p.set('ktsStatus', ktsStatus)
    if (subStatusFilter) p.set('subStatus', subStatusFilter)
    if (consultationFilter) p.set('consultationStatus', consultationFilter)
    if (dateFilter) p.set('date', dateFilter)
    return p.toString()
  }

  const qKey = ['lider-report', periodStore.period, periodStore.customFrom, periodStore.customTo,
    search, channelId, ktsStatus, subStatusFilter, consultationFilter, dateFilter]

  const { data, isLoading, refetch } = useQuery<ReportData>({
    queryKey: qKey,
    queryFn: () => api.get(`/leads/lider-report?${buildParams()}`).then(r => r.data),
  })

  const { data: channels = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['sales-channels'],
    queryFn: () => api.get('/sales-channels').then(r => r.data),
  })

  // ✅ Fix #1/#2: use /users/closers (accessible to all authenticated users)
  const { data: closers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['closers-list'],
    queryFn: () => api.get('/users/closers').then(r => r.data),
  })

  const { data: todayLeads = [] } = useQuery<Lead[]>({
    queryKey: ['today-appointments'],
    queryFn: () => api.get('/leads/today-appointments').then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: overdueLeads = [] } = useQuery<Lead[]>({
    queryKey: ['overdue-appointments'],
    queryFn: () => api.get('/leads/overdue-appointments').then(r => r.data),
    refetchInterval: 60000,
  })
  const [showOverdue, setShowOverdue] = useState(true)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lider-report'] }),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/leads', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lider-report'] })
      resetInlineForm()
    },
  })

  const handleDelete = (lead: Lead) => {
    if (confirm(`Удалить лид "${lead.clientName}"?`)) deleteMutation.mutate(lead.id)
  }

  const resetInlineForm = () => {
    setInlineName(''); setInlinePhone(''); setInlineChannelId('')
    setInlineDate(localDateStr()); setInlineLeadLink('')
    setInlineKtsMode('qual')
    setInlineCloserId(''); setInlineSubStatus(''); setInlineAppointmentDate(''); setInlineAppointmentTime(''); setInlineConsultationStatus('')
    setShowInlineAdd(false)
  }

  const saveInlineLead = () => {
    if (!inlineName.trim()) return
    createMutation.mutate({
      clientName: inlineName.trim(),
      phone: '',
      date: inlineDate,
      salesChannelId: inlineChannelId || undefined,
      leadLink: inlineLeadLink || undefined,
      assignedToId: inlineKtsMode === 'inwork' ? inlineCloserId || undefined : undefined,
      subStatus: inlineKtsMode === 'unqual' ? undefined : inlineSubStatus || undefined,
      appointmentDate: inlineKtsMode === 'unqual' ? undefined : inlineAppointmentDate || undefined,
      appointmentTime: inlineKtsMode === 'unqual' ? undefined : inlineAppointmentTime || undefined,
      consultationStatus: inlineConsultationStatus || undefined,
      isQualified: inlineKtsMode !== 'unqual',
    })
  }

  // Sort
  const sortedLeads = useMemo(() => {
    const arr = [...(data?.leads || [])]
    arr.sort((a, b) => {
      let va: any, vb: any
      if (sortField === 'createdAt') { va = a.date; vb = b.date }
      else if (sortField === 'channel') { va = a.salesChannel?.name || ''; vb = b.salesChannel?.name || '' }
      else if (sortField === 'subStatus') { va = a.subStatus || ''; vb = b.subStatus || '' }
      else if (sortField === 'consultationStatus') { va = a.consultationStatus || ''; vb = b.consultationStatus || '' }
      else { va = (a as any)[sortField] || ''; vb = (b as any)[sortField] || '' }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [data?.leads, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / pageSize))
  const pageLeads = sortedLeads.slice((page - 1) * pageSize, page * pageSize)

  const stats = data?.stats
  const reminders = data?.reminders
  const funnel = stats?.funnel

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    resetPage()
  }

  const SortIcon = ({ field }: { field: string }) => (
    <span className="inline-flex flex-col ml-1 align-middle translate-y-[-1px]">
      <ChevronUp className={`w-3 h-3 -mb-0.5 ${sortField === field && sortDir === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} />
      <ChevronDown className={`w-3 h-3 ${sortField === field && sortDir === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} />
    </span>
  )

  // ✅ Fix #5: Excel export via server (ExcelJS)
  const exportExcel = async () => {
    try {
      const res = await api.get(`/export/lider-leads?${buildParams()}`, { responseType: 'blob' })
      const blob = new Blob([res.data as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `lider-leads-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch { alert('Ошибка экспорта') }
  }

  const filtersActive = !!(search || channelId || ktsStatus || subStatusFilter || consultationFilter || dateFilter)

  const today = localDateStr()
  // todayLeads shown as collapsible strip above table (showAllToday toggles expand)
  const totalReminderCount = (reminders?.needStatusUpdate || 0) + (reminders?.thinkingTooLong || 0) + (reminders?.postponedNoDate || 0)

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
      <div className="p-4 md:p-6 max-w-[1500px] mx-auto">

        {/* ── Header: no local period tabs, no Add button ── */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Отчёт лидоруба</h1>
            {totalReminderCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-100 rounded-full px-2.5 py-1">
                <Bell className="w-3 h-3" /> {totalReminderCount}
              </span>
            )}
          </div>
          <div className="flex-1" />
          {/* ✅ Fix #5: Excel export */}
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <Download className="w-4 h-4" /> Экспорт Excel
          </button>
          <button onClick={() => refetch()}
            className="p-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors" title="Обновить">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {[
            { label: 'Всего лидов',        value: stats?.totalLeads,           sub: 'За период',   color: 'text-gray-900' },
            { label: 'Записаны сегодня',   value: stats?.totalScheduledToday,  sub: null,          color: 'text-blue-600' },
            { label: 'Состоялись',         value: stats?.totalHappened,        sub: stats?.totalScheduled ? `${pct(stats.totalHappened, stats.totalScheduled)}% от записанных` : '', color: 'text-green-600' },
            { label: 'Отменились',         value: stats?.totalCancelled,       sub: stats?.totalScheduled ? `${pct(stats.totalCancelled, stats.totalScheduled)}% от записанных` : '', color: 'text-red-500' },
            { label: 'Перенесены',         value: stats?.totalPostponed,       sub: stats?.totalScheduled ? `${pct(stats.totalPostponed, stats.totalScheduled)}% от записанных` : '', color: 'text-orange-500' },
            { label: 'Конверсия в запись', value: `${stats?.conversionToScheduled ?? '—'}%`, sub: stats ? `${stats.totalScheduled} из ${stats.totalLeads} лидов` : '', color: 'text-purple-600' },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
              <p className="text-xs text-gray-400 mb-1.5 leading-tight font-medium">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value ?? '—'}</p>
              {i === 1 && (stats?.totalScheduledToday ?? 0) > 0 && (
                <button onClick={() => setShowAllToday(true)} className="text-xs text-blue-500 hover:underline mt-1 block font-medium">
                  Смотреть список →
                </button>
              )}
              {card.sub && <p className="text-xs text-gray-400 mt-1">{card.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Filters with deferred Apply button ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-2.5 items-end">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={pendingSearch} onChange={e => setPendingSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                placeholder="Поиск по имени, телефону, ссылке..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            {/* ✅ Fix #2/#7: channel filter with pending state */}
            <select value={pendingChannelId} onChange={e => setPendingChannelId(e.target.value)}
              className={`py-2 px-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${pendingChannelId ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600'}`}>
              <option value="">Все каналы</option>
              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={pendingKtsStatus} onChange={e => setPendingKtsStatus(e.target.value)}
              className={`py-2 px-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${pendingKtsStatus ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600'}`}>
              <option value="">Квал/Не квал</option>
              <option value="qualified">Квал</option>
              <option value="unqualified">Не квал</option>
              <option value="in_work">В работе КЦ</option>
            </select>
            <select value={pendingSubStatus} onChange={e => setPendingSubStatus(e.target.value)}
              className={`py-2 px-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${pendingSubStatus ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600'}`}>
              <option value="">Статус записи</option>
              <option value="scheduled">Записан</option>
              <option value="refused">Отказ</option>
              <option value="thinking">Думает</option>
            </select>
            <select value={pendingConsultation} onChange={e => setPendingConsultation(e.target.value)}
              className={`py-2 px-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${pendingConsultation ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600'}`}>
              <option value="">Статус встречи</option>
              <option value="planned">Запланировано</option>
              <option value="happened">Состоялась</option>
              <option value="not_happened">Не состоялась</option>
              <option value="postponed">Перенос</option>
            </select>
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input type="date" value={pendingDate} onChange={e => setPendingDate(e.target.value)}
                className="text-sm outline-none text-gray-600 w-32" />
              {pendingDate && (
                <button onClick={() => setPendingDate('')} className="text-gray-400 hover:text-gray-600 ml-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {/* ✅ Fix #7/#11: Apply + Reset */}
            <button onClick={applyFilters}
              className="flex items-center gap-1.5 py-2 px-4 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap">
              <Check className="w-3.5 h-3.5" /> Применить
            </button>
            <button onClick={resetFilters}
              className="flex items-center gap-1 py-2 px-3 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium">
              <X className="w-3.5 h-3.5" /> Сбросить
            </button>
          </div>
          {filtersActive && (
            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400">Фильтры:</span>
              {search && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">«{search}»</span>}
              {channelId && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Канал</span>}
              {ktsStatus && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{ktsStatus}</span>}
              {subStatusFilter && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{subStatusFilter}</span>}
              {consultationFilter && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{consultationFilter}</span>}
              {dateFilter && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Дата: {fmtDate(dateFilter)}</span>}
            </div>
          )}
        </div>

        {/* ── Reminders strip (full width, shown only when items exist) ── */}
        {reminders && totalReminderCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {reminders.needStatusUpdate > 0 && (
              <button onClick={() => applyQuickFilter({ subStatus: 'scheduled', consultationStatus: '' })}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl hover:border-red-400 transition-colors text-left">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-xs font-medium text-gray-800">Обновить статус встреч</span>
                <span className="text-xs font-bold text-red-600 bg-red-100 rounded-full px-2 py-0.5">{reminders.needStatusUpdate}</span>
              </button>
            )}
            {reminders.thinkingTooLong > 0 && (
              <button onClick={() => applyQuickFilter({ subStatus: 'thinking', consultationStatus: '' })}
                className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl hover:border-orange-400 transition-colors text-left">
                <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="text-xs font-medium text-gray-800">«Думает» более 2 дней</span>
                <span className="text-xs font-bold text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">{reminders.thinkingTooLong}</span>
              </button>
            )}
            {reminders.postponedNoDate > 0 && (
              <button onClick={() => applyQuickFilter({ subStatus: '', consultationStatus: 'postponed' })}
                className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl hover:border-yellow-400 transition-colors text-left">
                <Calendar className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                <span className="text-xs font-medium text-gray-800">Перенос без новой даты</span>
                <span className="text-xs font-bold text-yellow-700 bg-yellow-100 rounded-full px-2 py-0.5">{reminders.postponedNoDate}</span>
              </button>
            )}
          </div>
        )}

        {/* ── Today's appointments (always visible, collapsible) ── */}
        <div className="bg-white rounded-2xl border border-blue-100 mb-4 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50/40 transition-colors"
            onClick={() => setShowAllToday(v => !v)}>
            <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Clock className="w-4 h-4 text-blue-500" />
              Записаны на сегодня
              {todayLeads.length > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold rounded-full px-2 py-0.5 ml-1">{todayLeads.length}</span>
              )}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAllToday ? 'rotate-180' : ''}`} />
          </button>
          {showAllToday && (
            todayLeads.length === 0 ? (
              <div className="px-4 pb-4 text-center py-6 text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Нет записей на сегодня</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 px-4 pb-4">
                {todayLeads.map(lead => {
                  const usePostponed = lead.postponedDate === today
                  const time = usePostponed ? lead.postponedTime : lead.appointmentTime
                  const hasStatus = !!lead.consultationStatus
                  return (
                    <div key={lead.id}
                      className={`p-3 rounded-xl border ${hasStatus ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-blue-50 border-blue-100'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900">
                            {time ? <span className="text-blue-700 mr-1">{time}</span> : ''}
                            {lead.assignedTo?.name || 'Без клоузера'}
                          </p>
                          <p className="text-xs text-gray-600 truncate mt-0.5">{lead.clientName}</p>
                        </div>
                        {hasStatus
                          ? <ConsultationBadge value={lead.consultationStatus} />
                          : <button onClick={() => setStatusLead(lead)} className="text-xs text-blue-600 hover:text-blue-800 font-semibold whitespace-nowrap">Отметить</button>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

        {/* ── Overdue meetings ── */}
        {overdueLeads.length > 0 && (
          <div className="mx-4 mb-2 bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-50/50 transition-colors"
              onClick={() => setShowOverdue(v => !v)}>
              <span className="flex items-center gap-2 text-sm font-bold text-red-700">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Просроченные встречи
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 ml-1">{overdueLeads.length}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-red-400 transition-transform ${showOverdue ? 'rotate-180' : ''}`} />
            </button>
            {showOverdue && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 px-4 pb-4">
                {overdueLeads.map(lead => (
                  <div key={lead.id} className="p-3 rounded-xl border border-red-100 bg-red-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-red-800">
                          📅 {fmtDate(lead.appointmentDate!)}
                        </p>
                        <p className="text-xs text-gray-700 font-semibold truncate mt-0.5">{lead.clientName}</p>
                        <p className="text-xs text-gray-500 truncate">{lead.assignedTo?.name || 'Без клоузера'}</p>
                      </div>
                      <button
                        onClick={() => setStatusLead(lead)}
                        className="text-xs text-red-600 hover:text-red-800 font-semibold whitespace-nowrap shrink-0"
                      >
                        Отметить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Full-width table area ── */}
        <div className="space-y-3">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Загрузка...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[860px]">
                    <thead className="bg-gray-50/80 border-b border-gray-100">
                      <tr>
                        {[
                          { label: 'Дата поступления', field: 'createdAt', sort: true },
                          { label: 'Ссылка / Клиент', field: null, sort: false },
                          { label: 'Канал', field: 'channel', sort: true },
                          { label: 'Квал / Не квал', field: null, sort: false },
                          { label: 'Записан / Отказ', field: 'subStatus', sort: true },
                          { label: 'Дата записи', field: null, sort: false },
                          { label: 'Клоузер', field: null, sort: false },
                          { label: 'Статус встречи', field: 'consultationStatus', sort: true },
                          { label: 'Перенос на', field: null, sort: false },
                        ].map(col => (
                          <th key={col.label}
                            onClick={col.sort && col.field ? () => handleSort(col.field!) : undefined}
                            className={`px-3 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap ${col.sort ? 'cursor-pointer hover:text-gray-800 select-none' : ''}`}>
                            {col.label}{col.sort && col.field && <SortIcon field={col.field} />}
                          </th>
                        ))}
                        {/* + Add lead button in header */}
                        <th className="px-2 py-2 w-28">
                          <button
                            onClick={() => setShowInlineAdd(a => !a)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${showInlineAdd ? 'bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                            <Plus className="w-3.5 h-3.5" />
                            Добавить
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Inline add row — full set of fields */}
                      {showInlineAdd && (
                        <tr className="border-b-2 border-blue-200 bg-blue-50/70">
                          {/* Date */}
                          <td className="px-2 py-3">
                            <input type="date" value={inlineDate} onChange={e => setInlineDate(e.target.value)}
                              className="w-32 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                          </td>
                          {/* Link + Name */}
                          <td className="px-2 py-3 min-w-[140px]">
                            <div className="space-y-1.5">
                              <input value={inlineLeadLink} onChange={e => setInlineLeadLink(e.target.value)}
                                placeholder="Ссылка на лид..."
                                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                              <input value={inlineName} onChange={e => setInlineName(e.target.value)}
                                placeholder="Имя клиента *"
                                autoFocus
                                className="w-full text-xs border border-blue-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white font-medium" />
                            </div>
                          </td>
                          {/* Channel */}
                          <td className="px-2 py-3">
                            <select value={inlineChannelId} onChange={e => setInlineChannelId(e.target.value)}
                              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-28">
                              <option value="">— канал —</option>
                              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </td>
                          {/* KTS mode 3-way toggle on inline add */}
                          <td className="px-2 py-3">
                            <div className="flex flex-col gap-1">
                              {(['qual', 'unqual', 'inwork'] as const).map(mode => (
                                <button key={mode} type="button"
                                  onClick={() => setInlineKtsMode(mode)}
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
                                    inlineKtsMode === mode
                                      ? mode === 'qual' ? 'bg-green-600 text-white'
                                        : mode === 'unqual' ? 'bg-red-600 text-white'
                                        : 'bg-blue-600 text-white'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}>
                                  {mode === 'qual' ? 'Квал' : mode === 'unqual' ? 'Не квал' : 'В работе КЦ'}
                                </button>
                              ))}
                            </div>
                          </td>
                          {/* Sub-status (Записан/Отказ/Думает) */}
                          <td className="px-2 py-3">
                            <select value={inlineSubStatus} onChange={e => setInlineSubStatus(e.target.value)}
                              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-28">
                              <option value="">— статус —</option>
                              <option value="scheduled">Записан</option>
                              <option value="refused">Отказ</option>
                              <option value="thinking">Думает</option>
                            </select>
                          </td>
                          {/* Appointment date + time */}
                          <td className="px-2 py-3">
                            <div className="space-y-1">
                              <input type="date" value={inlineAppointmentDate} onChange={e => setInlineAppointmentDate(e.target.value)}
                                className="w-32 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                              <input type="time" value={inlineAppointmentTime} onChange={e => setInlineAppointmentTime(e.target.value)}
                                className="w-24 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            </div>
                          </td>
                          {/* Closer */}
                          <td className="px-2 py-3">
                            <select value={inlineCloserId} onChange={e => setInlineCloserId(e.target.value)}
                              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-28">
                              <option value="">— клоузер —</option>
                              {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </td>
                          {/* Consultation status — selectable when subStatus is scheduled */}
                          <td className="px-2 py-3">
                            {inlineSubStatus === 'scheduled' ? (
                              <select value={inlineConsultationStatus} onChange={e => setInlineConsultationStatus(e.target.value)}
                                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-32">
                                <option value="">— статус —</option>
                                <option value="planned">Запланировано</option>
                                <option value="happened">Состоялась</option>
                                <option value="not_happened">Не состоялась</option>
                                <option value="postponed">Перенос</option>
                              </select>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          {/* Postpone — empty */}
                          <td className="px-2 py-3">
                            <span className="text-xs text-gray-300">—</span>
                          </td>
                          {/* Actions */}
                          <td className="px-2 py-3">
                            <div className="flex flex-col gap-1.5">
                              <button onClick={saveInlineLead}
                                disabled={!inlineName.trim() || createMutation.isPending}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors whitespace-nowrap">
                                <Check className="w-3 h-3" /> Сохранить
                              </button>
                              <button onClick={resetInlineForm}
                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap">
                                <X className="w-3 h-3" /> Отмена
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {sortedLeads.length === 0 && !showInlineAdd && (
                        <tr>
                          <td colSpan={10} className="py-14 text-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-2">📋</div>
                            <p className="font-semibold text-gray-600">Лидов не найдено</p>
                            <p className="text-sm text-gray-400 mt-1">
                              {filtersActive ? 'Попробуйте сбросить фильтры' : 'Нажмите «+» в заголовке таблицы чтобы добавить'}
                            </p>
                          </td>
                        </tr>
                      )}

                      {pageLeads.map((lead, idx) => (
                        <tr key={lead.id}
                          onClick={() => setEditLead(lead)}
                          className={`border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                          <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap font-medium">
                            {fmtDate(lead.date)}
                          </td>
                          <td className="px-3 py-3 max-w-[180px]">
                            {lead.leadLink ? (
                              <a href={lead.leadLink} target="_blank" rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline mb-0.5">
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[140px] block">{lead.leadLink.replace(/^https?:\/\//, '')}</span>
                              </a>
                            ) : null}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-gray-800">{lead.clientName}</span>
                              {lead.phone && (
                                <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                                  className="text-gray-400 hover:text-blue-600 transition-colors" title={lead.phone}>
                                  <Phone className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {lead.salesChannel?.name ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <KtsBadge lead={lead} />
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <SubStatusBadge value={lead.subStatus} />
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {fmtDateTime(lead.appointmentDate, lead.appointmentTime)}
                          </td>
                          <td className="px-3 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">
                            {lead.assignedTo?.name ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <ConsultationBadge value={lead.consultationStatus} />
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {lead.consultationStatus === 'postponed'
                              ? <span className="font-medium text-orange-700">{fmtDateTime(lead.postponedDate, lead.postponedTime)}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setEditLead(lead)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Редактировать">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <RowMenu
                                lead={lead}
                                onEdit={() => setEditLead(lead)}
                                onStatus={() => setStatusLead(lead)}
                                onDelete={() => handleDelete(lead)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ✅ Fix #10: Pagination with per-page selector */}
            <div className="flex items-center gap-2 px-1 flex-wrap">
              <p className="text-xs text-gray-500 shrink-0">
                {sortedLeads.length > 0
                  ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, sortedLeads.length)} из ${sortedLeads.length}`
                  : '0 лидов'}
              </p>
              <div className="flex items-center gap-1 flex-1 justify-center">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let num: number
                  if (totalPages <= 7) num = i + 1
                  else if (page <= 4) num = i + 1
                  else if (page >= totalPages - 3) num = totalPages - 6 + i
                  else num = page - 3 + i
                  return (
                    <button key={num} onClick={() => setPage(num)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${page === num ? 'bg-blue-600 text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {num}
                    </button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-gray-400">На стр.:</span>
                {[15, 30, 50, 100].map(n => (
                  <button key={n} onClick={() => { setPageSize(n); resetPage() }}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${pageSize === n ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 border border-gray-200'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Funnel */}
            {funnel && funnel.total > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Воронка лидов</h3>
                <div className="flex items-stretch gap-1.5">
                  {[
                    { label: 'Всего',       value: funnel.total,     pct: null,                                                    bg: 'bg-slate-100 text-slate-800 border-slate-200' },
                    { label: 'Квалиф.',     value: funnel.qualified, pct: pct(funnel.qualified, funnel.total),                     bg: 'bg-green-100 text-green-800 border-green-200' },
                    { label: 'Записаны',    value: funnel.scheduled, pct: pct(funnel.scheduled, funnel.qualified || funnel.total), bg: 'bg-blue-100 text-blue-800 border-blue-200' },
                    { label: 'Состоялись', value: funnel.happened,  pct: pct(funnel.happened, funnel.scheduled || 1),             bg: 'bg-purple-100 text-purple-800 border-purple-200' },
                    { label: 'Оплаты',     value: funnel.sold,      pct: pct(funnel.sold, funnel.happened || 1),                  bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                  ].map((step, i, arr) => (
                    <div key={step.label} className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className={`flex-1 border-2 rounded-2xl p-3 text-center ${step.bg}`}>
                        <p className="text-2xl font-bold leading-none">{step.value}</p>
                        <p className="text-xs font-semibold mt-1 leading-tight opacity-80">{step.label}</p>
                        {step.pct !== null && (
                          <p className={`text-sm font-bold mt-1 ${step.pct === 0 ? 'opacity-40' : ''}`}>{step.pct}%</p>
                        )}
                      </div>
                      {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Modals */}
      {editLead && <EditLeadModal lead={editLead} onClose={() => setEditLead(null)} channels={channels} closers={closers} />}
      {statusLead && <QuickStatusModal lead={statusLead} onClose={() => setStatusLead(null)} />}
    </div>
  )
}
