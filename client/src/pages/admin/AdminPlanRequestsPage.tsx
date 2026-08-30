import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/adminClient'
import { CheckCircle, XCircle, Clock, Phone, Mail, Building2, X, Zap } from 'lucide-react'

interface PlanRequest {
  id: string
  name: string
  phone: string
  email: string
  companyName: string
  plan: 'starter' | 'pro'
  status: 'pending' | 'approved' | 'rejected'
  adminNote: string | null
  companyId: string | null
  company: { id: string; name: string } | null
  createdAt: string
}

interface Company {
  id: string
  name: string
}

const PLAN_LABELS: Record<string, string> = { starter: 'Стартер', pro: 'Pro' }
const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-blue-900/40 text-blue-300 border-blue-800',
  pro: 'bg-green-900/40 text-green-300 border-green-800',
}
const STATUS_LABELS: Record<string, string> = { pending: 'Новая', approved: 'Одобрена', rejected: 'Отклонена' }
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
  approved: 'bg-green-900/30 text-green-300 border-green-700',
  rejected: 'bg-red-900/30 text-red-400 border-red-800',
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
// < 12 мес: 100к/мес Стартер, 150к/мес Pro
// 12 мес: фиксированная цена 1,000,000 и 1,500,000
const MONTHLY_PRICE: Record<string, number> = { starter: 100_000, pro: 150_000 }
const YEARLY_PRICE:  Record<string, number> = { starter: 1_000_000, pro: 1_500_000 }

const DURATION_OPTIONS = [
  { months: 1,  label: '1 мес' },
  { months: 3,  label: '3 мес' },
  { months: 6,  label: '6 мес' },
  { months: 12, label: '1 год' },
]

function calcPrice(plan: string, months: number): number {
  if (months === 12) return YEARLY_PRICE[plan] || 0
  return (MONTHLY_PRICE[plan] || 0) * months
}

