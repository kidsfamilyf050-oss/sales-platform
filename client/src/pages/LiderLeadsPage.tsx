import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import { useT } from '../i18n'
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
  totalRefused: number
  conversionToScheduled: number
  meetingsAttendedPlan: number
  planCompletion: number
  funnel: { total: number; qualified: number; scheduled: number; happened: number; sold: number }
  deptStats?: { total: number; scheduled: number; happened: number } | null
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
  const { t } = useT()
  if (!lead.isQualified || lead.status === 'UNQUALIFIED')
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{t('lider.badge.unqual')}</span>
  if (lead.subStatus === 'in_work_kc')
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{t('lider.badge.inwork')}</span>
  if (lead.status === 'IN_WORK')
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{t('lider.badge.inwork')}</span>
  if (lead.assignedToId && lead.status === 'ASSIGNED')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        {t('lider.badge.qual')} <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
      </span>
    )
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{t('lider.badge.qual')}</span>
}

function SubStatusBadge({ value }: { value?: string | null }) {
  const { t } = useT()
  if (!value) return <span className="text-gray-300 text-xs">—</span>
  const map: Record<string, { labelKey: string; cls: string }> = {
    scheduled:   { labelKey: 'lider.sub.scheduled', cls: 'bg-green-100 text-green-700' },
    refused:     { labelKey: 'lider.sub.refused',   cls: 'bg-red-100 text-red-700' },
    thinking:    { labelKey: 'lider.sub.thinking',  cls: 'bg-orange-100 text-orange-700' },
    in_work_kc:  { labelKey: 'lider.sub.inwork',    cls: 'bg-purple-100 text-purple-700' },
  }
  const s = map[value]
  if (!s) return <span className="text-gray-400 text-xs">{value}</span>
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{t(s.labelKey as any)}</span>
}

function ConsultationBadge({ value }: { value?: string | null }) {
  const { t } = useT()
  if (!value) return <span className="text-gray-300 text-xs">—</span>
  const map: Record<string, { labelKey: string; cls: string }> = {
    happened:     { labelKey: 'lider.consult.happened',    cls: 'bg-green-100 text-green-700' },
    not_happened: { labelKey: 'lider.consult.notHappened', cls: 'bg-red-100 text-red-700' },
    postponed:    { labelKey: 'lider.consult.postponed',   cls: 'bg-orange-100 text-orange-700' },
    planned:      { labelKey: 'lider.consult.planned',     cls: 'bg-cyan-100 text-cyan-700' },
  }
  const s = map[value]
  if (!s) return <span className="text-gray-400 text-xs">{value}</span>
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{t(s.labelKey as any)}</span>
}

