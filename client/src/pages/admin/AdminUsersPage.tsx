import { useEffect, useState } from 'react'
import { adminApi } from '../../api/adminClient'
import { Link } from 'react-router-dom'
import { Search, Clock, ExternalLink, Pencil, X, Check, KeyRound, Eye, EyeOff } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Собственник', ROP: 'РОП', MANAGER: 'Менеджер', MARKETER: 'Маркетолог',
}
const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-900/40 text-purple-300',
  ROP: 'bg-blue-900/40 text-blue-300',
  MANAGER: 'bg-green-900/40 text-green-300',
  MARKETER: 'bg-orange-900/40 text-orange-300',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const load = (q = '') => {
    setLoading(true)
    adminApi.get(`/api/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`)
      .then(r => setUsers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggleStatus = async (id: string, current: string) => {
    await adminApi.patch(`/api/admin/users/${id}`, { status: current === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' })
    setUsers(us => us.map(u => u.id === id ? { ...u, status: current === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' } : u))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search)
  }

  const startEdit = (u: any) => {
    setEditingId(u.id)
    setEditError('')
    setShowPwd(false)
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role,
      managerType: u.managerType || '',
      newPassword: '',
    })
  }

  const saveEdit = async () => {
    setEditSaving(true)
    setEditError('')
    try {
      const payload: any = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
        managerType: editForm.role === 'MANAGER' ? (editForm.managerType || 'CLOSER') : '',
      }
      if (editForm.newPassword) payload.newPassword = editForm.newPassword
      const { data } = await adminApi.patch(`/api/admin/users/${editingId}`, payload)
      setUsers(us => us.map(u => u.id === editingId ? { ...u, ...data } : u))
      setSavedId(editingId)
      setTimeout(() => { setSavedId(null); setEditingId(null) }, 1500)
    } catch (e: any) {
      setEditError(e.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Пользователи</h1>
        <p className="text-gray-500 text-sm mt-1">Все пользователи платформы</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-red-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
          Найти
        </button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); load() }} className="text-gray-500 hover:text-white text-sm px-2">
            Сбросить
          </button>
        )}
      </form>

      {loading ? (
        <div className="text-gray-500 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" />
          Загрузка...
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="text-left py-3 px-4">Пользователь</th>
                <th className="text-left py-3 px-4">Роль</th>
                <th className="text-left py-3 px-4">Компания</th>
                <th className="text-left py-3 px-4">Посл. вход</th>
                <th className="text-left py-3 px-4">Статус</th>
                <th className="py-3 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-600 py-10">Нет пользователей</td></tr>
              )}
              {users.map(u => (
                <>
                  <tr key={u.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${u.status !== 'ACTIVE' ? 'opacity-40' : ''} ${editingId === u.id ? 'bg-gray-800/50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white font-medium">{u.name}</div>
                          <div className="text-gray-500 text-xs">{u.email}</div>
                          {u.phone && <div className="text-gray-600 text-xs">{u.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${ROLE_COLORS[u.role] || 'bg-gray-800 text-gray-400'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                        {u.managerType ? ` · ${u.managerType}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.company ? (
                        <Link to={`/admin/companies/${u.company.id}`} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs">
                          {u.company.name}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {u.lastLoginAt ? (
                        <span className="text-gray-500 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(u.lastLoginAt).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : <span className="text-gray-700 text-xs">Не входил</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs ${u.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}`}>
                        {u.status === 'ACTIVE' ? 'Активен' : 'Заблокирован'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => editingId === u.id ? setEditingId(null) : startEdit(u)}
                          className={`p-1.5 rounded transition-colors ${editingId === u.id ? 'text-blue-400 bg-blue-900/30' : 'text-gray-500 hover:text-white hover:bg-gray-700'}`}
                          title="Редактировать"
                        >
                          {editingId === u.id ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => toggleStatus(u.id, u.status)}
                          className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 px-2.5 py-1 rounded transition-colors"
                        >
                          {u.status === 'ACTIVE' ? 'Заблок.' : 'Вкл.'}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit row */}
                  {editingId === u.id && (
                    <tr key={`edit-${u.id}`} className="border-b border-gray-700 bg-gray-800/60">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">ФИО</label>
                            <input
                              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-red-500"
                              value={editForm.name}
                              onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">Email</label>
                            <input
                              type="email"
                              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-red-500"
                              value={editForm.email}
                              onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">Телефон</label>
                            <input
                              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-red-500"
                              value={editForm.phone}
                              onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))}
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
                              <KeyRound className="w-3 h-3" /> Новый пароль
                            </label>
                            <div className="relative">
                              <input
                                type={showPwd ? 'text' : 'password'}
                                placeholder="оставить пустым"
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2.5 py-1.5 pr-8 text-sm focus:outline-none focus:border-red-500"
                                value={editForm.newPassword}
                                onChange={e => setEditForm((f: any) => ({ ...f, newPassword: e.target.value }))}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPwd(s => !s)}
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
                            onClick={saveEdit}
                            disabled={editSaving || !editForm.name || !editForm.email}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg disabled:opacity-40 transition-colors"
                          >
                            {savedId === u.id
                              ? <><Check className="w-3.5 h-3.5" /> Сохранено</>
                              : editSaving
                                ? 'Сохраняем...'
                                : <><Check className="w-3.5 h-3.5" /> Сохранить</>
                            }
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" /> Отмена
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
