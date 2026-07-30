import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import PeriodSelector from '../components/ui/PeriodSelector'
import { ArrowLeft, Link2, ExternalLink, Phone, User } from 'lucide-react'

function fmt(s: string) {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ROPLinksPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const periodState = usePeriodStore()
  const params = buildPeriodParams(periodState)

  const [tab, setTab] = useState<'REFUSAL' | 'IN_WORK'>(
    (searchParams.get('tab') as 'REFUSAL' | 'IN_WORK') || 'REFUSAL'
  )
  const [filterManager, setFilterManager] = useState<string>('all')

  const status = tab === 'REFUSAL' ? 'REFUSED' : 'IN_WORK'

  const leadsQuery = useQuery({
    queryKey: ['rop-links-leads', params, status],
    queryFn: () => api.get(`/leads/all?${params}&status=${status}`).then(r => r.data),
    refetchInterval: 30000,
  })

  const leads: any[] = leadsQuery.data || []

  // Get unique managers for filter (assigned closer)
  const managers = Array.from(
    new Map(
      leads
        .filter(l => l.assignedTo)
        .map(l => [l.assignedTo.id, l.assignedTo.name])
    ).entries()
  )
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Apply manager filter
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

  return (
    <div className="space-y-5 px-4 md:px-6 py-2 md:py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/rop')}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">CRM-ссылки клоузеров</h1>
          <p className="text-sm text-gray-400 mt-0.5">Все отказы и сделки в работе за период</p>
        </div>
      </div>

      {/* Period selector + tabs row */}
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
        </div>
      </div>

      {/* Toolbar: filter by manager */}
      <div className="flex items-center gap-3 flex-wrap">
        {managers.length > 1 && (
          <select
            value={filterManager}
            onChange={e => setFilterManager(e.target.value)}
            className="input text-sm py-1.5 w-auto"
          >
            <option value="all">Все менеджеры ({managers.length})</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <span className="ml-auto text-sm text-gray-400">
          {filtered.length} {tab === 'REFUSAL' ? 'отказников' : 'в дожиме'}
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
            {tab === 'REFUSAL' ? 'Нет отказников за выбранный период' : 'Нет сделок в работе за выбранный период'}
          </p>
        </div>
      )}

      {/* Leads grouped by manager */}
      {!leadsQuery.isLoading && managerGroups.length > 0 && (
        <div className="space-y-4">
          {managerGroups.map(([managerId, mgr]) => (
            <div key={managerId} className="card p-0 overflow-hidden">
              {/* Manager header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">{mgr.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="font-semibold text-gray-800 text-sm">{mgr.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{mgr.items.length}</span>
                </div>
              </div>

              {/* Leads */}
              <div className="divide-y divide-gray-50">
                {mgr.items.map((lead: any) => (
                  <div key={lead.id} className="flex items-start gap-3 px-4 py-3 bg-white hover:bg-gray-50/60 transition-colors">
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Client name */}
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        <span className="text-sm font-semibold text-gray-800">{lead.clientName || 'Без имени'}</span>
                        <span className="text-xs text-gray-400">{fmt(lead.date)}</span>
                      </div>
                      {/* Phone */}
                      {lead.phone && (
                        <div className="flex items-center gap-2">
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
                      {/* CRM link */}
                      {lead.crmLink ? (
                        <a
                          href={lead.crmLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium group/link w-fit"
                        >
                          <Link2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-xs">{lead.crmLink}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-300 italic">Нет CRM-ссылки</span>
                      )}
                      {/* Comment */}
                      {lead.comment && (
                        <p className="text-xs text-gray-500 italic">{lead.comment}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
