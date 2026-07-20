import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { BarChart2, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { useT } from '../i18n'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function ResetPasswordPage() {
  const { t } = useT()
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
    if (password !== confirm) return setError(t('reset.mismatch'))
    if (password.length < 6) return setError(t('reset.tooShort'))
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || t('reset.title'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <p className="text-red-600 mb-4">{t('reset.invalidLink')}</p>
          <Link to="/forgot-password" className="text-blue-600 hover:underline text-sm">{t('reset.requestNew')}</Link>
        </div>
      </div>
    )
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

        {!done ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('reset.title')}</h1>
            <p className="text-gray-500 text-sm mb-6">{t('reset.subtitle')}</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">{t('reset.newPassword')}</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder={t('reset.passwordPlaceholder')}
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
                <label className="label">{t('reset.confirmPassword')}</label>
                <input
                  type="password"
                  className="input"
                  placeholder={t('reset.confirmPlaceholder')}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
              <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
                {loading ? t('reset.saving') : t('reset.submit')}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('reset.done')}</h2>
            <p className="text-gray-500 text-sm">{t('reset.redirecting')}</p>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-blue-600 hover:underline">{t('reset.login')}</Link>
        </p>
      </div>
    </div>
  )
}
