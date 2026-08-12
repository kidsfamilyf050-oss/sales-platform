import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import PeriodSelector from '../components/ui/PeriodSelector'
import { ArrowLeft, Link2, ExternalLink, Phone, User, Clock, ChevronRight } from 'lucide-react'

function fmtDate(s: string) {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtMoney(n: number) { return n.toLocaleString('ru') }
function daysAgo(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / 86400000))
}

type TabType = 'new-sales' | 'all-sales' | 'dojim-sales' | 'inwork' | 'consultations' | 'refusals' | 'refunds'

const TAB_CONFIG: { key: TabType; label: string; dotCls: string; activeCls: string }[] = [
  { key: 'new-sales',     label: 'Новые продажи',  dotCls: 'bg-blue-500',   activeCls: 'text-blue-600' },
  { key: 'all-sales',     label: 'Все продажи',     dotCls: 'bg-indigo-500', activeCls: 'text-indigo-600' },
  { key: 'dojim-sales',   label: 'Закр. дожимы',   dotCls: 'bg-amber-500',  activeCls: 'text-amber-600' },
  { key: 'inwork',        label: 'В работе',        dotCls: 'bg-orange-400', activeCls: 'text-orange-600' },
  { key: 'consultations', label: 'Консультации',    dotCls: 'bg-teal-500',   activeCls: 'text-teal-600' },
  { key: 'refusals',      label: 'Отказники',       dotCls: 'bg-red-400',    activeCls: 'text-red-600' },
  { key: 'refunds',       label: 'Возвраты',        dotCls: 'bg-orange-500', activeCls: 'text-orange-600' },
]

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Нал', card: 'Безнал', credit: 'Кредит', installment: 'Рассрочка',
}
const CONSULT_LABEL: Record<string, string> = {
  happened: 'Прошла', not_happened: 'Не прошла', planned: 'Запланирована',
}
const CONSULT_CLS: Record<string, string> = {
  happened: 'bg-green-100 text-green-700',
  not_happened: 'bg-red-100 text-red-700',
  planned: 'bg-yellow-100 text-yellow-700',
}

