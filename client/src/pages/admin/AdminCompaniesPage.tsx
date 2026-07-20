import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/adminClient'
import { Building2, Users, CheckCircle, XCircle, Plus, ChevronRight, Package, X } from 'lucide-react'

interface Company {
  id: string
  name: string
  isActive: boolean
  subscriptionPlan: string | null
  trialEndsAt: string | null
  createdAt: string
  notes: string | null
  _count: { users: number }
  users: { name: string; email: string; lastLoginAt: string | null }[]
}

const PLAN_LABELS: Record<string, string> = { trial: 'Триал', starter: 'Стартер', pro: 'Pro' }
const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  starter: 'bg-blue-900/40 text-blue-300 border-blue-800',
  pro: 'bg-green-900/40 text-green-300 border-green-800',
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Create company modal
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

  const load = () => {
    setLoading(true)
    setLoadError('')
    adminApi.get('/api/admin/companies')
      .then(r => setCompanies(r.data))
      .catch(e => setLoadError(e.response?.data?.error || `Ошибка загрузки (${e.message})`))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

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

  const openGrant = (c: Company) => {
    setGrantTarget(c)
    // Default end date: 1 year from now
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    setGrantForm({ subscriptionPlan: 'starter', trialEndsAt: d.toISOString().slice(0, 10) })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Компании</h1>
          <p className="text-gray-500 text-sm mt-1">Управление доступом и подписками</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать компанию
        </button>
      </div>

      {/* Create company modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-white mb-5">Новая компания</h2>
            <form onSubmit={createCompany} className="space-y-4">
              {[
                { label: 'Название компании', key: 'companyName', type: 'text' },
                { label: 'Имя владельца', key: 'ownerName', type: 'text' },
                { label: 'Email владельца', key: 'ownerEmail', type: 'email' },
                { label: 'Пароль владельца', key: 'ownerPassword', type: 'password' },
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

      {/* Grant package modal */}
      {grantTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-green-400" />
                Выдать пакет
              </h2>
              <button onClick={() => setGrantTarget(null)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
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
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
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

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" />
          Загрузка...
        </div>
      ) : loadError ? (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          ⚠ {loadError}
          <button onClick={load} className="ml-3 underline hover:no-underline">Повторить</button>
        </div>
      ) : (
        <div className="space-y-3">
          {companies.length === 0 && (
            <div className="text-center py-16 text-gray-600">Нет зарегистрированных компаний</div>
          )}
          {companies.map(c => (
            <div key={c.id} className={`bg-gray-900 border rounded-xl p-5 flex items-center gap-4 ${c.isActive ? 'border-gray-800' : 'border-red-900/50 opacity-60'}`}>
              <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-white font-semibold">{c.name}</span>
                  {c.subscriptionPlan && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${PLAN_COLORS[c.subscriptionPlan] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                      {PLAN_LABELS[c.subscriptionPlan] || c.subscriptionPlan}
                    </span>
                  )}
                  {c.trialEndsAt && (
                    <span className="text-xs text-gray-500">
                      до {new Date(c.trialEndsAt).toLocaleDateString('ru')}
                    </span>
                  )}
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
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openGrant(c)}
                  title="Выдать пакет"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-800 text-green-400 hover:bg-green-900/30 transition-colors"
                >
                  <Package className="w-3 h-3" /> Пакет
                </button>
                <button
                  onClick={() => toggleActive(c.id, c.isActive)}
                  title={c.isActive ? 'Заблокировать' : 'Активировать'}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    c.isActive
                      ? 'border-green-800 text-green-400 hover:bg-red-900/30 hover:border-red-700 hover:text-red-400'
                      : 'border-red-800 text-red-400 hover:bg-green-900/30 hover:border-green-700 hover:text-green-400'
                  }`}
                >
                  {c.isActive ? <><CheckCircle className="w-3 h-3" /> Активна</> : <><XCircle className="w-3 h-3" /> Заблок.</>}
                </button>
                <Link
                  to={`/admin/companies/${c.id}`}
                  className="flex items-center gap-1 text-gray-500 hover:text-white transition-colors text-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
