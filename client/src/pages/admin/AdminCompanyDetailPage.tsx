import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { adminApi } from '../../api/adminClient'
import { ArrowLeft, CheckCircle, XCircle, Clock, User, Shield } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Собственник', ROP: 'РОП', MANAGER: 'Менеджер', MARKETER: 'Маркетолог',
}
const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-900/40 text-purple-300',
  ROP: 'bg-blue-900/40 text-blue-300',
  MANAGER: 'bg-green-900/40 text-green-300',
  MARKETER: 'bg-orange-900/40 text-orange-300',
}
const PLAN_LABELS: Record<string, string> = { trial: 'Триал', starter: 'Стартер', pro: 'Pro' }

export default function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState({ notes: '', subscriptionPlan: 'trial', trialEndsAt: '', name: '' })

  const load = () => {
    adminApi.get(`/api/admin/companies/${id}`)
      .then(r => {
        setCompany(r.data)
        setFields({
          notes: r.data.notes || '',
          subscriptionPlan: r.data.subscriptionPlan || 'trial',
          trialEndsAt: r.data.trialEndsAt ? r.data.trialEndsAt.slice(0, 10) : '',
          name: r.data.name,
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const save = async () => {
    setSaving(true)
    await adminApi.patch(`/api/admin/companies/${id}`, {
      ...fields,
      trialEndsAt: fields.trialEndsAt || null,
    })
    setSaving(false)
    load()
  }

  const toggleActive = async () => {
    await adminApi.patch(`/api/admin/companies/${id}`, { isActive: !company.isActive })
    load()
  }

  const toggleUserStatus = async (userId: string, current: string) => {
    await adminApi.patch(`/api/admin/users/${userId}`, { status: current === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' })
    load()
  }

  if (loading) return (
    <div className="p-8 text-gray-500 flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" />
      Загрузка...
    </div>
  )

  if (!company) return <div className="p-8 text-red-400">Компания не найдена</div>

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/companies" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{company.name}</h1>
          <p className="text-gray-500 text-sm">ID: {company.id}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${company.isActive ? 'text-green-400' : 'text-red-400'}`}>
            {company.isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {company.isActive ? 'Активна' : 'Заблокирована'}
          </span>
          <button
            onClick={toggleActive}
            className={`text-sm px-4 py-1.5 rounded-lg border transition-colors ${
              company.isActive
                ? 'border-red-800 text-red-400 hover:bg-red-900/30'
                : 'border-green-800 text-green-400 hover:bg-green-900/30'
            }`}
          >
            {company.isActive ? 'Заблокировать' : 'Активировать'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Settings */}
        <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            Настройки
          </h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Название</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              value={fields.name}
              onChange={e => setFields(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Тариф</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              value={fields.subscriptionPlan}
              onChange={e => setFields(f => ({ ...f, subscriptionPlan: e.target.value }))}
            >
              <option value="trial">Триал</option>
              <option value="starter">Стартер</option>
              <option value="pro">Pro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Доступ до</label>
            <input
              type="date"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              value={fields.trialEndsAt}
              onChange={e => setFields(f => ({ ...f, trialEndsAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Заметки</label>
            <textarea
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              value={fields.notes}
              onChange={e => setFields(f => ({ ...f, notes: e.target.value }))}
              placeholder="Внутренние заметки об этой компании..."
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохраняем...' : 'Сохранить изменения'}
          </button>

          {/* Stats */}
          <div className="pt-2 border-t border-gray-800 space-y-1 text-sm text-gray-500">
            <div className="flex justify-between"><span>Отчётов</span><span className="text-gray-300">{company._count.reports}</span></div>
            <div className="flex justify-between"><span>Планов</span><span className="text-gray-300">{company._count.plans}</span></div>
            <div className="flex justify-between"><span>Создана</span><span className="text-gray-300">{new Date(company.createdAt).toLocaleDateString('ru')}</span></div>
          </div>
        </div>

        {/* Users */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-red-500" />
            Пользователи ({company.users.length})
          </h2>
          <div className="space-y-3">
            {company.users.map((u: any) => (
              <div key={u.id} className={`flex items-center gap-3 p-3 rounded-lg border ${u.status === 'ACTIVE' ? 'border-gray-800 bg-gray-800/40' : 'border-gray-800 bg-gray-800/20 opacity-50'}`}>
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-medium">{u.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}{u.managerType ? ` (${u.managerType})` : ''}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                  {u.lastLoginAt && (
                    <div className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      Посл. вход: {new Date(u.lastLoginAt).toLocaleString('ru')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleUserStatus(u.id, u.status)}
                  className={`text-xs px-2.5 py-1 rounded border flex-shrink-0 transition-colors ${
                    u.status === 'ACTIVE'
                      ? 'border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400'
                      : 'border-green-800 text-green-400 hover:bg-green-900/20'
                  }`}
                >
                  {u.status === 'ACTIVE' ? 'Заблок.' : 'Активировать'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
