import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { adminApi } from '../../api/adminClient'
import { ArrowLeft, CheckCircle, XCircle, Clock, User, Shield, Pencil, X, Check, KeyRound, Eye, EyeOff, Wifi, Infinity, CalendarPlus, DollarSign, Trash2 } from 'lucide-react'

interface Payment {
  id: string
  amount: number
  paidAt: string
  periodFrom: string
  periodTo: string
  months: number
  note: string | null
}

const MONTHS_LABEL: Record<number, string> = { 1: '1 месяц', 6: '6 месяцев', 12: '1 год' }
function fmtMoney(n: number) { return `₸${n.toLocaleString('ru')}` }

// Quick access presets
const ACCESS_PRESETS = [
  { label: '1 мес', months: 1 },
  { label: '3 мес', months: 3 },
  { label: '6 мес', months: 6 },
  { label: '1 год', months: 12 },
]

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getSubscriptionStatus(trialEndsAt: string, isActive: boolean): { label: string; color: string } {
  if (!isActive) return { label: 'Заблокирована', color: 'text-red-400' }
  if (!trialEndsAt) return { label: 'Бессрочный доступ', color: 'text-emerald-400' }
  const end = new Date(trialEndsAt)
  const now = new Date()
  if (end < now) {
    const days = Math.floor((now.getTime() - end.getTime()) / 86400000)
    return { label: `Просрочен ${days} дн. назад`, color: 'text-red-400' }
  }
  const days = Math.ceil((end.getTime() - now.getTime()) / 86400000)
  return { label: `Активен · ${days} дн. осталось`, color: days <= 7 ? 'text-amber-400' : 'text-green-400' }
}

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
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState({ notes: '', subscriptionPlan: 'trial', trialEndsAt: '', name: '' })

  // User inline edit
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const [payments, setPayments] = useState<Payment[]>([])
  const [deletingPayment, setDeletingPayment] = useState<string | null>(null)

  const load = () => {
    setLoadError('')
    Promise.all([
      adminApi.get(`/api/admin/companies/${id}`),
      adminApi.get(`/api/admin/companies/${id}/payments`),
    ])
      .then(([companyRes, paymentsRes]) => {
        setCompany(companyRes.data)
        setPayments(paymentsRes.data)
        setFields({
          notes: companyRes.data.notes || '',
          subscriptionPlan: companyRes.data.subscriptionPlan || 'trial',
          trialEndsAt: companyRes.data.trialEndsAt ? companyRes.data.trialEndsAt.slice(0, 10) : '',
          name: companyRes.data.name,
        })
      })
      .catch(e => {
        console.error(e)
        setLoadError(e.response?.data?.error || `Ошибка ${e.response?.status || ''}: ${e.message}`)
      })
      .finally(() => setLoading(false))
  }

  const deletePayment = async (paymentId: string) => {
    if (!window.confirm('Удалить запись об оплате?')) return
    setDeletingPayment(paymentId)
    try {
      await adminApi.delete(`/api/admin/companies/${id}/payments/${paymentId}`)
      setPayments(ps => ps.filter(p => p.id !== paymentId))
    } finally {
      setDeletingPayment(null)
    }
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

  // Extend access: if current date is in future, extend from it; else extend from today
  const grantAccess = async (months: number) => {
    const base = fields.trialEndsAt && new Date(fields.trialEndsAt) > new Date()
      ? new Date(fields.trialEndsAt)
      : new Date()
    const newDate = toDateStr(addMonths(base, months))
    const updated = { ...fields, subscriptionPlan: 'pro', trialEndsAt: newDate }
    setFields(updated)
    setSaving(true)
    await adminApi.patch(`/api/admin/companies/${id}`, { ...updated, trialEndsAt: newDate })
    setSaving(false)
    load()
  }

  const grantUnlimited = async () => {
    const updated = { ...fields, subscriptionPlan: 'pro', trialEndsAt: '' }
    setFields(updated)
    setSaving(true)
    await adminApi.patch(`/api/admin/companies/${id}`, { ...updated, trialEndsAt: null })
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
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      role: u.role,
      managerType: u.managerType || '',
      newPassword: '',
      accessExpiresAt: u.accessExpiresAt ? u.accessExpiresAt.slice(0, 10) : '',
    })
  }

  const saveEditUser = async () => {
    setEditSaving(true)
    setEditError('')
    try {
      const payload: any = {
        name: editForm.name, email: editForm.email,
        role: editForm.role,
        managerType: editForm.role === 'MANAGER' ? (editForm.managerType || 'CLOSER') : '',
        accessExpiresAt: editForm.accessExpiresAt || null,
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

  if (loadError) return (
    <div className="p-8">
      <Link to="/admin/companies" className="text-gray-500 hover:text-white flex items-center gap-2 mb-4">
        <ArrowLeft className="w-4 h-4" /> Назад
      </Link>
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
        ⚠ {loadError}
        <button onClick={load} className="ml-3 underline hover:no-underline">Повторить</button>
      </div>
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
          {/* Subscription status badge */}
          {company && (
            <div className={`text-sm font-semibold ${getSubscriptionStatus(fields.trialEndsAt, company.isActive).color}`}>
              {getSubscriptionStatus(fields.trialEndsAt, company.isActive).label}
            </div>
          )}

          {/* Quick access buttons */}
          <div>
            <label className="block text-xs text-gray-500 mb-2 flex items-center gap-1">
              <CalendarPlus className="w-3 h-3" /> Выдать/продлить доступ
            </label>
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              {ACCESS_PRESETS.map(p => (
                <button
                  key={p.months}
                  onClick={() => grantAccess(p.months)}
                  disabled={saving}
                  className="bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/50 text-blue-300 text-xs py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40"
                >
                  + {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={grantUnlimited}
              disabled={saving}
              className="w-full bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-700/50 text-emerald-300 text-xs py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
            >
              <Infinity className="w-3 h-3" /> Бессрочно
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Доступ до (вручную)</label>
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
            <div className="flex justify-between"><span>Планов</span><span className="text-gray-300">{company._count.plans}</span></div>
            <div className="flex justify-between"><span>Лидов</span><span className="text-gray-300">{company._count.leads}</span></div>
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
                    {u.accessExpiresAt && (() => {
                      const exp = new Date(u.accessExpiresAt)
                      const now = new Date()
                      const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000)
                      if (daysLeft < 0) return (
                        <div className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                          ⛔ Инд. доступ истёк {Math.abs(daysLeft)} дн. назад
                        </div>
                      )
                      if (daysLeft <= 7) return (
                        <div className="text-xs text-amber-400 flex items-center gap-1 mt-0.5">
                          ⚠ Инд. доступ истекает через {daysLeft} дн.
                        </div>
                      )
                      return (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          Инд. доступ до {exp.toLocaleDateString('ru')}
                        </div>
                      )
                    })()}
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
                      <div>
                        <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Доступ до (инд.)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                            value={editForm.accessExpiresAt}
                            onChange={e => setEditForm((f: any) => ({ ...f, accessExpiresAt: e.target.value }))}
                          />
                          {editForm.accessExpiresAt && (
                            <button
                              type="button"
                              onClick={() => setEditForm((f: any) => ({ ...f, accessExpiresAt: '' }))}
                              className="text-gray-500 hover:text-red-400 transition-colors"
                              title="Снять ограничение"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">Пусто = срок компании</p>
                      </div>
                      <div>
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

      {/* ── История платежей ──────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            История платежей
          </h2>
          {payments.length > 0 && (
            <span className="text-xs text-gray-500">
              Итого: {fmtMoney(payments.reduce((s, p) => s + p.amount, 0))}
            </span>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-600 text-sm">Платежей ещё нет</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800/50">
                <th className="text-left px-5 py-3 font-medium">Дата оплаты</th>
                <th className="text-left px-4 py-3 font-medium">Период</th>
                <th className="text-left px-4 py-3 font-medium">Оплачено до</th>
                <th className="text-left px-4 py-3 font-medium">Сумма</th>
                <th className="text-left px-4 py-3 font-medium">Заметка</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => {
                const isActive = new Date(p.periodTo) >= new Date()
                return (
                  <tr key={p.id} className={`border-b border-gray-800/30 last:border-0 ${isActive ? 'bg-emerald-950/10' : ''}`}>
                    <td className="px-5 py-3.5 text-gray-300">
                      {new Date(p.paidAt).toLocaleDateString('ru')}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                        {MONTHS_LABEL[p.months] || `${p.months} мес`}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {new Date(p.periodFrom).toLocaleDateString('ru')} → {new Date(p.periodTo).toLocaleDateString('ru')}
                        </span>
                        {isActive && (
                          <span className="text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-800 px-1.5 py-0.5 rounded-full">
                            активен
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-emerald-400">
                      {fmtMoney(p.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">
                      {p.note || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => deletePayment(p.id)}
                        disabled={deletingPayment === p.id}
                        className="text-gray-700 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Удалить запись"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