// ── FilterDropdown — custom translated dropdown replacing native <select> ──────
function FilterDropdown({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 160) })
    }
    setOpen(p => !p)
  }

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (
        listRef.current && !listRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onOut)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onOut)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1.5 py-2 px-3 text-sm border rounded-xl focus:outline-none transition-colors whitespace-nowrap ${
          value
            ? 'border-blue-300 bg-blue-50 text-blue-800'
            : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'
        }`}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${value ? 'text-blue-500' : 'text-gray-400'}`} />
      </button>
      {open && createPortal(
        <div
          ref={listRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-2xl border border-gray-100 py-1 overflow-hidden"
        >
          <button
            onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${!value ? 'font-semibold text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {placeholder}
          </button>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${value === opt.value ? 'font-semibold text-blue-700 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Row Menu (portal — fixes overflow clipping) ───────────────────────────────
function RowMenu({ lead, onEdit, onStatus, onDelete }: {
  lead: Lead
  onEdit: () => void
  onStatus: () => void
  onDelete: () => void
}) {
  const { t } = useT()
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
              📋 {t('lider.col.consultation')}
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
  const { t } = useT()
  const [clientName, setClientName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(localDateStr()) // fix: use local timezone date
  const [leadLink, setLeadLink] = useState('')
  const [salesChannelId, setSalesChannelId] = useState('')
  const [ktsMode, setKtsMode] = useState<'qual' | 'unqual' | 'inwork'>('qual')
  const [subStatus, setSubStatus] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [consultationStatus, setConsultationStatus] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [comment, setComment] = useState('')

  // Fix: when switching to unqual, clear subStatus and appointment fields
  // When switching to inwork, auto-select in_work_kc subStatus
  const handleKtsModeChange = (mode: 'qual' | 'unqual' | 'inwork') => {
    setKtsMode(mode)
    if (mode === 'unqual') {
      setSubStatus('')
      setAppointmentDate('')
      setAppointmentTime('')
    } else if (mode === 'inwork') {
      setSubStatus('in_work_kc')
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

  const [addError, setAddError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim() || !phone.trim()) return
    // п.4: appointment date cannot be before lead arrival date
    if (appointmentDate && date && appointmentDate < date) {
      setAddError(
        `Дата встречи (${fmtDate(appointmentDate)}) не может быть раньше даты поступления лида (${fmtDate(date)}).\n\nИсправьте дату встречи или дату поступления лида.`
      )
      return
    }
    const isQualified = ktsMode !== 'unqual'
    // Send assignedToId for all qualified modes (not just inwork)
    const chosenAssignee = ktsMode === 'unqual' ? undefined : assignedToId || undefined
    mutation.mutate({
      clientName: clientName.trim(), phone: phone.trim(), date,
      leadLink: leadLink || undefined,
      salesChannelId: salesChannelId || undefined,
      isQualified, assignedToId: chosenAssignee,
      subStatus: (ktsMode !== 'unqual' && subStatus) ? subStatus : undefined,
      appointmentDate: subStatus === 'scheduled' ? appointmentDate || undefined : undefined,
      appointmentTime: subStatus === 'scheduled' ? appointmentTime || undefined : undefined,
      consultationStatus: subStatus === 'scheduled' ? consultationStatus || undefined : undefined,
      comment: comment || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{t('lider.btn.addLead')}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.clientNameRequired')}</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Иван Иванов" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.phone')}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+7 999 000 00 00" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.arrivalDate')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.channel')}</label>
              <select value={salesChannelId} onChange={e => setSalesChannelId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">— не выбран —</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.leadLink')}</label>
            <input value={leadLink} onChange={e => setLeadLink(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">{t('lider.col.qual')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['qual', 'unqual', 'inwork'] as const).map(mode => {
                const cfg = {
                  qual:   { labelKey: 'lider.badge.qual',   on: 'bg-green-600 text-white shadow-sm' },
                  unqual: { labelKey: 'lider.badge.unqual', on: 'bg-red-500 text-white shadow-sm' },
                  inwork: { labelKey: 'lider.badge.inwork', on: 'bg-blue-600 text-white shadow-sm' },
                }[mode]
                return (
                  <button key={mode} type="button" onClick={() => handleKtsModeChange(mode)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${ktsMode === mode ? cfg.on : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {t(cfg.labelKey as any)}
                  </button>
                )
              })}
            </div>
          </div>

          {ktsMode !== 'unqual' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">{t('lider.subStatusFilter')}</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['scheduled',  'lider.sub.scheduled', 'bg-green-600 text-white'],
                  ['refused',    'lider.sub.refused',   'bg-red-500 text-white'],
                  ['thinking',   'lider.sub.thinking',  'bg-orange-500 text-white'],
                  ['in_work_kc', 'lider.sub.inwork',    'bg-purple-600 text-white'],
                ] as const).map(([val, labelKey, cls]) => (
                  <button key={val} type="button" onClick={() => handleSubStatusChange(subStatus === val ? '' : val)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${subStatus === val ? cls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {ktsMode !== 'unqual' && subStatus === 'scheduled' && (
            <div className="p-3.5 bg-green-50 border border-green-100 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-green-700">{t('lider.field.consultDatetime')}</p>
              <div className="grid grid-cols-2 gap-3">
                {/* п.4: min=date prevents scheduling before lead arrival; п.5: auto-set planned status */}
                <input type="date" value={appointmentDate}
                  min={date}
                  onChange={e => {
                    setAppointmentDate(e.target.value)
                    if (e.target.value) setConsultationStatus('planned')
                  }}
                  className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)}
                  className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            </div>
          )}

          {/* Closer dropdown — visible for qual and inwork; selecting a closer auto-switches to inwork */}
          {ktsMode !== 'unqual' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.closer')}</label>
              <select
                value={assignedToId}
                onChange={e => setAssignedToId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">— не назначен —</option>
                {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.comment')}</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Необязательно" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              {t('common.cancel')}
            </button>
            {/* п.8: channel required */}
            <button type="submit" disabled={mutation.isPending || !salesChannelId}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
              {mutation.isPending ? t('common.saving') : t('lider.btn.addLead')}
            </button>
          </div>
          {!salesChannelId && <p className="text-xs text-orange-600 text-center">{t('lider.field.noChannel')}</p>}
          {addError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs text-red-700 font-semibold mb-1">⚠ Ошибка</p>
              <p className="text-xs text-red-600 whitespace-pre-line">{addError}</p>
              <button type="button" onClick={() => setAddError(null)} className="mt-2 text-xs text-red-500 underline">{t('lider.field.errorClose')}</button>
            </div>
          )}
          {mutation.isError && <p className="text-xs text-red-600 text-center">{t('lider.field.saveError')}</p>}
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
  const { t } = useT()
  const [clientName, setClientName] = useState(lead.clientName)
  const [phone, setPhone] = useState(lead.phone)
  const [date, setDate] = useState(lead.date)
  const [leadLink, setLeadLink] = useState(lead.leadLink || '')
  const [salesChannelId, setSalesChannelId] = useState(lead.salesChannelId || '')
  const [ktsMode, setKtsMode] = useState<'qual' | 'unqual' | 'inwork'>(
    !lead.isQualified ? 'unqual' : lead.subStatus === 'in_work_kc' ? 'inwork' : 'qual'
  )
  const [subStatus, setSubStatus] = useState(lead.subStatus || '')
  const [appointmentDate, setAppointmentDate] = useState(lead.appointmentDate || '')
  const [appointmentTime, setAppointmentTime] = useState(lead.appointmentTime || '')
  const [assignedToId, setAssignedToId] = useState(lead.assignedToId || '')
  const [consultationStatus, setConsultationStatus] = useState(lead.consultationStatus || '')
  const [postponedDate, setPostponedDate] = useState(lead.postponedDate || '')
  const [postponedTime, setPostponedTime] = useState(lead.postponedTime || '')
  const [comment, setComment] = useState(lead.comment || '')

  const handleEditKtsModeChange = (mode: 'qual' | 'unqual' | 'inwork') => {
    setKtsMode(mode)
    if (mode === 'unqual') {
      setSubStatus('')
      setAppointmentDate('')
      setAppointmentTime('')
    } else if (mode === 'inwork') {
      setSubStatus('in_work_kc')
    }
  }

  const [editError, setEditError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: any) => api.put(`/leads/${lead.id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lider-report'] })
      qc.invalidateQueries({ queryKey: ['today-appointments'] })
      qc.invalidateQueries({ queryKey: ['scheduled-today'] })
      qc.invalidateQueries({ queryKey: ['overdue-appointments'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // п.4: appointment date cannot be before lead arrival date
    if (appointmentDate && date && appointmentDate < date) {
      setEditError(
        `Дата встречи (${fmtDate(appointmentDate)}) не может быть раньше даты поступления лида (${fmtDate(date)}).\n\nИсправьте дату встречи или дату поступления лида.`
      )
      return
    }
    const isQualified = ktsMode !== 'unqual'
    // Send assignedToId for all qualified modes (not just inwork)
    const chosenAssignee = ktsMode === 'unqual' ? null : assignedToId || null
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
            <h2 className="text-lg font-bold text-gray-900">{t('lider.field.editLead')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{lead.clientName} · {lead.phone}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.clientName')}</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.arrivalDate')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.channel')}</label>
              <select value={salesChannelId} onChange={e => setSalesChannelId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">— не выбран —</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.leadLinkShort')}</label>
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
                  <button key={mode} type="button" onClick={() => handleEditKtsModeChange(mode)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${ktsMode === mode ? cfg.on : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {ktsMode !== 'unqual' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Статус: Записан / Отказ / Думает / В работе КЦ</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['scheduled',  'Записан',      'bg-green-600 text-white'],
                  ['refused',    'Отказ',         'bg-red-500 text-white'],
                  ['thinking',   'Думает',        'bg-orange-500 text-white'],
                  ['in_work_kc', 'В работе КЦ',  'bg-purple-600 text-white'],
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
              <p className="text-xs font-semibold text-green-700">{t('lider.field.consultDatetime')}</p>
              <div className="grid grid-cols-2 gap-3">
                {/* п.4: min=date prevents scheduling before lead arrival */}
                <input type="date" value={appointmentDate}
                  min={date}
                  onChange={e => {
                    setAppointmentDate(e.target.value)
                    // п.5: auto-set planned status when appointment date is picked (user can change manually)
                    if (e.target.value) setConsultationStatus('planned')
                  }}
                  className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)}
                  className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            </div>
          )}

          {/* Closer dropdown — visible for qual and inwork; selecting a closer auto-switches to inwork */}
          {ktsMode !== 'unqual' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.closer')}</label>
              <select
                value={assignedToId}
                onChange={e => setAssignedToId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">— не назначен —</option>
                {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* п.3: hide meeting status for Не квал */}
          {hasAppointment && ktsMode !== 'unqual' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">{t('lider.col.consultation')}</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['planned',      'lider.consult.planned',     'bg-cyan-600 text-white'],
                  ['happened',     'lider.consult.happened',    'bg-green-600 text-white'],
                  ['not_happened', 'lider.consult.notHappened', 'bg-red-500 text-white'],
                  ['postponed',    'lider.consult.postponed',   'bg-orange-500 text-white'],
                ] as const).map(([val, labelKey, cls]) => (
                  <button key={val} type="button"
                    onClick={() => {
                      const newVal = consultationStatus === val ? '' : val
                      setConsultationStatus(newVal)
                      // Auto-fill postponedDate with tomorrow when selecting postponed
                      if (newVal === 'postponed' && !postponedDate) setPostponedDate(tomorrowDateStr())
                    }}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${consultationStatus === val ? cls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {t(labelKey)}
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
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('lider.field.comment')}</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              {t('common.cancel')}
            </button>
            {/* п.8: channel required */}
            <button type="submit" disabled={mutation.isPending || !salesChannelId}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
          {!salesChannelId && <p className="text-xs text-orange-600 text-center">{t('lider.field.noChannel')}</p>}
          {editError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs text-red-700 font-semibold mb-1">⚠ Ошибка</p>
              <p className="text-xs text-red-600 whitespace-pre-line">{editError}</p>
              <button type="button" onClick={() => setEditError(null)} className="mt-2 text-xs text-red-500 underline">{t('lider.field.errorClose')}</button>
            </div>
          )}
          {mutation.isError && <p className="text-xs text-red-600 text-center">{t('lider.field.saveError')}</p>}
        </form>
      </div>
    </div>
  )
}

// ── QuickStatusModal ──────────────────────────────────────────────────────────
function QuickStatusModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient()
  const { t } = useT()
  const [status, setStatus] = useState(lead.consultationStatus || '')
  const [pDate, setPDate] = useState(lead.postponedDate || '')
  const [pTime, setPTime] = useState(lead.postponedTime || '')

  const mutation = useMutation({
    mutationFn: (data: any) => api.put(`/leads/${lead.id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lider-report'] })
      qc.invalidateQueries({ queryKey: ['today-appointments'] })
      qc.invalidateQueries({ queryKey: ['scheduled-today'] })
      qc.invalidateQueries({ queryKey: ['overdue-appointments'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">{t('lider.col.consultation')}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <p className="text-sm font-semibold text-gray-900">{lead.clientName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{lead.phone}</p>
          {(lead.appointmentDate || lead.postponedDate) && (
            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 shrink-0" />
              {fmtDateTime(lead.postponedDate || lead.appointmentDate, lead.postponedTime || lead.appointmentTime)}
              {lead.assignedTo ? ` · ${lead.assignedTo.name}` : ''}
            </p>
          )}
        </div>
        <div className="space-y-2 mb-4">
          {([
            ['planned',      'lider.consult.planned',     'border-cyan-500 bg-cyan-50 text-cyan-800'],
            ['happened',     'lider.consult.happened',    'border-green-500 bg-green-50 text-green-800'],
            ['not_happened', 'lider.consult.notHappened', 'border-red-500 bg-red-50 text-red-800'],
            ['postponed',    'lider.consult.postponed',   'border-orange-500 bg-orange-50 text-orange-800'],
          ] as const).map(([val, labelKey, cls]) => (
            <button key={val} onClick={() => {
              setStatus(val)
              if (val === 'postponed' && !pDate) setPDate(tomorrowDateStr())
            }}
              className={`w-full py-3 rounded-xl text-sm font-semibold border-2 transition-all ${status === val ? cls : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
              {t(labelKey)}
            </button>
          ))}
        </div>
        {status === 'postponed' && (
          <div className="p-3.5 bg-orange-50 border border-orange-100 rounded-xl mb-4 space-y-2">
            <p className="text-xs font-semibold text-orange-700">{t('lider.consult.postponed')}</p>
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
            {t('common.cancel')}
          </button>
          <button onClick={() => mutation.mutate({
            consultationStatus: status || null,
            postponedDate: status === 'postponed' ? pDate || null : null,
            postponedTime: status === 'postponed' ? pTime || null : null,
          })} disabled={!status || mutation.isPending}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            {mutation.isPending ? '...' : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LiderLeadsPage() {
  const qc = useQueryClient()
  const { t } = useT()

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
  const [validationError, setValidationError] = useState<string | null>(null)
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

  const qKey = ['lider-report', periodStore.period, periodStore.monthOffset, periodStore.customFrom, periodStore.customTo,
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
    refetchInterval: 5000,
    staleTime: 0,
  })

  // Today's leads that have been scheduled for a meeting (any date)
  const { data: scheduledTodayLeads = [] } = useQuery<Lead[]>({
    queryKey: ['scheduled-today'],
    queryFn: () => api.get('/leads/scheduled-today').then(r => r.data),
    refetchInterval: 5000,
    staleTime: 0,
  })
  const [showScheduledToday, setShowScheduledToday] = useState(true)

  const { data: overdueLeads = [] } = useQuery<Lead[]>({
    queryKey: ['overdue-appointments'],
    queryFn: () => api.get('/leads/overdue-appointments').then(r => r.data),
    refetchInterval: 5000,   // real-time: every 5 seconds
    staleTime: 0,
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
      qc.invalidateQueries({ queryKey: ['today-appointments'] })
      qc.invalidateQueries({ queryKey: ['scheduled-today'] })
      qc.invalidateQueries({ queryKey: ['overdue-appointments'] })
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
    // п.8: channel required
    if (!inlineChannelId) return
    // п.4: appointment date cannot be before lead arrival date
    if (inlineAppointmentDate && inlineDate && inlineAppointmentDate < inlineDate) {
      setValidationError(
        `Дата встречи (${fmtDate(inlineAppointmentDate)}) не может быть раньше даты поступления лида (${fmtDate(inlineDate)}).\n\nИсправьте дату встречи или дату поступления лида.`
      )
      return
    }
    // When inwork mode but subStatus not explicitly set, default to in_work_kc
    const resolvedSubStatus = inlineKtsMode === 'unqual'
      ? undefined
      : (inlineSubStatus || (inlineKtsMode === 'inwork' ? 'in_work_kc' : undefined))
    createMutation.mutate({
      clientName: inlineName.trim(),
      phone: '',
      date: inlineDate,
      salesChannelId: inlineChannelId || undefined,
      leadLink: inlineLeadLink || undefined,
      assignedToId: inlineKtsMode === 'unqual' ? undefined : inlineCloserId || undefined,
      subStatus: resolvedSubStatus,
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

  const exportExcel = async () => {
    try {
      const res = await api.get(`/export/lider-full?${buildParams()}`, { responseType: 'blob' })
      const blob = new Blob([res.data as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `lider-report-${new Date().toISOString().slice(0, 10)}.xlsx`
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

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <h1 className="text-xl font-bold text-gray-900">Отчёт лидоруба</h1>
          <div className="flex-1" />
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <Download className="w-4 h-4" /> {t('lider.export')}
          </button>
          <button onClick={() => refetch()}
            className="p-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors" title="Обновить">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* ── Stats cards — п.9: clickable to apply filter, п.16: conversion added ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-5">
          {[
            { label: t('lider.stats.total'),    value: stats?.totalLeads,          sub: t('lider.stats.period'), color: 'text-gray-900', filter: null },
            { label: t('lider.stats.happened'), value: stats?.totalHappened,       sub: stats?.totalScheduled ? `${pct(stats.totalHappened, stats.totalScheduled)}% ${t('lider.stats.fromScheduled')}` : '', color: 'text-green-600', filter: { consultation: 'happened' } },
            { label: t('lider.stats.cancelled'),value: stats?.totalCancelled,      sub: stats?.totalScheduled ? `${pct(stats.totalCancelled, stats.totalScheduled)}% ${t('lider.stats.fromScheduled')}` : '', color: 'text-red-500', filter: { consultation: 'not_happened' } },
            { label: t('lider.stats.postponed'),value: stats?.totalPostponed,      sub: stats?.totalScheduled ? `${pct(stats.totalPostponed, stats.totalScheduled)}% ${t('lider.stats.fromScheduled')}` : '', color: 'text-orange-500', filter: { consultation: 'postponed' } },
            { label: t('lider.stats.refusal'),  value: stats?.totalRefused, sub: null, color: 'text-red-400', filter: { subStatus: 'refused' } },
            { label: t('lider.stats.convLead'), value: `${stats?.conversionToScheduled ?? '—'}%`, sub: stats ? `${stats.totalScheduled} из ${stats.totalLeads}` : '', color: 'text-purple-600', filter: null },
            { label: t('lider.stats.convMeet'), value: stats?.totalScheduled ? `${pct(stats.totalHappened, stats.totalScheduled)}%` : '—', sub: stats ? `${stats.totalHappened} из ${stats.totalScheduled}` : '', color: 'text-blue-600', filter: null },
          ].map((card, i) => (
            <div key={i}
              onClick={() => {
                if (!card.filter) return
                const f = card.filter as any
                if (f.consultation) {
                  setPendingConsultation(f.consultation); setConsultationFilter(f.consultation)
                  setPendingSubStatus(''); setSubStatusFilter('')
                } else if (f.subStatus) {
                  setPendingSubStatus(f.subStatus); setSubStatusFilter(f.subStatus)
                  setPendingConsultation(''); setConsultationFilter('')
                }
                resetPage()
              }}
              className={`bg-white rounded-2xl border border-gray-100 p-4 transition-shadow ${card.filter ? 'hover:shadow-md hover:border-blue-200 cursor-pointer' : 'hover:shadow-sm'}`}>
              <p className="text-xs text-gray-400 mb-1.5 leading-tight font-medium">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value ?? '—'}</p>
              {card.sub && <p className="text-xs text-gray-400 mt-1">{card.sub}</p>}
              {card.filter && <p className="text-[10px] text-blue-400 mt-1">↑ нажми для фильтра</p>}
            </div>
          ))}
        </div>

        {/* Выполнение плана (only shown when a plan is set) */}
        {stats && stats.meetingsAttendedPlan > 0 && (() => {
          const pct = stats.planCompletion
          const color = pct >= 75 ? 'text-green-600' : pct >= 40 ? 'text-yellow-500' : 'text-red-500'
          const grad = pct >= 75
            ? 'from-emerald-400 to-green-600'
            : pct >= 40
            ? 'from-yellow-300 to-amber-500'
            : 'from-red-400 to-rose-600'
          const glow = pct >= 75
            ? 'shadow-[0_0_12px_rgba(34,197,94,0.4)]'
            : pct >= 40
            ? 'shadow-[0_0_12px_rgba(251,191,36,0.4)]'
            : 'shadow-[0_0_12px_rgba(239,68,68,0.35)]'
          return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{t('lider.planTitle')}</p>
                  <div className="flex items-end gap-2 mt-0.5">
                    <p className={`text-3xl font-black ${color}`}>{pct}%</p>
                    <p className="text-sm text-gray-400 mb-0.5 font-medium">{stats.totalHappened} из {stats.meetingsAttendedPlan} {t('lider.meetings')}</p>
                  </div>
                </div>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center ${glow}`}>
                  <span className="text-white text-lg font-black">{pct}%</span>
                </div>
              </div>
              <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${grad} transition-all duration-700 ease-out`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
                {/* shimmer line */}
                <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
                {pct > 12 && (
                  <span className="absolute left-3 inset-y-0 flex items-center text-[11px] font-bold text-white/90 drop-shadow">
                    {stats.totalHappened} / {stats.meetingsAttendedPlan}
                  </span>
                )}
              </div>
            </div>
          )
        })()}

        {/* п.17: Department stats */}
        {stats?.deptStats && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('lider.dept.title')}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{stats.deptStats.total}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('lider.dept.total')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.deptStats.scheduled}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('lider.dept.scheduled')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.deptStats.happened}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('lider.dept.happened')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Воронка лидов — under dept stats */}
        {funnel && funnel.total > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">{t('lider.funnel.title')}</h3>
            <div className="flex items-stretch gap-1.5">
              {[
                { label: t('lider.funnel.total'),     value: funnel.total,     pct: null,                                                    bg: 'bg-slate-100 text-slate-800 border-slate-200' },
                { label: t('lider.funnel.qualified'), value: funnel.qualified, pct: pct(funnel.qualified, funnel.total),                     bg: 'bg-green-100 text-green-800 border-green-200' },
                { label: t('lider.funnel.scheduled'), value: funnel.scheduled, pct: pct(funnel.scheduled, funnel.qualified || funnel.total), bg: 'bg-blue-100 text-blue-800 border-blue-200' },
                { label: t('lider.funnel.happened'),  value: funnel.happened,  pct: pct(funnel.happened, funnel.scheduled || 1),             bg: 'bg-purple-100 text-purple-800 border-purple-200' },
                { label: t('lider.funnel.sold'),      value: funnel.sold,      pct: pct(funnel.sold, funnel.happened || 1),                  bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
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

        {/* ── Filters with deferred Apply button ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-2.5 items-end">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={pendingSearch} onChange={e => setPendingSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                placeholder={t('lider.search')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            {/* ✅ Custom dropdowns (non-native) for full i18n support */}
            <FilterDropdown
              value={pendingChannelId}
              onChange={setPendingChannelId}
              placeholder={t('lider.allChannels')}
              options={channels.map(c => ({ value: c.id, label: c.name }))}
            />
            <FilterDropdown
              value={pendingKtsStatus}
              onChange={setPendingKtsStatus}
              placeholder={t('lider.qualFilter')}
              options={[
                { value: 'qualified',   label: t('lider.badge.qual') },
                { value: 'unqualified', label: t('lider.badge.unqual') },
                { value: 'in_work',     label: t('lider.badge.inwork') },
              ]}
            />
            <FilterDropdown
              value={pendingSubStatus}
              onChange={setPendingSubStatus}
              placeholder={t('lider.subStatusFilter')}
              options={[
                { value: 'scheduled',  label: t('lider.sub.scheduled') },
                { value: 'refused',    label: t('lider.sub.refused') },
                { value: 'thinking',   label: t('lider.sub.thinking') },
                { value: 'in_work_kc', label: t('lider.sub.inwork') },
              ]}
            />
            <FilterDropdown
              value={pendingConsultation}
              onChange={setPendingConsultation}
              placeholder={t('lider.consultFilter')}
              options={[
                { value: 'planned',      label: t('lider.consult.planned') },
                { value: 'happened',     label: t('lider.consult.happened') },
                { value: 'not_happened', label: t('lider.consult.notHappened') },
                { value: 'postponed',    label: t('lider.consult.postponed') },
              ]}
            />
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
              <Check className="w-3.5 h-3.5" /> {t('lider.filter.applyFilters')}
            </button>
            <button onClick={resetFilters}
              className="flex items-center gap-1 py-2 px-3 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium">
              <X className="w-3.5 h-3.5" /> {t('lider.filter.resetFilters')}
            </button>
          </div>
          {filtersActive && (
            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400">{t('lider.filterLabel')}</span>
              {search && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">«{search}»</span>}
              {channelId && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{t('lider.field.channelChip')}</span>}
              {ktsStatus && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{ktsStatus}</span>}
              {subStatusFilter && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{subStatusFilter}</span>}
              {consultationFilter && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{consultationFilter}</span>}
              {dateFilter && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{t('lider.filterDate')} {fmtDate(dateFilter)}</span>}
            </div>
          )}
        </div>

        {/* ── Reminders strip (full width, shown only when items exist) ── */}
        {reminders && totalReminderCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {reminders.needStatusUpdate > 0 && (
              <button onClick={() => applyQuickFilter({ subStatus: '', consultationStatus: 'needUpdate' })}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl hover:border-red-400 transition-colors text-left">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-xs font-medium text-gray-800">{t('lider.btn.updateStatus')}</span>
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
                <span className="text-xs font-medium text-gray-800">{t('lider.postponeNoDate')}</span>
                <span className="text-xs font-bold text-yellow-700 bg-yellow-100 rounded-full px-2 py-0.5">{reminders.postponedNoDate}</span>
              </button>
            )}
          </div>
        )}

        {/* ── Today's leads that have been scheduled (any date) ── */}
        <div className="bg-white rounded-2xl border border-green-100 mb-4 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-green-50/40 transition-colors"
            onClick={() => setShowScheduledToday(v => !v)}>
            <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Check className="w-4 h-4 text-green-500" />
              {t('lider.section.scheduledToday')}
              {scheduledTodayLeads.length > 0 && (
                <span className="bg-green-600 text-white text-xs font-bold rounded-full px-2 py-0.5 ml-1">{scheduledTodayLeads.length}</span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{t('lider.section.scheduledTodayHint')}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showScheduledToday ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {showScheduledToday && (
            scheduledTodayLeads.length === 0 ? (
              <div className="px-4 pb-4 text-center py-6 text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">{t('lider.section.noScheduledToday')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 px-4 pb-4">
                {scheduledTodayLeads.map(lead => {
                  const apptDate = lead.postponedDate || lead.appointmentDate
                  const apptTime = lead.postponedDate ? lead.postponedTime : lead.appointmentTime
                  const cs = lead.consultationStatus
                  const csColor = cs === 'happened' ? 'text-green-600' : cs === 'cancelled' ? 'text-red-500' : cs === 'postponed' ? 'text-orange-500' : 'text-blue-600'
                  const csLabel = cs === 'happened' ? t('lider.consult.happened') : cs === 'cancelled' ? t('lider.consult.notHappened') : cs === 'postponed' ? t('lider.consult.postponed') : cs === 'planned' ? t('lider.consult.planned') : t('lider.sub.scheduled')
                  return (
                    <div key={lead.id} className="p-3 rounded-xl border bg-green-50 border-green-100">
                      <p className="text-xs font-bold text-gray-900 truncate">{lead.clientName}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{lead.assignedTo?.name || t('lider.noCloser')}</p>
                      {apptDate && (
                        <p className="text-xs text-gray-700 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 shrink-0 text-green-600" />
                          {fmtDate(apptDate)}{apptTime ? ` ${apptTime}` : ''}
                        </p>
                      )}
                      <p className={`text-xs font-semibold mt-1 ${csColor}`}>{csLabel}</p>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

        {/* ── Leads with meeting scheduled for today ── */}
        <div className="bg-white rounded-2xl border border-blue-100 mb-4 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50/40 transition-colors"
            onClick={() => setShowAllToday(v => !v)}>
            <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Clock className="w-4 h-4 text-blue-500" />
              {t('lider.section.scheduledForToday')}
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
                <p className="text-sm">{t('lider.section.noScheduledForToday')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 px-4 pb-4">
                {todayLeads.map(lead => {
                  const apptDate = lead.postponedDate || lead.appointmentDate
                  const apptTime = lead.postponedDate ? lead.postponedTime : lead.appointmentTime
                  return (
                    <div key={lead.id} className="p-3 rounded-xl border bg-blue-50 border-blue-100">
                      <p className="text-xs font-bold text-gray-900 truncate">{lead.clientName}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{lead.assignedTo?.name || t('lider.noCloser')}</p>
                      {apptDate && (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 shrink-0" />
                          {fmtDate(apptDate)}{apptTime ? ` ${apptTime}` : ''}
                        </p>
                      )}
                      <div className="mt-1"><SubStatusBadge value={lead.subStatus} /></div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

        {/* ── Overdue meetings ── */}
        {overdueLeads.length > 0 && (
          <div className="mb-4 bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-50/50 transition-colors"
              onClick={() => setShowOverdue(v => !v)}>
              <span className="flex items-center gap-2 text-sm font-bold text-red-700">
                <AlertCircle className="w-4 h-4 text-red-500" />
                {t('lider.section.overdue')}
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 ml-1">{overdueLeads.length}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-red-400 transition-transform ${showOverdue ? 'rotate-180' : ''}`} />
            </button>
            {showOverdue && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 px-4 pb-4">
                {overdueLeads.map(lead => {
                  const overdueDate = lead.postponedDate || lead.appointmentDate
                  const isPostponed = lead.consultationStatus === 'postponed'
                  return (
                    <div key={lead.id} className="p-3 rounded-xl border border-red-100 bg-red-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-red-800 flex items-center gap-1">
                            <Calendar className="w-3 h-3 shrink-0" />{fmtDate(overdueDate!)}
                            {isPostponed && <span className="text-orange-500 text-[10px] font-medium">{t('lider.postponeTag')}</span>}
                          </p>
                          <p className="text-xs text-gray-700 font-semibold truncate mt-0.5">{lead.clientName}</p>
                          <p className="text-xs text-gray-500 truncate">{lead.assignedTo?.name || t('lider.noCloser')}</p>
                        </div>
                        <button
                          onClick={() => setStatusLead(lead)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold whitespace-nowrap shrink-0"
                        >
                          {t('lider.btn.mark')}
                        </button>
                      </div>
                    </div>
                  )
                })}
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
                          { label: t('lider.col.date'), field: 'createdAt', sort: true },
                          { label: t('lider.col.link'), field: null, sort: false },
                          { label: t('lider.col.channel'), field: 'channel', sort: true },
                          { label: t('lider.col.qual'), field: null, sort: false },
                          { label: t('lider.col.substatus'), field: 'subStatus', sort: true },
                          { label: t('lider.col.apptDate'), field: null, sort: false },
                          { label: t('lider.col.closer'), field: null, sort: false },
                          { label: t('lider.col.consultation'), field: 'consultationStatus', sort: true },
                          { label: t('lider.col.postpone'), field: null, sort: false },
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
                            {t('common.add')}
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
                                placeholder={t('lider.field.leadLinkPlaceholder')}
                                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                              <input value={inlineName} onChange={e => setInlineName(e.target.value)}
                                placeholder={t('lider.field.clientNamePlaceholder')}
                                autoFocus
                                className="w-full text-xs border border-blue-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white font-medium" />
                            </div>
                          </td>
                          {/* Channel */}
                          <td className="px-2 py-3">
                            <select value={inlineChannelId} onChange={e => setInlineChannelId(e.target.value)}
                              className={`text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 bg-white w-28 ${
                                !inlineChannelId
                                  ? 'border-orange-400 ring-1 ring-orange-300 text-orange-600 focus:ring-orange-400'
                                  : 'border-gray-300 focus:ring-blue-400'
                              }`}>
                              <option value="">— канал * —</option>
                              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </td>
                          {/* KTS mode 3-way toggle on inline add */}
                          <td className="px-2 py-3">
                            <div className="flex flex-col gap-1">
                              {(['qual', 'unqual', 'inwork'] as const).map(mode => (
                                <button key={mode} type="button"
                                  onClick={() => {
                                    setInlineKtsMode(mode)
                                    if (mode === 'inwork') setInlineSubStatus('in_work_kc')
                                    else if (mode === 'unqual') setInlineSubStatus('')
                                  }}
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
                                    inlineKtsMode === mode
                                      ? mode === 'qual' ? 'bg-green-600 text-white'
                                        : mode === 'unqual' ? 'bg-red-600 text-white'
                                        : 'bg-purple-600 text-white'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}>
                                  {mode === 'qual' ? t('lider.badge.qual') : mode === 'unqual' ? t('lider.badge.unqual') : t('lider.badge.inwork')}
                                </button>
                              ))}
                            </div>
                          </td>
                          {/* Sub-status (Записан/Отказ/Думает) — disabled for Не квал */}
                          <td className="px-2 py-3">
                            <select value={inlineSubStatus}
                              disabled={inlineKtsMode === 'unqual'}
                              onChange={e => setInlineSubStatus(e.target.value)}
                              className={`text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-28 ${
                                inlineKtsMode === 'unqual' ? 'opacity-40 cursor-not-allowed border-gray-200' : 'border-gray-300'
                              }`}>
                              <option value="">{t('lider.sub.placeholder')}</option>
                              <option value="scheduled">{t('lider.sub.scheduled')}</option>
                              <option value="refused">{t('lider.sub.refused')}</option>
                              <option value="thinking">{t('lider.sub.thinking')}</option>
                              <option value="in_work_kc">{t('lider.sub.inwork')}</option>
                            </select>
                          </td>
                          {/* Appointment date + time — min=inlineDate prevents booking before lead arrival */}
                          <td className="px-2 py-3">
                            <div className="space-y-1">
                              <input type="date" value={inlineAppointmentDate}
                                min={inlineDate}
                                onChange={e => {
                                  setInlineAppointmentDate(e.target.value)
                                  if (e.target.value) {
                                    // Auto-set statuses when a meeting date is chosen
                                    if (inlineSubStatus !== 'refused') setInlineSubStatus('scheduled')
                                    setInlineConsultationStatus('planned')
                                  }
                                }}
                                className="w-32 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                              <input type="time" value={inlineAppointmentTime} onChange={e => setInlineAppointmentTime(e.target.value)}
                                className="w-24 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            </div>
                          </td>
                          {/* Closer */}
                          <td className="px-2 py-3">
                            <select value={inlineCloserId} onChange={e => setInlineCloserId(e.target.value)}
                              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-28">
                              <option value="">{t('lider.closer.placeholder')}</option>
                              {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </td>
                          {/* Consultation status — selectable when subStatus is scheduled */}
                          <td className="px-2 py-3">
                            {inlineSubStatus === 'scheduled' ? (
                              <select value={inlineConsultationStatus} onChange={e => setInlineConsultationStatus(e.target.value)}
                                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-32">
                                <option value="">{t('lider.consult.placeholder')}</option>
                                <option value="planned">{t('lider.consult.planned')}</option>
                                <option value="happened">{t('lider.consult.happened')}</option>
                                <option value="not_happened">{t('lider.consult.notHappened')}</option>
                                <option value="postponed">{t('lider.consult.postponed')}</option>
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
                                disabled={!inlineName.trim() || !inlineChannelId || createMutation.isPending}
                                title={!inlineChannelId ? t('lider.field.noChannel') : undefined}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors whitespace-nowrap">
                                <Check className="w-3 h-3" /> {t('common.save')}
                              </button>
                              <button onClick={resetInlineForm}
                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap">
                                <X className="w-3 h-3" /> {t('common.cancel')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {sortedLeads.length === 0 && !showInlineAdd && (
                        <tr>
                          <td colSpan={10} className="py-14 text-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-2">📋</div>
                            <p className="font-semibold text-gray-600">{t('lider.noLeads')}</p>
                            <p className="text-sm text-gray-400 mt-1">
                              {filtersActive ? t('lider.noLeadsFiltered') : t('lider.noLeadsAdd')}
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
                            {/* п.7: show postponedDate when it exists (even after status changes to happened) */}
                            {lead.postponedDate
                              ? <span className={lead.consultationStatus === 'postponed' ? 'text-orange-600' : ''}>
                                  {fmtDateTime(lead.postponedDate, lead.postponedTime)}
                                </span>
                              : fmtDateTime(lead.appointmentDate, lead.appointmentTime)}
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
                  : t('lider.zeroLeads')}
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
                <span className="text-xs text-gray-400">{t('lider.pageSize')}</span>
                {[15, 30, 50, 100].map(n => (
                  <button key={n} onClick={() => { setPageSize(n); resetPage() }}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${pageSize === n ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 border border-gray-200'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Modals */}
      {editLead && <EditLeadModal lead={editLead} onClose={() => setEditLead(null)} channels={channels} closers={closers} />}
      {statusLead && <QuickStatusModal lead={statusLead} onClose={() => setStatusLead(null)} />}

      {/* Validation error modal (date conflict) */}
      {validationError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setValidationError(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Ошибка в дате</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">{validationError}</p>
              </div>
            </div>
            <button onClick={() => setValidationError(null)}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors">
              Понял, исправлю
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
