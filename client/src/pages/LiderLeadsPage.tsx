import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import {
  Plus, Search, X, ExternalLink, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, MoreVertical, Bell, Clock,
  AlertCircle, Download, RefreshCw, Calendar,
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

function KtsBadge({ lead }: { lead: Lead }) {
  if (!lead.isQualified || lead.status === 'UNQUALIFIED')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Не квал</span>
  if (lead.assignedToId)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">В работе КЦ</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Квал</span>
}

function SubStatusBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-gray-400 text-xs">—</span>
  const map: Record<string, { label: string; cls: string }> = {
    scheduled: { label: 'Записан',  cls: 'bg-green-100 text-green-700' },
    refused:   { label: 'Отказ',    cls: 'bg-red-100 text-red-700' },
    thinking:  { label: 'Думает',   cls: 'bg-orange-100 text-orange-700' },
  }
  const s = map[value]
  if (!s) return <span className="text-gray-400 text-xs">{value}</span>
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
}

function ConsultationBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-gray-400 text-xs">—</span>
  const map: Record<string, { label: string; cls: string }> = {
    happened:     { label: 'Состоялась',    cls: 'bg-green-100 text-green-700' },
    not_happened: { label: 'Не состоялась', cls: 'bg-red-100 text-red-700' },
    postponed:    { label: 'Перенос',       cls: 'bg-orange-100 text-orange-700' },
  }
  const s = map[value]
  if (!s) return <span className="text-gray-400 text-xs">{value}</span>
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [leadLink, setLeadLink] = useState('')
  const [salesChannelId, setSalesChannelId] = useState('')
  const [ktsMode, setKtsMode] = useState<'qual' | 'unqual' | 'inwork'>('qual')
  const [subStatus, setSubStatus] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [comment, setComment] = useState('')

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/leads', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lider-report'] }); onClose() },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim() || !phone.trim()) return
    const isQualified = ktsMode !== 'unqual'
    const chosenAssignee = (ktsMode === 'inwork' || (ktsMode !== 'unqual' && subStatus === 'scheduled'))
      ? assignedToId || undefined : undefined
    mutation.mutate({
      clientName: clientName.trim(), phone: phone.trim(), date,
      leadLink: leadLink || undefined,
      salesChannelId: salesChannelId || undefined,
      isQualified,
      assignedToId: chosenAssignee,
      subStatus: (ktsMode !== 'unqual' && subStatus) ? subStatus : undefined,
      appointmentDate: subStatus === 'scheduled' ? appointmentDate || undefined : undefined,
      appointmentTime: subStatus === 'scheduled' ? appointmentTime || undefined : undefined,
      comment: comment || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Добавить лид</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Имя клиента *</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Иван Иванов" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Телефон *</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+7 999 000 00 00" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Дата поступления</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Рекламный канал</label>
              <select value={salesChannelId} onChange={e => setSalesChannelId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— не выбран —</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ссылка на лид</label>
            <input value={leadLink} onChange={e => setLeadLink(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Статус квалификации</label>
            <div className="flex gap-2">
              {(['qual', 'unqual', 'inwork'] as const).map(mode => {
                const labels = { qual: 'Квал', unqual: 'Не квал', inwork: 'В работе КЦ' }
                const active = { qual: 'bg-green-600 text-white', unqual: 'bg-red-500 text-white', inwork: 'bg-blue-600 text-white' }
                return (
                  <button key={mode} type="button" onClick={() => setKtsMode(mode)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${ktsMode === mode ? active[mode] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {labels[mode]}
                  </button>
                )
              })}
            </div>
          </div>
          {ktsMode !== 'unqual' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Записан / Отказ / Думает</label>
              <div className="flex gap-2">
                {[['scheduled', 'Записан', 'bg-green-600 text-white'], ['refused', 'Отказ', 'bg-red-500 text-white'], ['thinking', 'Думает', 'bg-orange-500 text-white']].map(([val, label, cls]) => (
                  <button key={val} type="button" onClick={() => setSubStatus(subStatus === val ? '' : val)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${subStatus === val ? cls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {ktsMode !== 'unqual' && subStatus === 'scheduled' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-green-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Дата консультации</label>
                <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Время</label>
                <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
          {(ktsMode === 'inwork' || (ktsMode !== 'unqual' && subStatus === 'scheduled')) && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Клоузер</label>
              <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— не назначен —</option>
                {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Необязательно" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Отмена
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
          {mutation.isError && <p className="text-xs text-red-600">Ошибка при сохранении</p>}
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lider-report'] }); qc.invalidateQueries({ queryKey: ['today-appointments'] }); onClose() },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const isQualified = ktsMode !== 'unqual'
    const chosenAssignee = (ktsMode === 'inwork' || (ktsMode !== 'unqual' && subStatus === 'scheduled'))
      ? assignedToId || null : null
    mutation.mutate({
      clientName: clientName.trim(), phone: phone.trim(), date,
      leadLink: leadLink || null,
      salesChannelId: salesChannelId || null,
      isQualified,
      assignedToId: chosenAssignee,
      subStatus: (ktsMode !== 'unqual' && subStatus) ? subStatus : null,
      appointmentDate: subStatus === 'scheduled' ? appointmentDate || null : null,
      appointmentTime: subStatus === 'scheduled' ? appointmentTime || null : null,
      consultationStatus: consultationStatus || null,
      postponedDate: consultationStatus === 'postponed' ? postponedDate || null : null,
      postponedTime: consultationStatus === 'postponed' ? postponedTime || null : null,
      comment: comment || null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Редактировать лид</h2>
            <p className="text-xs text-gray-500">{lead.clientName} · {lead.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Имя клиента</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Телефон</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Дата</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Рекламный канал</label>
              <select value={salesChannelId} onChange={e => setSalesChannelId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— не выбран —</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ссылка на лид</label>
            <input value={leadLink} onChange={e => setLeadLink(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Статус квалификации</label>
            <div className="flex gap-2">
              {(['qual', 'unqual', 'inwork'] as const).map(mode => {
                const labels = { qual: 'Квал', unqual: 'Не квал', inwork: 'В работе КЦ' }
                const active = { qual: 'bg-green-600 text-white', unqual: 'bg-red-500 text-white', inwork: 'bg-blue-600 text-white' }
                return (
                  <button key={mode} type="button" onClick={() => setKtsMode(mode)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${ktsMode === mode ? active[mode] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {labels[mode]}
                  </button>
                )
              })}
            </div>
          </div>
          {ktsMode !== 'unqual' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Записан / Отказ / Думает</label>
              <div className="flex gap-2">
                {[['scheduled', 'Записан', 'bg-green-600 text-white'], ['refused', 'Отказ', 'bg-red-500 text-white'], ['thinking', 'Думает', 'bg-orange-500 text-white']].map(([val, label, cls]) => (
                  <button key={val} type="button" onClick={() => setSubStatus(subStatus === val ? '' : val)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${subStatus === val ? cls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {ktsMode !== 'unqual' && subStatus === 'scheduled' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-green-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Дата консультации</label>
                <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Время</label>
                <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
          {(ktsMode === 'inwork' || (ktsMode !== 'unqual' && subStatus === 'scheduled')) && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Клоузер</label>
              <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— не назначен —</option>
                {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {(lead.subStatus === 'scheduled' || subStatus === 'scheduled') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Статус встречи</label>
              <div className="flex gap-2">
                {[['happened', 'Состоялась', 'bg-green-600 text-white'], ['not_happened', 'Не состоялась', 'bg-red-500 text-white'], ['postponed', 'Перенос', 'bg-orange-500 text-white']].map(([val, label, cls]) => (
                  <button key={val} type="button" onClick={() => setConsultationStatus(consultationStatus === val ? '' : val)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${consultationStatus === val ? cls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {consultationStatus === 'postponed' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Новая дата</label>
                <input type="date" value={postponedDate} onChange={e => setPostponedDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Новое время</label>
                <input type="time" value={postponedTime} onChange={e => setPostponedTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Отмена
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
          {mutation.isError && <p className="text-xs text-red-600">Ошибка при сохранении</p>}
        </form>
      </div>
    </div>
  )
}

// ── QuickStatusModal ──────────────────────────────────────────────────────────
function QuickStatusModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient()
  const [consultationStatus, setConsultationStatus] = useState('')
  const [postponedDate, setPostponedDate] = useState('')
  const [postponedTime, setPostponedTime] = useState('')

  const mutation = useMutation({
    mutationFn: (data: any) => api.put(`/leads/${lead.id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lider-report'] })
      qc.invalidateQueries({ queryKey: ['today-appointments'] })
      onClose()
    },
  })

  const handleSave = () => {
    if (!consultationStatus) return
    mutation.mutate({
      consultationStatus,
      postponedDate: consultationStatus === 'postponed' ? postponedDate || null : null,
      postponedTime: consultationStatus === 'postponed' ? postponedTime || null : null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Статус встречи</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{lead.clientName} · {fmtDateTime(lead.appointmentDate, lead.appointmentTime)}</p>
        <div className="space-y-2 mb-4">
          {[
            ['happened',     'Состоялась',    'border-green-500 bg-green-50 text-green-700'],
            ['not_happened', 'Не состоялась', 'border-red-500 bg-red-50 text-red-700'],
            ['postponed',    'Перенос',       'border-orange-500 bg-orange-50 text-orange-700'],
          ].map(([val, label, cls]) => (
            <button key={val} onClick={() => setConsultationStatus(val)}
              className={`w-full py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${consultationStatus === val ? cls : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        {consultationStatus === 'postponed' && (
          <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-orange-50 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Новая дата</label>
              <input type="date" value={postponedDate} onChange={e => setPostponedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Время</label>
              <input type="time" value={postponedTime} onChange={e => setPostponedTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Отмена</button>
          <button onClick={handleSave} disabled={!consultationStatus || mutation.isPending}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {mutation.isPending ? '...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row Action Menu ───────────────────────────────────────────────────────────
function RowMenu({ lead, onEdit, onStatus, onDelete }: {
  lead: Lead
  onEdit: () => void
  onStatus: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(p => !p)}
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10 w-44">
          <button onClick={() => { setOpen(false); onEdit() }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Редактировать</button>
          {lead.subStatus === 'scheduled' && (
            <button onClick={() => { setOpen(false); onStatus() }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Статус встречи</button>
          )}
          <button onClick={() => { setOpen(false); onDelete() }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">Удалить</button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LiderLeadsPage() {
  const qc = useQueryClient()

  // Period
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month'>('month')

  // Filters
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
  const PAGE_SIZE = 10

  // Modals
  const [showAdd, setShowAdd] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [statusLead, setStatusLead] = useState<Lead | null>(null)
  const [showAllToday, setShowAllToday] = useState(false)

  const resetPage = () => setPage(1)

  // Build query params
  const params = new URLSearchParams({ period })
  if (search) params.set('search', search)
  if (channelId) params.set('channelId', channelId)
  if (ktsStatus) params.set('ktsStatus', ktsStatus)
  if (subStatusFilter) params.set('subStatus', subStatusFilter)
  if (consultationFilter) params.set('consultationStatus', consultationFilter)
  if (dateFilter) params.set('date', dateFilter)

  const { data, isLoading, refetch } = useQuery<ReportData>({
    queryKey: ['lider-report', period, search, channelId, ktsStatus, subStatusFilter, consultationFilter, dateFilter],
    queryFn: () => api.get(`/leads/lider-report?${params}`).then(r => r.data),
  })

  const { data: channels = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['sales-channels'],
    queryFn: () => api.get('/sales-channels').then(r => r.data),
  })

  const { data: allUsers = [] } = useQuery<{ id: string; name: string; managerType: string }[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then(r => r.data),
  })
  const closers = (allUsers as any[]).filter((u: any) => u.managerType === 'CLOSER')

  const { data: todayLeads = [] } = useQuery<Lead[]>({
    queryKey: ['today-appointments'],
    queryFn: () => api.get('/leads/today-appointments').then(r => r.data),
    refetchInterval: 60000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lider-report'] }),
  })

  const handleDelete = (lead: Lead) => {
    if (confirm(`Удалить лид "${lead.clientName}"?`)) deleteMutation.mutate(lead.id)
  }

  // Sort
  const sortedLeads = useMemo(() => {
    const arr = [...(data?.leads || [])]
    arr.sort((a, b) => {
      let va: any, vb: any
      if (sortField === 'createdAt') { va = a.createdAt; vb = b.createdAt }
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

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE))
  const pageLeads = sortedLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = data?.stats
  const reminders = data?.reminders
  const funnel = stats?.funnel

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    resetPage()
  }

  const SortIcon = ({ field }: { field: string }) => (
    <span className="inline-flex flex-col ml-1 align-middle">
      <ChevronUp className={`w-3 h-3 -mb-1 ${sortField === field && sortDir === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} />
      <ChevronDown className={`w-3 h-3 ${sortField === field && sortDir === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} />
    </span>
  )

  const exportCSV = () => {
    const headers = ['Дата поступления', 'Клиент', 'Телефон', 'Ссылка', 'Рекламный канал', 'Квал/статус', 'Записан/Отказ/Думает', 'Дата консультации', 'Время', 'Клоузер', 'Статус встречи', 'Перенос на']
    const rows = sortedLeads.map(l => [
      fmtCreatedAt(l.createdAt),
      l.clientName, l.phone,
      l.leadLink || '',
      l.salesChannel?.name || '',
      !l.isQualified ? 'Не квал' : l.assignedToId ? 'В работе КЦ' : 'Квал',
      l.subStatus || '',
      l.appointmentDate ? fmtDate(l.appointmentDate) : '',
      l.appointmentTime || '',
      l.assignedTo?.name || '',
      l.consultationStatus || '',
      l.postponedDate ? fmtDateTime(l.postponedDate, l.postponedTime) : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `lider-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const filtersActive = !!(search || channelId || ktsStatus || subStatusFilter || consultationFilter || dateFilter)
  const resetFilters = () => {
    setSearch(''); setChannelId(''); setKtsStatus('')
    setSubStatusFilter(''); setConsultationFilter(''); setDateFilter('')
    resetPage()
  }

  const visibleTodayLeads = showAllToday ? todayLeads : todayLeads.slice(0, 5)

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <h1 className="text-xl font-bold text-gray-900">Отчёт лидоруба</h1>
          <div className="flex bg-white border border-gray-200 rounded-lg p-0.5 gap-0.5">
            {(['today', 'yesterday', 'week', 'month'] as const).map(p => {
              const labels = { today: 'Сегодня', yesterday: 'Вчера', week: 'Неделя', month: 'Месяц' }
              return (
                <button key={p} onClick={() => { setPeriod(p); resetPage() }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${period === p ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {labels[p]}
                </button>
              )
            })}
          </div>
          <div className="flex-1" />
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" /> Экспорт CSV
          </button>
          <button onClick={() => refetch()}
            className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Добавить лид
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {[
            { label: 'Всего лидов', value: stats?.totalLeads, sub: 'За период', color: 'text-gray-900' },
            { label: 'Записаны сегодня', value: stats?.totalScheduledToday, sub: null, color: 'text-blue-600' },
            { label: 'Состоялись', value: stats?.totalHappened, sub: stats?.totalScheduled ? `${Math.round((stats.totalHappened / stats.totalScheduled) * 100)}% от записанных` : '', color: 'text-green-600' },
            { label: 'Отменились', value: stats?.totalCancelled, sub: stats?.totalScheduled ? `${Math.round((stats.totalCancelled / stats.totalScheduled) * 100)}%` : '', color: 'text-red-500' },
            { label: 'Перенесены', value: stats?.totalPostponed, sub: stats?.totalScheduled ? `${Math.round((stats.totalPostponed / stats.totalScheduled) * 100)}%` : '', color: 'text-orange-500' },
            { label: 'Конверсия в запись', value: `${stats?.conversionToScheduled ?? '—'}%`, sub: stats ? `${stats.totalScheduled} из ${stats.totalLeads}` : '', color: 'text-purple-600' },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1 leading-tight">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value ?? '—'}</p>
              {i === 1 && (stats?.totalScheduledToday ?? 0) > 0 && (
                <button onClick={() => setShowAllToday(true)} className="text-xs text-blue-500 hover:underline mt-1 block">
                  Смотреть список
                </button>
              )}
              {card.sub && <p className="text-xs text-gray-400 mt-1">{card.sub}</p>}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); resetPage() }}
                placeholder="Поиск по имени, телефону, ссылке..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={channelId} onChange={e => { setChannelId(e.target.value); resetPage() }}
              className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Все каналы</option>
              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={ktsStatus} onChange={e => { setKtsStatus(e.target.value); resetPage() }}
              className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Квал/Не квал</option>
              <option value="qualified">Квал</option>
              <option value="unqualified">Не квал</option>
              <option value="in_work">В работе КЦ</option>
            </select>
            <select value={subStatusFilter} onChange={e => { setSubStatusFilter(e.target.value); resetPage() }}
              className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Статус записи</option>
              <option value="scheduled">Записан</option>
              <option value="refused">Отказ</option>
              <option value="thinking">Думает</option>
            </select>
            <select value={consultationFilter} onChange={e => { setConsultationFilter(e.target.value); resetPage() }}
              className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Статус встречи</option>
              <option value="happened">Состоялась</option>
              <option value="not_happened">Не состоялась</option>
              <option value="postponed">Перенос</option>
            </select>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); resetPage() }}
                className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {filtersActive && (
              <button onClick={resetFilters}
                className="flex items-center gap-1 py-2 px-3 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                <X className="w-3.5 h-3.5" /> Сбросить
              </button>
            )}
          </div>
        </div>

        {/* Main: table + sidebar */}
        <div className="flex gap-4 items-start">

          {/* Table */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Загрузка...
                </div>
              ) : sortedLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <p className="font-medium">Лидов не найдено</p>
                  <p className="text-sm mt-1">{filtersActive ? 'Попробуйте сбросить фильтры' : 'Добавьте первый лид'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {[
                          { label: 'Дата поступления', field: 'createdAt', sortable: true },
                          { label: 'Ссылка / Клиент', field: 'leadLink', sortable: false },
                          { label: 'Канал', field: 'channel', sortable: true },
                          { label: 'Квал/Не квал', field: null, sortable: false },
                          { label: 'Записан/Отказ', field: 'subStatus', sortable: true },
                          { label: 'Дата записи', field: null, sortable: false },
                          { label: 'Клоузер', field: null, sortable: false },
                          { label: 'Статус встречи', field: 'consultationStatus', sortable: true },
                          { label: 'Перенос на', field: null, sortable: false },
                        ].map(col => (
                          <th key={col.label}
                            onClick={col.sortable && col.field ? () => handleSort(col.field!) : undefined}
                            className={`px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-gray-900' : ''}`}>
                            {col.label}{col.sortable && col.field && <SortIcon field={col.field} />}
                          </th>
                        ))}
                        <th className="px-3 py-3 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pageLeads.map(lead => (
                        <tr key={lead.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {fmtCreatedAt(lead.createdAt)}
                          </td>
                          <td className="px-3 py-3 max-w-[160px]">
                            {lead.leadLink ? (
                              <a href={lead.leadLink} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate block max-w-[120px]">{lead.leadLink.replace(/^https?:\/\//, '')}</span>
                              </a>
                            ) : null}
                            <span className="text-xs text-gray-700 font-medium">{lead.clientName}</span>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {lead.salesChannel?.name ?? <span className="text-gray-400">—</span>}
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
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {lead.assignedTo?.name ?? <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <ConsultationBadge value={lead.consultationStatus} />
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {lead.consultationStatus === 'postponed'
                              ? fmtDateTime(lead.postponedDate, lead.postponedTime)
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            <RowMenu
                              lead={lead}
                              onEdit={() => setEditLead(lead)}
                              onStatus={() => setStatusLead(lead)}
                              onDelete={() => handleDelete(lead)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {sortedLeads.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-gray-500">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedLeads.length)} из {sortedLeads.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
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
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === num ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {num}
                      </button>
                    )
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500">{PAGE_SIZE} на странице</p>
              </div>
            )}

            {/* Funnel */}
            {funnel && funnel.total > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Воронка лидов</h3>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Всего', value: funnel.total, pct: null, bg: 'bg-slate-100 border-slate-200 text-slate-800' },
                    { label: 'Квалиф.', value: funnel.qualified, pct: funnel.total > 0 ? Math.round(funnel.qualified / funnel.total * 100) : 0, bg: 'bg-green-100 border-green-200 text-green-800' },
                    { label: 'Записаны', value: funnel.scheduled, pct: funnel.total > 0 ? Math.round(funnel.scheduled / funnel.total * 100) : 0, bg: 'bg-blue-100 border-blue-200 text-blue-800' },
                    { label: 'Состоялись', value: funnel.happened, pct: funnel.scheduled > 0 ? Math.round(funnel.happened / funnel.scheduled * 100) : 0, bg: 'bg-purple-100 border-purple-200 text-purple-800' },
                    { label: 'Оплаты', value: funnel.sold, pct: funnel.happened > 0 ? Math.round(funnel.sold / funnel.happened * 100) : 0, bg: 'bg-emerald-100 border-emerald-200 text-emerald-800' },
                  ].map((step, i, arr) => (
                    <div key={step.label} className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className={`flex-1 border rounded-xl p-3 text-center ${step.bg}`}>
                        <p className="text-xl font-bold leading-none">{step.value}</p>
                        <p className="text-xs font-medium mt-1 leading-tight">{step.label}</p>
                        {step.pct !== null && <p className="text-xs opacity-60 mt-0.5">{step.pct}%</p>}
                      </div>
                      {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-72 shrink-0 space-y-4">

            {/* Today appointments */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Записаны сегодня
                  {todayLeads.length > 0 && (
                    <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none">
                      {todayLeads.length}
                    </span>
                  )}
                </h3>
              </div>
              {todayLeads.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">На сегодня записей нет</p>
              ) : (
                <div className="space-y-2">
                  {visibleTodayLeads.map(lead => {
                    const time = lead.postponedDate === new Date().toISOString().slice(0, 10)
                      ? lead.postponedTime
                      : lead.appointmentTime
                    return (
                      <div key={lead.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border ${lead.consultationStatus ? 'bg-gray-50 border-gray-100' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900">
                            {time || '—'} · {lead.assignedTo?.name || 'Без клоузера'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{lead.clientName}</p>
                        </div>
                        <div className="ml-2 shrink-0">
                          {lead.consultationStatus ? (
                            <ConsultationBadge value={lead.consultationStatus} />
                          ) : (
                            <button onClick={() => setStatusLead(lead)}
                              className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                              Отметить
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {todayLeads.length > 5 && !showAllToday && (
                    <button onClick={() => setShowAllToday(true)}
                      className="w-full text-xs text-blue-600 hover:underline py-1">
                      Показать все ({todayLeads.length})
                    </button>
                  )}
                  {showAllToday && todayLeads.length > 5 && (
                    <button onClick={() => setShowAllToday(false)}
                      className="w-full text-xs text-gray-500 hover:underline py-1">
                      Свернуть
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Reminders */}
            {reminders && (reminders.needStatusUpdate > 0 || reminders.thinkingTooLong > 0 || reminders.postponedNoDate > 0) && (
              <div className="bg-white rounded-xl border border-orange-100 p-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-3">
                  <Bell className="w-4 h-4 text-orange-500" />
                  Напоминания
                </h3>
                <div className="space-y-2">
                  {reminders.needStatusUpdate > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-red-50 border border-red-100 rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span className="text-xs text-gray-700">Обновить статус встреч</span>
                      </div>
                      <span className="text-xs font-bold text-red-600 bg-red-100 rounded-full px-2 py-0.5 min-w-[22px] text-center">{reminders.needStatusUpdate}</span>
                    </div>
                  )}
                  {reminders.thinkingTooLong > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-orange-50 border border-orange-100 rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span className="text-xs text-gray-700">«Думает» более 2 дней</span>
                      </div>
                      <span className="text-xs font-bold text-orange-600 bg-orange-100 rounded-full px-2 py-0.5 min-w-[22px] text-center">{reminders.thinkingTooLong}</span>
                    </div>
                  )}
                  {reminders.postponedNoDate > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-yellow-50 border border-yellow-100 rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                        <span className="text-xs text-gray-700">Перенос без новой даты</span>
                      </div>
                      <span className="text-xs font-bold text-yellow-700 bg-yellow-100 rounded-full px-2 py-0.5 min-w-[22px] text-center">{reminders.postponedNoDate}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Modals */}
      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} channels={channels} closers={closers} />}
      {editLead && <EditLeadModal lead={editLead} onClose={() => setEditLead(null)} channels={channels} closers={closers} />}
      {statusLead && <QuickStatusModal lead={statusLead} onClose={() => setStatusLead(null)} />}
    </div>
  )
}
