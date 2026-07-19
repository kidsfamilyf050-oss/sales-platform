import { useEffect, useState } from 'react'
import { adminApi } from '../../api/adminClient'
import { Link } from 'react-router-dom'
import { Search, Clock, ExternalLink } from 'lucide-react'

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
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-600 py-10">Нет пользователей</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${u.status !== 'ACTIVE' ? 'opacity-40' : ''}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-medium">{u.name}</div>
                        <div className="text-gray-500 text-xs">{u.email}</div>
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
                    <button
                      onClick={() => toggleStatus(u.id, u.status)}
                      className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 px-2.5 py-1 rounded transition-colors"
                    >
                      {u.status === 'ACTIVE' ? 'Заблок.' : 'Вкл.'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
