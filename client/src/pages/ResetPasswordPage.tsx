import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { BarChart2, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return setError('Пароли не совпадают')
    if (password.length < 6) return setError('Пароль должен быть минимум 6 символов')
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сброса пароля')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <p className="text-red-600 mb-4">Недействительная ссылка для сброса пароля.</p>
          <Link to="/forgot-password" className="text-blue-600 hover:underline text-sm">Запросить новую ссылку</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">SalesPlatform</span>
        </div>

        {!done ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Новый пароль</h1>
            <p className="text-gray-500 text-sm mb-6">Введите новый пароль для вашего аккаунта</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Новый пароль</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Минимум 6 символов"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                  <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Подтвердите пароль</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Повторите пароль"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
              <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
                {loading ? 'Сохраняем...' : 'Сохранить пароль'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Пароль изменён!</h2>
            <p className="text-gray-500 text-sm">Переходим на страницу входа...</p>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-blue-600 hover:underline">Войти в аккаунт</Link>
        </p>
      </div>
    </div>
  )
}
