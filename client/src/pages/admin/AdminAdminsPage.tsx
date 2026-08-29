import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../api/adminClient'
import { ShieldCheck, Trash2, Plus, AlertTriangle } from 'lucide-react'

interface SuperAdmin {
  id: string
  email: string
  createdAt: string
}

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<SuperAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Wipe state
  const [showWipe, setShowWipe] = useState(false)
  const [wipeConfirm, setWipeConfirm] = useState('')
  const [wipeLoading, setWipeLoading] = useState(false)
  const [wipeError, setWipeError] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await adminApi.get('/api/admin/admins')
      setAdmins(r.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    setAddLoading(true)
    try {
      const r = await adminApi.post('/api/admin/admins', { email, password })
      setAdmins(prev => [...prev, r.data])
      setEmail('')
      setPassword('')
      setShowForm(false)
    } catch (err: any) {
      setAddError(err.response?.data?.error || 'Ошибка')
    } finally {
      setAddLoading(false)
    }
  }

  const deleteAdmin = async (id: string, adminEmail: string) => {
    if (!confirm(`Удалить администратора ${adminEmail}?`)) return
    try {
      await adminApi.delete(`/api/admin/admins/${id}`)
      setAdmins(prev => prev.filter(a => a.id !== id))
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка удаления')
    }
  }

  const wipeCompanies = async () => {
    if (wipeConfirm !== 'WIPE_ALL') { setWipeError('Введите WIPE_ALL для подтверждения'); return }
    setWipeLoading(true)
    setWipeError('')
    try {
      const r = await adminApi.delete('/api/admin/wipe-companies', { data: { confirm: 'WIPE_ALL' } })
      alert(`Удалено ${r.data.deleted} компаний и все их данные`)
      setShowWipe(false)
      setWipeConfirm('')
    } catch (err: any) {
      setWipeError(err.response?.data?.error || 'Ошибка')
    } finally {
      setWipeLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Администраторы</h1>
          <p className="text-gray-400 text-sm mt-1">Управление доступом к супер-панели</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setAddError('') }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={addAdmin} className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-3">
          <h3 className="text-white font-medium text-sm">Новый администратор</h3>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
          />
          <input
            type="password"
            placeholder="Пароль (минимум 8 символов)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
          />
          {addError && <p className="text-red-400 text-sm">{addError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addLoading}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {addLoading ? 'Создаём...' : 'Создать'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Admins list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-10">
        {loading ? (
          <div className="p-6 text-gray-500 text-sm">Загрузка...</div>
        ) : admins.length === 0 ? (
          <div className="p-6 text-gray-500 text-sm">Нет администраторов</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Email</th>
                <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Добавлен</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id} className="border-b border-gray-800/50 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-white text-sm">{a.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-sm">
                    {new Date(a.createdAt).toLocaleDateString('ru')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {admins.length > 1 && (
                      <button
                        onClick={() => deleteAdmin(a.id, a.email)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Danger Zone */}
      <div className="border border-red-900/40 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="text-red-400 font-semibold text-sm">Опасная зона</h2>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Удалить все компании и всех пользователей. Это необратимо — будут удалены все данные (продажи, лиды, отчёты, платежи и т.д.).
        </p>
        {!showWipe ? (
          <button
            onClick={() => setShowWipe(true)}
            className="border border-red-700 text-red-400 hover:bg-red-900/20 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Удалить все компании и пользователей
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-400">Введите <code className="bg-gray-800 px-1 rounded">WIPE_ALL</code> для подтверждения:</p>
            <input
              type="text"
              value={wipeConfirm}
              onChange={e => setWipeConfirm(e.target.value)}
              placeholder="WIPE_ALL"
              className="w-full bg-gray-800 border border-red-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
            {wipeError && <p className="text-red-400 text-sm">{wipeError}</p>}
            <div className="flex gap-2">
              <button
                onClick={wipeCompanies}
                disabled={wipeLoading}
                className="bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {wipeLoading ? 'Удаляем...' : 'Подтвердить удаление'}
              </button>
              <button
                onClick={() => { setShowWipe(false); setWipeConfirm(''); setWipeError('') }}
                className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
