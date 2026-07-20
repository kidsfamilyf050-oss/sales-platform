import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { adminApi } from '../../api/adminClient'
import { ArrowLeft, CheckCircle, XCircle, Clock, User, Shield, Pencil, X, Check, KeyRound, Eye, EyeOff, Wifi } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Собственник', ROP: 'РОП', MANAGER: 'Менеджер', MARKETER: 'Маркетолог',
}
const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-900/40 text-purple-300',
  ROP: 'bg-blue-900/40 text-blue-300',
  MANAGER: 'bg-green-900/40 text-green-300',
  MARKETER: 'bg-orange-900/40 text-orange-300',
}

const ONLINE_MS = 15 * 60 * 1000
const isOnline = (lastSeenAt: string | null) => !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < ONLINE_MS

export default function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState({ notes: '', subscriptionPlan: 'trial', trialEndsAt: '', name: '' })

  // User inline edit
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [showPwd, setShowPwd] = useState(false)

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

  const startEditUser = (u: any) => {
    setEditUserId(u.id)
    setEditError('')
    setShowPwd(false)
    setEditForm({ name: u.name || '', email: u.email || '', role: u.role, managerType: u.managerType || '', newPassword: '' })
  }

  const saveEditUser = async () => {
    setEditSaving(true)
    setEditError('')
    try {
      const payload: any = {
        name: editForm.name, email: editForm.email,
        role: editForm.role,
        managerType: editForm.role === 'MANAGER' ? (editForm.managerType || 'CLOSER') : '',
      }
      if (editForm.newPassword) payload.newPassword = editForm.newPassword
      await adminApi.patch(`/api/admin/users/${editUserId}`, payload)
      setEditUserId(null)
      load()
    } catch (e: any) {
      setEditError(e.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setEditSaving(false)
    }
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
            onClick={save} disabled={saving}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохраняем...' : 'Сохранить изменения'}
          </button>

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
            Сотрудники ({company.users.length})
          </h2>
          <div className="space-y-2">
            {company.users.map((u: any) => (
              <div key={u.id}>
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  editUserId === u.id ? 'border-blue-700 bg-blue-900/10' :
                  u.status === 'ACTIVE' ? 'border-gray-800 bg-gray-800/40' : 'border-gray-800 bg-gray-800/20 opacity-50'
                }`}>
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    {isOnline(u.lastSeenAt) && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 border-2 border-gray-900 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">{u.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}{u.managerType ? ` · ${u.managerType}` : ''}
                      </span>
                      {isOnline(u.lastSeenAt) && (
                        <span className="text-xs text-green-400 flex items-center gap-0.5">
                          <Wifi className="w-3 h-3" /> В сети
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                    {!isOnline(u.lastSeenAt) && (u.lastSeenAt || u.lastLoginAt) && (
                      <div className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(u.lastSeenAt || u.lastLoginAt).toLocaleString('ru')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => editUserId === u.id ? setEditUserId(null) : startEditUser(u)}
                      className={`p-1.5 rounded transition-colors ${editUserId === u.id ? 'text-blue-400 bg-blue-900/30' : 'text-gray-500 hover:text-white hover:bg-gray-700'}`}
                      title="Редактировать"
                    >
                      {editUserId === u.id ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                    </button>
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
                </div>

                {/* Inline edit form */}
                {editUserId === u.id && (
                  <div className="mx-1 mb-2 p-4 bg-gray-800/60 border border-blue-800/40 rounded-b-lg">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">ФИО</label>
                        <input
                          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                          value={editForm.name}
                          onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Email</label>
                        <input
                          type="email"
                          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                          value={editForm.email}
                          onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Роль</label>
                        <select
                          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none"
                          value={editForm.role}
                          onChange={e => setEditForm((f: any) => ({ ...f, role: e.target.value }))}
                        >
                          <option value="OWNER">Собственник</option>
                          <option value="ROP">РОП</option>
                          <option value="MANAGER">Менеджер</option>
                          <option value="MARKETER">Маркетолог</option>
                        </select>
                      </div>
                      {editForm.role === 'MANAGER' && (
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Тип</label>
                          <select
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none"
                            value={editForm.managerType}
                            onChange={e => setEditForm((f: any) => ({ ...f, managerType: e.target.value }))}
                          >
                            <option value="CLOSER">Клоузер</option>
                            <option value="LIDER">Лидоруб</option>
                          </select>
                        </div>
                      )}
                      <div className={editForm.role === 'MANAGER' ? '' : 'col-span-2'}>
                        <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <KeyRound className="w-3 h-3" /> Новый пароль
                        </label>
                        <div className="relative">
                          <input
                            type={showPwd ? 'text' : 'password'}
                            placeholder="оставить пустым"
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 pr-8 text-sm focus:outline-none focus:border-blue-500"
                            value={editForm.newPassword}
                            onChange={e => setEditForm((f: any) => ({ ...f, newPassword: e.target.value }))}
                          />
                          <button type="button" onClick={() => setShowPwd(s => !s)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                          >
                            {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {editError && <p className="text-red-400 text-xs mb-3">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={saveEditUser}
                        disabled={editSaving || !editForm.name || !editForm.email}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-40 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {editSaving ? 'Сохраняем...' : 'Сохранить'}
                      </button>
                      <button
                        onClick={() => setEditUserId(null)}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
