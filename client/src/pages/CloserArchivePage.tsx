import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import { useT } from '../i18n'
import {
  Phone, Calendar, User, ExternalLink, Banknote, ChevronDown, ChevronUp,
  Check, X, CheckSquare, Trash2, RotateCcw, Search, Filter,
} from 'lucide-react'

type Lead = {
  id: string
  clientName: string
  phone: string
  date: string
  createdAt: string
  isQualified: boolean
  comment: string | null
  status: string
  subStatus: string | null
  appointmentDate: string | null
  appointmentTime: string | null
  consultationStatus: string | null
  salesChannel: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  assignedTo: { id: string; name: string } | null
  tasks: { id: string; title: string; dueDate: string; completed: boolean }[]
  amount: number | null
  netAmount: number | null
  paymentType: string | null
  paymentMethod: string | null
  crmLink: string | null
  closerComment: string | null
  isRefund: boolean
  refundComment: string | null
  deletedAt: string | null
}

// Static dot/badge styles — no i18n needed
const STATUS_STYLE: Record<string, { dot: string; badge: string }> = {
  ASSIGNED:    { dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700' },
  IN_WORK:     { dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700' },
  REFUSED:     { dot: 'bg-red-400',    badge: 'bg-red-50 text-red-700' },
  SOLD:        { dot: 'bg-green-400',  badge: 'bg-green-50 text-green-700' },
  DELETED:     { dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-500' },
  UNQUALIFIED: { dot: 'bg-gray-300',   badge: 'bg-gray-50 text-gray-500' },
  NEW:         { dot: 'bg-purple-400', badge: 'bg-purple-50 text-purple-700' },
}

function fmtDate(s: string, lang: string) {
  if (!s) return ''
  return new Date(s + 'T12:00:00').toLocaleDateString(lang === 'kk' ? 'kk' : 'ru', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(s: string, lang: string) {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleString(lang === 'kk' ? 'kk' : 'ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Lead Card ────────────────────────────────────────────────────────────────
function ArchiveCard({ lead }: { lead: Lead }) {
  const qc = useQueryClient()
  const { t, lang } = useT()
  const [open, setOpen] = useState(false)

  const completedTasks = lead.tasks.filter(t => t.completed).length
  const totalTasks = lead.tasks.length
  const style = STATUS_STYLE[lead.status] ?? STATUS_STYLE.NEW
  const isDeleted = lead.status === 'DELETED'
  const isSold = lead.status === 'SOLD'

  // i18n status labels
  const statusLabels: Record<string, string> = {
    ASSIGNED:    t('ca.status.planned'),
    IN_WORK:     t('ca.status.inwork'),
    REFUSED:     t('ca.status.refused'),
    SOLD:        t('ca.status.sold'),
    DELETED:     t('ca.status.deleted'),
    UNQUALIFIED: t('ca.status.unqual'),
    NEW:         t('ca.status.new'),
  }

  // i18n payment type labels
  const paymentLabels: Record<string, string> = {
    new_sale:   t('ca.pay.new'),
    additional: t('ca.pay.additional'),
    refund:     t('ca.pay.refund'),
  }

  const statusLabel = statusLabels[lead.status] ?? lead.status

  const restoreMut = useMutation({
    mutationFn: () => api.put(`/leads/${lead.id}/restore`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-archive'] }),
  })

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${isDeleted ? 'opacity-60 bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <span className={`w-2.5 h-2.5 rounded-full ${style.dot} mt-1.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-semibold ${isDeleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {lead.clientName}
            </p>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
              {statusLabel}
            </span>
            {lead.isRefund && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 flex items-center gap-0.5">
                <RotateCcw className="w-3 h-3" /> {t('ca.card.refund')}
              </span>
            )}
            {totalTasks > 0 && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${completedTasks === totalTasks ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                <CheckSquare className="w-3 h-3 inline mr-0.5" />{completedTasks}/{totalTasks}
              </span>
            )}
            {(lead.netAmount ?? lead.amount) && (
              <span className={`text-[11px] font-medium flex items-center gap-0.5 ${isSold && !lead.isRefund ? 'text-green-600' : 'text-gray-400'}`}>
                <Banknote className="w-3 h-3" />
                ₸ {Number(lead.netAmount ?? lead.amount).toLocaleString('ru')}
                {lead.paymentType && <span className="ml-0.5">({paymentLabels[lead.paymentType] ?? lead.paymentType})</span>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{lead.date}</span>
            {lead.appointmentDate && (
              <span className="flex items-center gap-1 text-blue-500">
                <Calendar className="w-3 h-3" />{t('ca.card.meetingPrefix')} {lead.appointmentDate.split('-').reverse().join('.')}
                {lead.appointmentTime ? ` ${lead.appointmentTime}` : ''}
              </span>
            )}
            {lead.salesChannel && <span>{lead.salesChannel.name}</span>}
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{lead.createdBy?.name}</span>
            <span className="text-gray-300">{t('ca.card.received')} {fmtDateTime(lead.createdAt, lang)}</span>
            {isDeleted && lead.deletedAt && (
              <span className="text-red-400 flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> {t('ca.card.deleted')} {fmtDateTime(lead.deletedAt, lang)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {lead.status === 'REFUSED' && (
            <button
              onClick={e => { e.stopPropagation(); restoreMut.mutate() }}
              disabled={restoreMut.isPending}
              className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg font-medium transition-colors"
            >
              {t('ca.card.toWork')}
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-3">
          {/* Consultation status */}
          {lead.consultationStatus && (
            <div className={`text-xs font-medium px-3 py-2 rounded-lg ${
              lead.consultationStatus === 'happened' ? 'bg-green-50 text-green-700' :
              lead.consultationStatus === 'not_happened' ? 'bg-red-50 text-red-700' :
              'bg-orange-50 text-orange-700'
            }`}>
              {t('ca.consult.prefix')} {lead.consultationStatus === 'happened' ? t('ca.consult.happened') : lead.consultationStatus === 'not_happened' ? t('ca.consult.notHappened') : t('ca.consult.postponed')}
            </div>
          )}
          {lead.comment && (
            <p className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border-l-2 border-blue-300">
              <span className="text-xs font-semibold text-blue-600 block mb-0.5">{t('ca.card.liderComment')}</span>
              {lead.comment}
            </p>
          )}
          {lead.closerComment && (
            <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              <span className="text-xs font-semibold text-gray-500 block mb-0.5">{t('ca.card.closerComment')}</span>
              {lead.closerComment}
            </p>
          )}
          {lead.isRefund && lead.refundComment && (
            <p className="text-sm bg-orange-50 text-orange-700 px-3 py-2 rounded-lg">
              <span className="text-xs font-semibold block mb-0.5">{t('ca.card.refundReason')}</span>
              {lead.refundComment}
            </p>
          )}
          {lead.crmLink && (
            <a href={lead.crmLink} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium">
              <ExternalLink className="w-4 h-4" /> {t('ca.card.crmLink')}
            </a>
          )}
          {lead.tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('ca.card.tasks')}</p>
              <div className="space-y-1.5">
                {lead.tasks.map(task => (
                  <div key={task.id} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${task.completed ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'}`}>
                    {task.completed
                      ? <Check className="w-4 h-4 text-green-600 shrink-0" />
                      : <div className="w-4 h-4 rounded-full border-2 border-current shrink-0" />
                    }
                    <span className={task.completed ? 'line-through opacity-60' : ''}>{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CloserArchivePage() {
  const { t } = useT()
  const periodState = usePeriodStore()
  const params = buildPeriodParams(periodState)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const archiveQ = useQuery({
    queryKey: ['closer-archive', params, statusFilter],
    queryFn: () => api.get(`/leads/closer-archive?${params}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`).then(r => r.data),
  })

  const leads: Lead[] = archiveQ.data || []

  // Client-side search filter
  const filtered = search
    ? leads.filter(l =>
        l.clientName.toLowerCase().includes(search.toLowerCase()) ||
        l.phone.includes(search)
      )
    : leads

  // Stats
  const sold = filtered.filter(l => l.status === 'SOLD' && !l.isRefund)
  const refunds = filtered.filter(l => l.isRefund)
  const refused = filtered.filter(l => l.status === 'REFUSED')
  const deleted = filtered.filter(l => l.status === 'DELETED')
  const soldTotal = sold.reduce((s, l) => s + (l.netAmount ?? l.amount ?? 0), 0)
  const refundTotal = refunds.reduce((s, l) => s + (l.netAmount ?? l.amount ?? 0), 0)

  const STATUS_FILTERS = [
    { value: 'all',      label: t('ca.filter.all') },
    { value: 'SOLD',     label: t('ca.filter.sold') },
    { value: 'REFUSED',  label: t('ca.filter.refused') },
    { value: 'IN_WORK',  label: t('ca.filter.inwork') },
    { value: 'ASSIGNED', label: t('ca.filter.assigned') },
    { value: 'DELETED',  label: t('ca.filter.deleted') },
  ]

  return (
    <div className="space-y-5 px-4 md:px-6 py-2 md:py-4 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('ca.title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('ca.subtitle')}</p>
      </div>

      {/* Stats summary */}
      {!archiveQ.isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 font-medium">{t('ca.stats.total')}</p>
            <p className="text-2xl font-black text-gray-800 mt-0.5">{filtered.length}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
            <p className="text-xs text-green-600 font-medium">{t('ca.stats.sales')}</p>
            <p className="text-2xl font-black text-green-700 mt-0.5">{sold.length}</p>
            {soldTotal > 0 && <p className="text-[11px] text-green-500 mt-0.5">₸ {soldTotal.toLocaleString('ru')}</p>}
          </div>
          {refunds.length > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
              <p className="text-xs text-orange-600 font-medium">{t('ca.stats.refunds')}</p>
              <p className="text-2xl font-black text-orange-700 mt-0.5">{refunds.length}</p>
              {refundTotal > 0 && <p className="text-[11px] text-orange-500 mt-0.5">₸ {refundTotal.toLocaleString('ru')}</p>}
            </div>
          )}
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
            <p className="text-xs text-red-600 font-medium">{t('ca.stats.refused')}</p>
            <p className="text-2xl font-black text-red-700 mt-0.5">{refused.length}</p>
          </div>
          {deleted.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-500 font-medium flex items-center justify-center gap-1">
                <Trash2 className="w-3 h-3" /> {t('ca.stats.deleted')}
              </p>
              <p className="text-2xl font-black text-gray-500 mt-0.5">{deleted.length}</p>
            </div>
          )}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder={t('ca.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === f.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {f.label}
              {f.value !== 'all' && (
                <span className="ml-1.5 text-[10px] opacity-60">
                  {filtered.filter(l => l.status === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Deleted warning banner */}
      {deleted.length > 0 && statusFilter !== 'DELETED' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Trash2 className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            {t('ca.deleted.warning', { n: deleted.length })}
          </p>
          <button onClick={() => setStatusFilter('DELETED')} className="ml-auto text-xs text-amber-700 font-semibold underline whitespace-nowrap">
            {t('ca.deleted.show')}
          </button>
        </div>
      )}

      {archiveQ.isLoading && <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">{t('common.loading')}</div>}

      {!archiveQ.isLoading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-14 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl mx-auto flex items-center justify-center mb-3">
            <Filter className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-gray-400 font-medium">{t('ca.empty')}</p>
          <p className="text-xs text-gray-300 mt-1">{t('ca.emptyHint')}</p>
        </div>
      )}

      {!archiveQ.isLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(lead => (
            <ArchiveCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  )
}
