import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { BarChart2, Eye, EyeOff } from 'lucide-react'
import { useT } from '../i18n'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function AcceptInvitePage() {
  const { t } = useT()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [inviteInfo, setInviteInfo] = useState<{ name: string; email: string; isPasswordReset: boolean } | null>(null)
  const [infoError, setInfoError] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Load token info on mount
  useEffect(() => {
    if (!token) return
    api.get(`/auth/invite-info?token=${token}`)
      .then(r => setInviteInfo(r.data))
      .catch(err => setInfoError(err.response?.data?.error || 'Ссылка недействительна'))
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/accept-invite', { token, password })
      setAuth(res.data.token, res.data.user)
      navigate('/app')
    } catch (err: any) {
      setError(err.response?.data?.error || t('accept.error'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <p className="text-red-600">{t('accept.invalidLink')}</p>
      </div>
    </div>
  )

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

        {infoError ? (
          <div className="text-center py-4">
            <p className="text-red-600 font-medium">{infoError}</p>
            <p className="text-gray-400 text-sm mt-2">Попросите администратора сгенерировать новую ссылку.</p>
          </div>
        ) : !inviteInfo ? (
          <div className="text-center py-8 text-gray-400">Проверяем ссылку...</div>
        ) : (
          <>
            {inviteInfo.isPasswordReset ? (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Смена пароля</h1>
                <p className="text-gray-500 text-sm mb-1">Привет, <span className="font-medium text-gray-700">{inviteInfo.name}</span>!</p>
                <p className="text-gray-400 text-sm mb-6">Придумайте новый пароль для входа в систему.</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('accept.title')}</h1>
                <p className="text-gray-500 text-sm mb-1">Привет, <span className="font-medium text-gray-700">{inviteInfo.name}</span>!</p>
                <p className="text-gray-400 text-sm mb-6">{t('accept.subtitle')}</p>
              </>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">{t('accept.passwordLabel')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder={inviteInfo.isPasswordReset ? 'Новый пароль (мин. 6 символов)' : t('reset.passwordPlaceholder')}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    minLength={6}
                    required
                    autoFocus
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
              <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
                {loading ? (inviteInfo.isPasswordReset ? 'Сохраняем...' : t('accept.submitting')) : (inviteInfo.isPasswordReset ? 'Сохранить новый пароль' : t('accept.submit'))}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
