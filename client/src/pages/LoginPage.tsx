import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { BarChart2 } from 'lucide-react'
import { useT } from '../i18n'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { t } = useT()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', form)
      setAuth(res.data.token, res.data.user)
      navigate('/app')
    } catch (err: any) {
      setError(err.response?.data?.error || t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">SalesPlatform</span>
          </div>
          <LanguageSwitcher />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('login.title')}</h1>
        <p className="text-gray-500 text-sm mb-6">{t('login.subtitle')}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">{t('common.email')}</label>
            <input type="email" className="input" placeholder="email@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">{t('common.password')}</label>
              <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">{t('login.forgotPassword')}</Link>
            </div>
            <input type="password" className="input" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? t('login.loading') : t('login.submit')}
          </button>
        </form>
        <div className="flex items-center justify-between mt-6 text-sm">
          <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">{t('login.toHome')}</Link>
          <p className="text-gray-500">
            {t('login.noAccount')}{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-medium">{t('login.register')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
