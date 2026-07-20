import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { BarChart2 } from 'lucide-react'
import { useT } from '../i18n'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function AcceptInvitePage() {
  const { t } = useT()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/accept-invite', { token, password })
      setAuth(res.data.token, res.data.user)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || t('accept.error'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) return <div className="p-8 text-center text-red-600">{t('accept.invalidLink')}</div>

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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('accept.title')}</h1>
        <p className="text-gray-500 text-sm mb-6">{t('accept.subtitle')}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">{t('accept.passwordLabel')}</label>
            <input type="password" className="input" placeholder={t('reset.passwordPlaceholder')} value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? t('accept.submitting') : t('accept.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
