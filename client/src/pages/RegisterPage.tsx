import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { BarChart2 } from 'lucide-react'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({ name: '', email: '', password: '', secret: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/register', form)
      setAuth(res.data.token, res.data.user)
      navigate('/onboarding')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Регистрация</h1>
        <p className="text-gray-500 text-sm mb-6">Создайте аккаунт собственника компании</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Ваше имя</label>
            <input type="text" className="input" placeholder="Иван Иванов" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" placeholder="email@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input type="password" className="input" placeholder="Минимум 6 символов" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} minLength={6} required />
          </div>
          <div>
            <label className="label">Секретный код регистрации</label>
            <input type="password" className="input" placeholder="Введите код, выданный администратором" value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Если код не установлен — оставьте поле пустым</p>
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? 'Регистрируем...' : 'Создать аккаунт'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">Войти</Link>
        </p>
      </div>
    </div>
  )
}