// ─── Approve modal ────────────────────────────────────────────────────────────
function ApproveModal({ request, onClose }: { request: PlanRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const [companyId, setCompanyId] = useState(request.companyId || '')
  const [approvedPlan, setApprovedPlan] = useState(request.plan)
  const [months, setMonths] = useState(1)
  const [amount, setAmount] = useState(String(calcPrice(request.plan, 1)))
  const [paymentNote, setPaymentNote] = useState('')
  const [search, setSearch] = useState('')

  // Auto-recalculate amount when plan or duration changes (unless manually edited)
  const [manualAmount, setManualAmount] = useState(false)
  useEffect(() => {
    if (!manualAmount) setAmount(String(calcPrice(approvedPlan, months)))
  }, [approvedPlan, months, manualAmount])

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['admin-companies-list'],
    queryFn: () => adminApi.get('/api/admin/companies').then(r =>
      (r.data.companies || r.data).map((c: any) => ({ id: c.id, name: c.name }))
    ),
  })

  const approveMut = useMutation({
    mutationFn: () => adminApi.put(`/api/admin/plan-requests/${request.id}/approve`, {
      companyId: companyId || undefined,
      approvedPlan,
      months,
      amount: Number(amount) || 0,
      paymentNote: paymentNote || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plan-requests'] }); qc.invalidateQueries({ queryKey: ['admin-payments-summary'] }); onClose() },
  })

  const filtered = companies.filter((c: Company) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full border border-gray-700 shadow-2xl my-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-lg">Одобрить заявку</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Request summary */}
        <div className="bg-gray-800 rounded-xl p-4 mb-5 space-y-1 text-sm">
          <div className="text-white font-semibold">{request.name}</div>
          <div className="text-gray-400">{request.companyName}</div>
          <div className="flex gap-4 text-gray-400 mt-1">
            <a href={`tel:${request.phone}`} className="flex items-center gap-1 hover:text-white transition-colors">
              <Phone className="w-3.5 h-3.5" />{request.phone}
            </a>
            <a href={`mailto:${request.email}`} className="flex items-center gap-1 hover:text-white transition-colors">
              <Mail className="w-3.5 h-3.5" />{request.email}
            </a>
          </div>
        </div>

        {/* Plan */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1.5">Тариф</label>
          <div className="flex gap-2">
            {(['starter', 'pro'] as const).map(p => (
              <button
                key={p}
                onClick={() => { setApprovedPlan(p); setManualAmount(false) }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  approvedPlan === p ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                {PLAN_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1.5">Период подписки</label>
          <div className="grid grid-cols-4 gap-1.5">
            {DURATION_OPTIONS.map(opt => {
              const price = calcPrice(approvedPlan, opt.months)
              const active = months === opt.months
              const isYearly = opt.months === 12
              return (
                <button
                  key={opt.months}
                  onClick={() => { setMonths(opt.months); setManualAmount(false) }}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-all ${
                    active
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-sm font-bold">{opt.label}</span>
                  <span className={`text-xs mt-0.5 ${active ? 'text-emerald-200' : 'text-gray-600'}`}>
                    ₸{price >= 1_000_000 ? (price / 1_000_000).toFixed(1) + 'М' : (price / 1000).toFixed(0) + 'к'}
                  </span>
                  {isYearly && (
                    <span className={`text-xs mt-0.5 font-semibold ${active ? 'text-emerald-100' : 'text-yellow-600'}`}>
                      выгодно
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1.5">
            Сумма оплаты (₸)
            <span className="text-gray-600 ml-1">— можно изменить вручную</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₸</span>
            <input
              type="number"
              value={amount}
              onChange={e => { setAmount(e.target.value); setManualAmount(true) }}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            {manualAmount && (
              <button
                onClick={() => { setManualAmount(false); setAmount(String(calcPrice(approvedPlan, months))) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
              >
                сбросить
              </button>
            )}
          </div>
          {Number(amount) === 0 && (
            <p className="text-xs text-yellow-600 mt-1">Сумма 0 — платёж не будет записан в историю</p>
          )}
        </div>

        {/* Link to existing company */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1.5">
            Привязать к компании <span className="text-gray-600">(активирует тариф автоматически)</span>
          </label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск компании..."
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-2"
          />
          {search && (
            <div className="bg-gray-800 border border-gray-600 rounded-lg max-h-40 overflow-y-auto">
              {filtered.slice(0, 10).map((c: Company) => (
                <button
                  key={c.id}
                  onClick={() => { setCompanyId(c.id); setSearch(c.name) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${companyId === c.id ? 'text-blue-400' : 'text-gray-300'}`}
                >
                  {c.name}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-3 py-2 text-gray-500 text-sm">Не найдено</div>}
            </div>
          )}
          {companyId && (
            <div className="flex items-center gap-1.5 text-xs text-blue-400 mt-1">
              <Zap className="w-3 h-3" />
              Тариф будет активирован: {companies.find((c: Company) => c.id === companyId)?.name}
              {months > 0 && ` на ${months} мес`}
            </div>
          )}
        </div>

        {/* Payment note */}
        <div className="mb-5">
          <label className="block text-xs text-gray-400 mb-1.5">Способ оплаты / примечание</label>
          <input
            value={paymentNote}
            onChange={e => setPaymentNote(e.target.value)}
            placeholder="Например: Kaspi, перевод, наличные..."
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => approveMut.mutate()}
            disabled={approveMut.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {approveMut.isPending ? 'Сохранение...' : `Одобрить${Number(amount) > 0 ? ` и записать ₸${Number(amount).toLocaleString('ru')}` : ''}`}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-600 text-gray-400 hover:text-white text-sm transition-colors">
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminPlanRequestsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [approving, setApproving] = useState<PlanRequest | null>(null)

  const { data: requests = [], isLoading } = useQuery<PlanRequest[]>({
    queryKey: ['plan-requests', statusFilter],
    queryFn: () => adminApi.get(`/api/admin/plan-requests?status=${statusFilter}`).then(r => r.data),
    refetchInterval: 30_000,
  })

  const rejectMut = useMutation({
    mutationFn: (id: string) => adminApi.put(`/api/admin/plan-requests/${id}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-requests'] }),
  })

  const tabs = [
    { key: 'pending',  label: 'Новые' },
    { key: 'approved', label: 'Одобренные' },
    { key: 'rejected', label: 'Отклонённые' },
    { key: 'all',      label: 'Все' },
  ] as const

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Заявки на тариф</h1>
        <p className="text-gray-400 text-sm">Запросы от клиентов на подключение платного тарифа</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? 'bg-red-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-sm">Загрузка...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-gray-500">Заявок нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-white font-semibold">{req.name}</span>
                    <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${PLAN_COLORS[req.plan] || ''}`}>
                      {PLAN_LABELS[req.plan] || req.plan}
                    </span>
                    <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] || ''}`}>
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{req.companyName}</span>
                    {req.company && (
                      <span className="text-green-400 text-xs">→ {req.company.name}</span>
                    )}
                  </div>

                  <div className="flex gap-4 text-sm">
                    <a href={`tel:${req.phone}`} className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
                      <Phone className="w-3.5 h-3.5" />{req.phone}
                    </a>
                    <a href={`mailto:${req.email}`} className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
                      <Mail className="w-3.5 h-3.5" />{req.email}
                    </a>
                  </div>

                  {req.adminNote && (
                    <p className="text-gray-500 text-xs mt-2 italic">Примечание: {req.adminNote}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-xs text-gray-600">
                    {new Date(req.createdAt).toLocaleString('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setApproving(req)}
                        className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Одобрить
                      </button>
                      <button
                        onClick={() => { if (confirm('Отклонить заявку?')) rejectMut.mutate(req.id) }}
                        className="flex items-center gap-1.5 bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Отклонить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {approving && <ApproveModal request={approving} onClose={() => setApproving(null)} />}
    </div>
  )
}
