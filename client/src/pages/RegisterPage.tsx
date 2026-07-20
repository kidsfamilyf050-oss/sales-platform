import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { BarChart2, ArrowLeft } from 'lucide-react'
import { useT } from '../i18n'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { t } = useT()
  const [form, setForm] = useState({ name: '', companyType: 'ТОО', companyShortName: '', email: '', password: '', secret: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const getCompanyName = () => `${form.companyType} "${form.companyShortName}"`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.companyShortName.trim()) return setError(t('register.companyError'))
    if (form.password.length < 6) return setError(t('register.passwordError'))
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/register', { ...form, companyName: getCompanyName() })
      setAuth(res.data.token, res.data.user)
      navigate('/onboarding')
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">SalesPlatform</span>
          </div>
          <LanguageSwitcher />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('register.title')}</h1>
        <p className="text-gray-500 text-sm mb-6">{t('register.subtitle')}</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">{t('register.companyName')}</label>
            <div className="flex gap-2">
              <select
                className="input w-24 flex-shrink-0"
                value={form.companyType}
                onChange={e => setForm(f => ({ ...f, companyType: e.target.value }))}
              >
                <option value="ТОО">ТОО</option>
                <option value="ИП">ИП</option>
              </select>
              <input
                type="text"
                className="input flex-1"
                placeholder={t('register.companyNamePlaceholder')}
                value={form.companyShortName}
                onChange={e => setForm(f => ({ ...f, companyShortName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">{t('register.yourName')}</label>
            <input
              type="text"
              className="input"
              placeholder={t('register.namePlaceholder')}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">{t('common.email')} *</label>
            <input
              type="email"
              className="input"
              placeholder={t('register.emailPlaceholder')}
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">{t('register.passwordLabel')}</label>
            <input
              type="password"
              className="input"
              placeholder={t('register.passwordPlaceholder')}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? t('register.loading') : t('register.submit')}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-3">{t('register.agreement')}</p>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to="/" className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('register.toHome')}
          </Link>
          <p className="text-gray-500">
            {t('register.hasAccount')}{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">{t('register.login')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