// ── Lead detail modal ──────────────────────────────────────────────────────────
function LeadDetailModal({ lead, onClose }: { lead: any; onClose: () => void }) {
  const statusLabel = lead.status === 'SOLD' ? 'Продажа'
    : lead.status === 'REFUSED' ? 'Отказ'
    : lead.status === 'IN_WORK' ? 'Дожим' : lead.status
  const statusCls = lead.status === 'SOLD' ? 'bg-green-100 text-green-700'
    : lead.status === 'REFUSED' ? 'bg-red-100 text-red-700'
    : 'bg-amber-100 text-amber-700'
  const amt = Number(lead.amount) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Заявка</h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-base">{lead.clientName}</p>
              {lead.phone && <p className="text-gray-500">{lead.phone}</p>}
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusCls}`}>
              {statusLabel}{lead.isRefund ? ' · Возврат' : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div><span className="text-gray-400">Дата:</span> <span className="font-medium">{lead.date}</span></div>
            <div><span className="text-gray-400">Канал:</span> <span className="font-medium">{lead.salesChannel?.name || '—'}</span></div>
            {lead.assignedTo && (
              <div><span className="text-gray-400">Клоузер:</span> <span className="font-medium">{lead.assignedTo.name}</span></div>
            )}
            {amt > 0 && (
              <div>
                <span className="text-gray-400">Сумма:</span>{' '}
                <span className={`font-bold ${lead.isRefund ? 'text-red-600' : 'text-green-700'}`}>
                  {lead.isRefund ? '−' : ''}₸ {fmtMoney(amt)}
                </span>
              </div>
            )}
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
        </div>
      </div>
    </div>
  )
}

// ── Lead row ───────────────────────────────────────────────────────────────────
function LeadRow({ lead, tab, onSelect }: { lead: any; tab: TabType; onSelect: () => void }) {
  const netAmt = Number(lead.netAmount ?? lead.amount) || 0
  const grossAmt = Number(lead.amount) || 0
  const isSaleTab = tab === 'new-sales' || tab === 'all-sales' || tab === 'dojim-sales'
  const isRefund = tab === 'refunds'
  const days = tab === 'inwork' ? daysAgo(lead.date || lead.createdAt) : 0

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group ${
        isRefund ? 'bg-red-50/20 hover:bg-red-50/60' : 'bg-white hover:bg-gray-50/60'
      }`}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0 space-y-1">
        {/* Name + amount + date */}
        <div className="flex items-center gap-2 flex-wrap">
          <User className="w-3.5 h-3.5 text-gray-300 shrink-0" />
          <span className="text-sm font-semibold text-gray-800">{lead.clientName || 'Без имени'}</span>
          <span className="text-xs text-gray-400">{fmtDate(lead.date || lead.createdAt)}</span>
          {isSaleTab && netAmt > 0 && (
            <span className="ml-auto text-sm font-bold text-green-700 shrink-0">₸ {fmtMoney(netAmt)}</span>
          )}
          {isRefund && grossAmt > 0 && (
            <span className="ml-auto text-sm font-bold text-red-600 shrink-0">−₸ {fmtMoney(grossAmt)}</span>
          )}
        </div>

        {/* Phone */}
        {lead.phone && (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <Phone className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <a href={`tel:${lead.phone}`} className="text-sm text-blue-600 hover:underline">{lead.phone}</a>
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {lead.salesChannel?.name && (
            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{lead.salesChannel.name}</span>
          )}
          {isSaleTab && lead.isDojim && (
            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">ДОЖИМ</span>
          )}
          {isSaleTab && lead.product?.name && (
            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">📦 {lead.product.name}</span>
          )}
          {isSaleTab && lead.paymentMethod && (
            <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABEL[lead.paymentMethod] || lead.paymentMethod}</span>
          )}
          {isSaleTab && netAmt < grossAmt && grossAmt > 0 && (
            <span className="text-xs text-gray-400 line-through">₸ {fmtMoney(grossAmt)}</span>
          )}
          {tab === 'consultations' && lead.consultationStatus && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${CONSULT_CLS[lead.consultationStatus] || 'bg-gray-100 text-gray-600'}`}>
              {CONSULT_LABEL[lead.consultationStatus] || lead.consultationStatus}
            </span>
          )}
          {tab === 'consultations' && lead.status === 'SOLD' && netAmt > 0 && (
            <span className="text-xs font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
              Продажа · ₸ {fmtMoney(netAmt)}
            </span>
          )}
          {tab === 'refusals' && lead.lossReason && (
            <span className="text-xs text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded-full">
              Причина: {lead.lossReason.name}
            </span>
          )}
          {isRefund && lead.refundComment && (
            <span className="text-xs text-orange-600 italic">{lead.refundComment}</span>
          )}
          {tab === 'inwork' && days > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Clock className="w-3 h-3" />{days} дн.
            </span>
          )}
        </div>

        {/* CRM link */}
        {lead.crmLink && (
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
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function OwnerLeadsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const periodState = usePeriodStore()
  const params = buildPeriodParams(periodState)

  const [tab, setTab] = useState<TabType>(
    (searchParams.get('tab') as TabType) || 'new-sales'
  )
  const [filterManager, setFilterManager] = useState<string>('all')
  const [selectedLead, setSelectedLead] = useState<any | null>(null)

  const leadsQuery = useQuery({
    queryKey: ['owner-leads-page', params, tab],
    queryFn: () => {
      if (tab === 'refunds')       return api.get(`/leads/refunds?${params}`).then(r => r.data)
      if (tab === 'refusals')      return api.get(`/leads/all?status=REFUSED&${params}`).then(r => r.data)
      if (tab === 'inwork')        return api.get('/leads/all?status=IN_WORK').then(r => r.data)
      if (tab === 'consultations') return api.get(`/leads/all?consultationStatus=happened&${params}`).then(r => r.data)
      if (tab === 'dojim-sales')   return api.get(`/leads/all?status=SOLD&isDojim=true&${params}`).then(r => r.data)
      if (tab === 'new-sales')     return api.get(`/leads/all?status=SOLD&isDojim=false&${params}`).then(r => r.data)
      // all-sales
      return api.get(`/leads/all?status=SOLD&${params}`).then(r => r.data)
    },
    refetchInterval: 30000,
  })

  const leads: any[] = leadsQuery.data || []

  const managers = Array.from(
    new Map(
      leads.filter(l => l.assignedTo).map(l => [l.assignedTo.id, l.assignedTo.name])
    ).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

  const filtered = filterManager === 'all' ? leads : leads.filter(l => l.assignedTo?.id === filterManager)

  const byManager: Record<string, { name: string; items: any[] }> = {}
  for (const l of filtered) {
    const uid = l.assignedTo?.id || 'unassigned'
    const uname = l.assignedTo?.name || 'Без клоузера'
    if (!byManager[uid]) byManager[uid] = { name: uname, items: [] }
    byManager[uid].items.push(l)
  }
  const managerGroups = Object.entries(byManager)

  const isSaleTab = tab === 'new-sales' || tab === 'all-sales' || tab === 'dojim-sales'
  const isRefund = tab === 'refunds'

  const totalAmount = isSaleTab
    ? filtered.reduce((s, l) => s + (Number(l.netAmount ?? l.amount) || 0), 0)
    : isRefund
    ? filtered.reduce((s, l) => s + (Number(l.amount ?? l.netAmount) || 0), 0)
    : 0

  const handleTabChange = (t: TabType) => { setTab(t); setFilterManager('all') }

  return (
    <div className="space-y-5 px-4 md:px-6 py-2 md:py-4">
      {selectedLead && <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/owner')}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Аналитика сделок</h1>
          <p className="text-sm text-gray-400 mt-0.5">Детальный просмотр по категориям</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodSelector />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {TAB_CONFIG.map(({ key, label, dotCls, activeCls }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === key ? `bg-white ${activeCls} shadow-sm` : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dotCls} shrink-0`} />
            {label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {managers.length > 1 && (
          <select
            value={filterManager}
            onChange={e => setFilterManager(e.target.value)}
            className="input text-sm py-1.5 w-auto"
          >
            <option value="all">Все менеджеры ({managers.length})</option>
            {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <span className="ml-auto text-sm text-gray-400 flex items-center gap-2">
          {filtered.length} записей
          {totalAmount > 0 && (
            <span className={`font-semibold ${isRefund ? 'text-red-600' : 'text-green-700'}`}>
              · {isRefund ? '−' : ''}₸ {fmtMoney(totalAmount)}
            </span>
          )}
        </span>
      </div>

      {/* Loading */}
      {leadsQuery.isLoading && (
        <div className="card text-center text-gray-400 py-12">Загрузка...</div>
      )}

      {/* Empty */}
      {!leadsQuery.isLoading && filtered.length === 0 && (
        <div className="card text-center py-12">
          <Link2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Нет данных за выбранный период</p>
        </div>
      )}

      {/* Leads grouped by manager */}
      {!leadsQuery.isLoading && managerGroups.length > 0 && (
        <div className="space-y-4">
          {managerGroups.map(([managerId, mgr]) => {
            const mgrTotal = isSaleTab
              ? mgr.items.reduce((s, l) => s + (Number(l.netAmount ?? l.amount) || 0), 0)
              : isRefund
              ? mgr.items.reduce((s, l) => s + (Number(l.amount ?? l.netAmount) || 0), 0)
              : 0
            return (
              <div key={managerId} className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">{mgr.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="font-semibold text-gray-800 text-sm">{mgr.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{mgr.items.length}</span>
                    {mgrTotal > 0 && (
                      <span className={`text-xs font-semibold ${isRefund ? 'text-red-600' : 'text-green-700'}`}>
                        {isRefund ? '−' : ''}₸ {fmtMoney(mgrTotal)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {mgr.items.map((lead: any) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      tab={tab}
                      onSelect={() => setSelectedLead(lead)}
                    />
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
