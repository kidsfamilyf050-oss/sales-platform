import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import PeriodSelector from '../components/ui/PeriodSelector'
import { ArrowLeft, Link2, ExternalLink, Phone, User, X, RotateCcw, ChevronRight } from 'lucide-react'

function fmt(s: string) {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtMoney(n: number) { return n.toLocaleString('ru') }

// ── Lead detail modal ─────────────────────────────────────────────────────────
function LeadDetailModal({ lead, onClose }: { lead: any; onClose: () => void }) {
  const statusLabel = lead.status === 'SOLD' ? 'Продажа' : lead.status === 'REFUSED' ? 'Отказ' : lead.status === 'IN_WORK' ? 'Дожим' : lead.status
  const statusCls = lead.status === 'SOLD' ? 'bg-green-100 text-green-700' : lead.status === 'REFUSED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Заявка</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-base">{lead.clientName}</p>
              {lead.phone && <p className="text-gray-500">{lead.phone}</p>}
            </div>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusCls}`}>
              {statusLabel}{lead.isRefund ? ' · Возврат' : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div><span className="text-gray-400">Дата заявки:</span> <span className="font-medium">{lead.date}</span></div>
            <div><span className="text-gray-400">Канал:</span> <span className="font-medium">{lead.salesChannel?.name || '—'}</span></div>
            {lead.assignedTo && <div><span className="text-gray-400">Клоузер:</span> <span className="font-medium">{lead.assignedTo.name}</span></div>}
            {lead.amount != null && (
              <div>
                <span className="text-gray-400">Сумма:</span>{' '}
                <span className={`font-bold ${lead.isRefund ? 'text-red-600' : 'text-green-700'}`}>
                  {lead.isRefund ? '−' : ''}₸ {fmtMoney(lead.amount)}
                </span>
              </div>
            )}
            {lead.netAmount != null && lead.netAmount !== lead.amount && (
              <div><span className="text-gray-400">Бюджет:</span> <span className="font-medium">₸ {fmtMoney(lead.netAmount)}</span></div>
            )}
            {lead.paymentMethod && <div><span className="text-gray-400">Оплата:</span> <span className="font-medium">{lead.paymentMethod}</span></div>}
            {lead.lossReason && (
              <div className="col-span-2">
                <span className="text-gray-400">Причина отказа:</span>{' '}
                <span className="font-medium text-red-600">{lead.lossReason.name}</span>
              </div>
            )}
            {lead.isRefund && lead.refundComment && (
              <div className="col-span-2">
                <span className="text-gray-400">Причина возврата:</span>{' '}
                <span className="font-medium text-red-600">{lead.refundComment}</span>
              </div>
            )}
            {lead.appointmentDate && (
              <div><span className="text-gray-400">Встреча:</span> <span className="font-medium">{lead.appointmentDate}</span></div>
            )}
            {lead.crmLink && (
              <div className="col-span-2">
                <a href={lead.crmLink} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-blue-500 hover:underline">
                  <ExternalLink className="w-3 h-3" /> Открыть в CRM
                </a>
              </div>
            )}
          </div>

          {lead.closerComment && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">💬 {lead.closerComment}</div>
          )}
          {lead.comment && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">📝 {lead.comment}</div>
          )}
        </div>
      </div>
    </div>
  )
}

type TabType = 'REFUSAL' | 'IN_WORK' | 'REFUND'

export default function ROPLinksPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const periodState = usePeriodStore()
  const params = buildPeriodParams(periodState)

  const [tab, setTab] = useState<TabType>(
    (searchParams.get('tab') as TabType) || 'REFUSAL'
  )
  const [filterManager, setFilterManager] = useState<string>('all')
  const [selectedLead, setSelectedLead] = useState<any | null>(null)

  const status = tab === 'REFUSAL' ? 'REFUSED' : tab === 'IN_WORK' ? 'IN_WORK' : 'SOLD'

  const leadsQuery = useQuery({
    queryKey: ['rop-links-leads', params, tab],
    queryFn: () => {
      if (tab === 'REFUND') {
        return api.get(`/leads/refunds?${params}`).then(r => r.data)
      }
      return api.get(`/leads/all?${params}&status=${status}`).then(r => r.data)
    },
    refetchInterval: 30000,
  })

  const leads: any[] = leadsQuery.data || []

  // Get unique managers for filter
  const managers = Array.from(
    new Map(
      leads
        .filter(l => l.assignedTo)
        .map(l => [l.assignedTo.id, l.assignedTo.name])
    ).entries()
  )
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const filtered = filterManager === 'all'
    ? leads
    : leads.filter(l => l.assignedTo?.id === filterManager)

  // Group by manager
  const byManager: Record<string, { name: string; items: any[] }> = {}
  for (const l of filtered) {
    const uid = l.assignedTo?.id || 'unassigned'
    const uname = l.assignedTo?.name || 'Без клоузера'
    if (!byManager[uid]) byManager[uid] = { name: uname, items: [] }
    byManager[uid].items.push(l)
  }
  const managerGroups = Object.entries(byManager)

  const tabLabel = tab === 'REFUSAL' ? 'отказников' : tab === 'IN_WORK' ? 'в дожиме' : 'возвратов'

  // Refund totals for summary
  const refundTotal = tab === 'REFUND'
    ? filtered.reduce((s, l) => s + (l.amount ?? l.netAmount ?? 0), 0)
    : 0

  return (
    <div className="space-y-5 px-4 md:px-6 py-2 md:py-4">
      {selectedLead && <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard/rop')}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">CRM-ссылки клоузеров</h1>
          <p className="text-sm text-gray-400 mt-0.5">Все отказы, сделки в работе и возвраты за период</p>
        </div>
      </div>

      {/* Period selector + tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodSelector />
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => { setTab('REFUSAL'); setFilterManager('all') }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'REFUSAL' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            Отказники
          </button>
          <button
            onClick={() => { setTab('IN_WORK'); setFilterManager('all') }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'IN_WORK' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            Дожим
          </button>
          <button
            onClick={() => { setTab('REFUND'); setFilterManager('all') }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'REFUND' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
            Возвраты
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {managers.length > 1 && (
          <select value={filterManager} onChange={e => setFilterManager(e.target.value)}
            className="input text-sm py-1.5 w-auto">
            <option value="all">Все менеджеры ({managers.length})</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <span className="ml-auto text-sm text-gray-400 flex items-center gap-2">
          {filtered.length} {tabLabel}
          {tab === 'REFUND' && refundTotal > 0 && (
            <span className="text-red-600 font-semibold">· −₸ {fmtMoney(refundTotal)}</span>
          )}
        </span>
      </div>

      {/* Loading */}
      {leadsQuery.isLoading && (
        <div className="card text-center text-gray-400 py-12">Загрузка...</div>
      )}

      {/* Empty state */}
      {!leadsQuery.isLoading && filtered.length === 0 && (
        <div className="card text-center py-12">
          <Link2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {tab === 'REFUSAL' ? 'Нет отказников за выбранный период'
              : tab === 'IN_WORK' ? 'Нет сделок в работе за выбранный период'
              : 'Нет возвратов за выбранный период'}
          </p>
        </div>
      )}

      {/* Leads grouped by manager */}
      {!leadsQuery.isLoading && managerGroups.length > 0 && (
        <div className="space-y-4">
          {managerGroups.map(([managerId, mgr]) => {
            const mgrRefundTotal = tab === 'REFUND'
              ? mgr.items.reduce((s, l) => s + (l.amount ?? l.netAmount ?? 0), 0)
              : 0
            return (
              <div key={managerId} className="card p-0 overflow-hidden">
                {/* Manager header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">{mgr.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="font-semibold text-gray-800 text-sm">{mgr.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{mgr.items.length}</span>
                    {tab === 'REFUND' && mgrRefundTotal > 0 && (
                      <span className="text-xs text-red-600 font-semibold">−₸ {fmtMoney(mgrRefundTotal)}</span>
                    )}
                  </div>
                </div>

                {/* Leads */}
                <div className="divide-y divide-gray-50">
                  {mgr.items.map((lead: any) => (
                    <div
                      key={lead.id}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group ${
                        tab === 'REFUND' ? 'bg-red-50/20 hover:bg-red-50/60' : 'bg-white hover:bg-gray-50/60'
                      }`}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Client name */}
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                          <span className="text-sm font-semibold text-gray-800">{lead.clientName || 'Без имени'}</span>
                          <span className="text-xs text-gray-400">{fmt(lead.date)}</span>
                          {tab === 'REFUND' && lead.amount != null && (
                            <span className="ml-auto text-sm font-bold text-red-600 shrink-0">−₸ {fmtMoney(lead.amount)}</span>
                          )}
                        </div>
                        {/* Phone */}
                        {lead.phone && (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <Phone className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                            <a href={`tel:${lead.phone}`} className="text-sm text-blue-600 hover:underline">{lead.phone}</a>
                          </div>
                        )}
                        {/* Loss reason */}
                        {tab === 'REFUSAL' && lead.lossReason && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Причина:</span>
                            <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">{lead.lossReason.name}</span>
                          </div>
                        )}
                        {/* Refund comment */}
                        {tab === 'REFUND' && lead.refundComment && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Причина:</span>
                            <span className="text-xs text-orange-600 font-medium italic">{lead.refundComment}</span>
                          </div>
                        )}
                        {/* CRM link */}
                        {lead.crmLink ? (
                          <a
                            href={lead.crmLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium group/link w-fit"
                          >
                            <Link2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-xs">{lead.crmLink}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300 italic">Нет CRM-ссылки</span>
                        )}
                        {lead.comment && (
                          <p className="text-xs text-gray-500 italic">{lead.comment}</p>
                        )}
                      </div>
                      {/* Arrow hint */}
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
