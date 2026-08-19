import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/adminClient'
import {
  Building2, Users, CheckCircle, XCircle, Plus, ChevronRight,
  Package, X, AlertTriangle, DollarSign, Clock,
} from 'lucide-react'

interface Company {
  id: string
  name: string
  isActive: boolean
  subscriptionPlan: string | null
  trialEndsAt: string | null
  createdAt: string
  notes: string | null
  paidAt: string | null
  paidAmount: number | null
  paymentNote: string | null
  _count: { users: number }
  users: { name: string; email: string; lastLoginAt: string | null }[]
}

const PLAN_LABELS: Record<string, string> = { trial: 'Триал', starter: 'Стартер', pro: 'Pro' }
const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  starter: 'bg-blue-900/40 text-blue-300 border-blue-800',
  pro: 'bg-green-900/40 text-green-300 border-green-800',
}

function daysLeft(dateStr: string | null) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function ExpiryBadge({ trialEndsAt }: { trialEndsAt: string | null }) {
  const days = daysLeft(trialEndsAt)
  if (days === null) return null
  if (days < 0) return (
    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/20 border border-red-800 px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> Истёк
    </span>
  )
  if (days <= 3) return (
    <span className="flex items-center gap-1 text-xs text-red-300 bg-red-900/30 border border-red-700 px-2 py-0.5 rounded-full">
      <AlertTriangle className="w-3 h-3" /> {days} дн.
    </span>
  )
  if (days <= 7) return (
    <span className="flex items-center gap-1 text-xs text-amber-300 bg-amber-900/20 border border-amber-700 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" /> {days} дн.
    </span>
  )
  if (days <= 30) return (
    <span className="text-xs text-gray-400">{new Date(trialEndsAt!).toLocaleDateString('ru')}</span>
  )
  return <span className="text-xs text-gray-500">до {new Date(trialEndsAt!).toLocaleDateString('ru')}</span>
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | 'expiring' | 'unpaid' | 'expired'>('all')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    companyName: '', ownerName: '', ownerEmail: '', ownerPassword: '',
    subscriptionPlan: 'trial', trialEndsAt: '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Grant package modal
  const [grantTarget, setGrantTarget] = useState<Company | null>(null)
  const [grantForm, setGrantForm] = useState({ subscriptionPlan: 'starter', trialEndsAt: '' })
  const [granting, setGranting] = useState(false)

  // Pay modal
  const [payTarget, setPayTarget] = useState<Company | null>(null)
  const [payForm, setPayForm] = useState({ paidAt: '', paidAmount: '', paymentNote: '', months: 1 })
  const [paying, setPaying] = useState(false)

  const PERIOD_PRICES: Record<string, Record<number, number>> = {
    starter: { 1: 59900, 6: 299900, 12: 499900 },
    pro:     { 1: 99900, 6: 499900, 12: 799900 },
    trial:   { 1: 0, 6: 0, 12: 0 },
  }

  const calcPeriodTo = (from: string, months: number) => {
    if (!from) return ''
    const d = new Date(from)
    d.setMonth(d.getMonth() + months)
    return d.toLocaleDateString('ru')
  }

  const load = () => {
    setLoading(true)
    setLoadError('')
    adminApi.get('/api/admin/companies')
      .then(r => setCompanies(r.data))
      .catch(e => setLoadError(e.response?.data?.error || `Ошибка загрузки (${e.message})`))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const filtered = companies.filter(c => {
    if (filter === 'expiring') {
      if (!c.trialEndsAt) return false
      const d = new Date(c.trialEndsAt)
      return d >= now && d <= in30 && c.isActive
    }
    if (filter === 'unpaid') return !c.paidAt && c.isActive
    if (filter === 'expired') {
      return c.trialEndsAt ? new Date(c.trialEndsAt) < now && c.isActive : false
    }
    return true
  })

  const counts = {
    expiring: companies.filter(c => {
      if (!c.trialEndsAt || !c.isActive) return false
      const d = new Date(c.trialEndsAt)
      return d >= now && d <= in30
    }).length,
    unpaid: companies.filter(c => !c.paidAt && c.isActive).length,
    expired: companies.filter(c => c.trialEndsAt && new Date(c.trialEndsAt) < now && c.isActive).length,
  }

  const toggleActive = async (id: string, current: boolean) => {
    await adminApi.patch(`/api/admin/companies/${id}`, { isActive: !current })
    setCompanies(cs => cs.map(c => c.id === id ? { ...c, isActive: !current } : c))
  }

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      await adminApi.post('/api/admin/companies', form)
      setShowCreate(false)
      setForm({ companyName: '', ownerName: '', ownerEmail: '', ownerPassword: '', subscriptionPlan: 'trial', trialEndsAt: '' })
      load()
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Ошибка создания')
    } finally {
      setCreating(false)
    }
  }

  const grantPackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!grantTarget) return
    setGranting(true)
    try {
      await adminApi.patch(`/api/admin/companies/${grantTarget.id}`, {
        subscriptionPlan: grantForm.subscriptionPlan,
        trialEndsAt: grantForm.trialEndsAt || null,
        isActive: true,
      })
      setGrantTarget(null)
      load()
    } finally {
      setGranting(false)
    }
  }

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payTarget) return
    setPaying(true)
    try {
      await adminApi.patch(`/api/admin/companies/${payTarget.id}`, {
        paidAt: payForm.paidAt,
        paidAmount: payForm.paidAmount ? Number(payForm.paidAmount) : null,
        paymentNote: payForm.paymentNote || null,
        months: payForm.months,
      })
      setPayTarget(null)
      load()
    } finally {
      setPaying(false)
    }
  }

  const openGrant = (c: Company) => {
    setGrantTarget(c)
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    setGrantForm({ subscriptionPlan: 'starter', trialEndsAt: d.toISOString().slice(0, 10) })
  }

  const openPay = (c: Company) => {
    setPayTarget(c)
    const plan = c.subscriptionPlan || 'starter'
    const defaultPrice = PERIOD_PRICES[plan]?.[1] || 59900
    setPayForm({
      paidAt: new Date().toISOString().slice(0, 10),
      paidAmount: String(defaultPrice),
      paymentNote: '',
      months: 1,
    })
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Компании</h1>
          <p className="text-gray-500 text-sm mt-1">Управление доступом, подписками и оплатой</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Создать компанию
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([
          { key: 'all',      label: 'Все',                count: companies.length },
          { key: 'expiring', label: 'Истекают (30 дн.)',  count: counts.expiring,  warn: true },
          { key: 'unpaid',   label: 'Не оплачено',        count: counts.unpaid,    warn: counts.unpaid > 0 },
          { key: 'expired',  label: 'Просрочены',         count: counts.expired,   danger: true },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              filter === f.key
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600'
            }`}
          >
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              filter === f.key ? 'bg-gray-600 text-white'
              : (f as any).danger && f.count > 0 ? 'bg-red-900/60 text-red-300'
              : (f as any).warn && f.count > 0 ? 'bg-amber-900/60 text-amber-300'
              : 'bg-gray-800 text-gray-500'
            }`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-white mb-5">Новая компания</h2>
            <form onSubmit={createCompany} className="space-y-4">
              {[
                { label: 'Название компании', key: 'companyName', type: 'text' },
                { label: 'Имя владельца',     key: 'ownerName',   type: 'text' },
                { label: 'Email владельца',   key: 'ownerEmail',  type: 'email' },
                { label: 'Пароль владельца',  key: 'ownerPassword', type: 'password' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm text-gray-400 mb-1">{f.label}</label>
                  <input
                    type={f.type} required
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                    value={(form as any)[f.key]}
                    onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Тариф</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={form.subscriptionPlan}
                    onChange={e => setForm(x => ({ ...x, subscriptionPlan: e.target.value }))}
                  >
                    <option value="trial">Триал</option>
                    <option value="starter">Стартер</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Дата окончания</label>
                  <input
                    type="date"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={form.trialEndsAt}
                    onChange={e => setForm(x => ({ ...x, trialEndsAt: e.target.value }))}
                  />
                </div>
              </div>
              {createError && <p className="text-red-400 text-sm">{createError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={creating} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {creating ? 'Создаём...' : 'Создать'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grant Package Modal */}
      {grantTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-green-400" /> Выдать пакет
              </h2>
              <button onClick={() => setGrantTarget(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">Компания: <span className="text-white font-medium">{grantTarget.name}</span></p>
            <form onSubmit={grantPackage} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Пакет</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={grantForm.subscriptionPlan}
                  onChange={e => setGrantForm(f => ({ ...f, subscriptionPlan: e.target.value }))}
                >
                  <option value="starter">Стартер</option>
                  <option value="pro">Pro</option>
                  <option value="trial">Триал (продлить)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Доступ до</label>
                <input
                  type="date" required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={grantForm.trialEndsAt}
                  onChange={e => setGrantForm(f => ({ ...f, trialEndsAt: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={granting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {granting ? 'Сохраняем...' : '✓ Выдать доступ'}
                </button>
                <button type="button" onClick={() => setGrantTarget(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" /> Зафиксировать оплату
              </h2>
              <button onClick={() => setPayTarget(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-gray-400 text-sm mb-1">Компания: <span className="text-white font-medium">{payTarget.name}</span></p>
            {payTarget.trialEndsAt && (
              <p className="text-xs text-gray-500 mb-4">
                Текущий период до: <span className="text-amber-400">{new Date(payTarget.trialEndsAt).toLocaleDateString('ru')}</span>
                {' '}— новый период продолжится с этой даты
              </p>
            )}
            <form onSubmit={recordPayment} className="space-y-4">
              {/* Период */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Период оплаты</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { months: 1,  label: '1 месяц' },
                    { months: 6,  label: '6 месяцев' },
                    { months: 12, label: '1 год' },
                  ] as const).map(opt => {
                    const plan = payTarget.subscriptionPlan || 'starter'
                    const price = PERIOD_PRICES[plan]?.[opt.months]
                    return (
                      <button
                        key={opt.months}
                        type="button"
                        onClick={() => {
                          const p = PERIOD_PRICES[plan]?.[opt.months]
                          setPayForm(f => ({
                            ...f,
                            months: opt.months,
                            paidAmount: p ? String(p) : f.paidAmount,
                          }))
                        }}
                        className={`p-3 rounded-xl border text-sm font-medium transition-colors text-center ${
                          payForm.months === opt.months
                            ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <div>{opt.label}</div>
                        {price ? <div className="text-xs mt-0.5 opacity-70">₸{price.toLocaleString('ru')}</div> : null}
                      </button>
                    )
                  })}
                </div>
                {/* Итоговый период */}
                {payForm.paidAt && (
                  <div className="mt-2 text-xs text-gray-500 bg-gray-800 rounded-lg px-3 py-2">
                    Период: <span className="text-white">
                      {payTarget.trialEndsAt && new Date(payTarget.trialEndsAt) > new Date()
                        ? new Date(payTarget.trialEndsAt).toLocaleDateString('ru')
                        : new Date(payForm.paidAt).toLocaleDateString('ru')
                      }
                    </span>
                    {' '}→ <span className="text-emerald-400 font-medium">
                      {calcPeriodTo(
                        payTarget.trialEndsAt && new Date(payTarget.trialEndsAt) > new Date()
                          ? payTarget.trialEndsAt.slice(0, 10)
                          : payForm.paidAt,
                        payForm.months
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Дата оплаты</label>
                  <input
                    type="date" required
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    value={payForm.paidAt}
                    onChange={e => setPayForm(f => ({ ...f, paidAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Сумма (₸)</label>
                  <input
                    type="number" placeholder="59900"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    value={payForm.paidAmount}
                    onChange={e => setPayForm(f => ({ ...f, paidAmount: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Заметка (необязательно)</label>
                <input
                  type="text" placeholder="Kaspi перевод, счёт №123..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  value={payForm.paymentNote}
                  onChange={e => setPayForm(f => ({ ...f, paymentNote: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={paying}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {paying ? 'Сохраняем...' : '✓ Сохранить и продлить доступ'}
                </button>
                <button type="button" onClick={() => setPayTarget(null)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 rounded-lg text-sm">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-gray-500 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" /> Загрузка...
        </div>
      ) : loadError ? (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          ⚠ {loadError}
          <button onClick={load} className="ml-3 underline hover:no-underline">Повторить</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-600">Нет компаний в этом фильтре</div>
          )}
          {filtered.map(c => {
            const days = daysLeft(c.trialEndsAt)
            const isExpiredSoon = days !== null && days <= 7 && days >= 0
            const isExpired = days !== null && days < 0
            const isPaid = !!c.paidAt

            return (
              <div key={c.id} className={`bg-gray-900 border rounded-xl p-5 flex items-center gap-4 transition-colors ${
                !c.isActive ? 'border-gray-800 opacity-50'
                : isExpired ? 'border-red-900/60 bg-red-950/10'
                : isExpiredSoon ? 'border-amber-900/60'
                : 'border-gray-800'
              }`}>
                <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold">{c.name}</span>
                    {c.subscriptionPlan && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${PLAN_COLORS[c.subscriptionPlan] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {PLAN_LABELS[c.subscriptionPlan] || c.subscriptionPlan}
                      </span>
                    )}
                    <ExpiryBadge trialEndsAt={c.trialEndsAt} />
                    {/* Статус оплаты */}
                    {isPaid ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Оплачено {c.paidAmount ? `₸${c.paidAmount.toLocaleString('ru')}` : ''}
                      </span>
                    ) : c.isActive ? (
                      <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-900/10 border border-amber-900 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Не оплачено
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    {c.users[0] && <span>{c.users[0].name} · {c.users[0].email}</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c._count.users} польз.</span>
                    <span>Создана {new Date(c.createdAt).toLocaleDateString('ru')}</span>
                    {c.users[0]?.lastLoginAt && (
                      <span>Посл. вход {new Date(c.users[0].lastLoginAt).toLocaleDateString('ru')}</span>
                    )}
                    {c.paymentNote && <span className="text-gray-600 italic">{c.paymentNote}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openPay(c)}
                    title="Зафиксировать оплату"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-800 text-emerald-400 hover:bg-emerald-900/30 transition-colors"
                  >
                    <DollarSign className="w-3 h-3" /> Оплата
                  </button>
                  <button
                    onClick={() => openGrant(c)}
                    title="Выдать пакет"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-800 text-blue-400 hover:bg-blue-900/30 transition-colors"
                  >
                    <Package className="w-3 h-3" /> Пакет
                  </button>
                  <button
                    onClick={() => toggleActive(c.id, c.isActive)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      c.isActive
                        ? 'border-green-800 text-green-400 hover:bg-red-900/30 hover:border-red-700 hover:text-red-400'
                        : 'border-red-800 text-red-400 hover:bg-green-900/30 hover:border-green-700 hover:text-green-400'
                    }`}
                  >
                    {c.isActive ? <><CheckCircle className="w-3 h-3" /> Активна</> : <><XCircle className="w-3 h-3" /> Заблок.</>}
                  </button>
                  <Link to={`/admin/companies/${c.id}`} className="flex items-center gap-1 text-gray-500 hover:text-white transition-colors text-sm">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
