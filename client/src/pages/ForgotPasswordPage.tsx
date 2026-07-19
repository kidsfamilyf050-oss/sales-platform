import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { BarChart2, Mail, ArrowLeft, Copy, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ message: string; resetUrl?: string; note?: string } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/forgot-password', { email })
      setResult(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (result?.resetUrl) {
      navigator.clipboard.writeText(result.resetUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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

        {!result ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Забыли пароль?</h1>
            <p className="text-gray-500 text-sm mb-6">Введите email — мы пришлём ссылку для сброса пароля</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    className="input pl-9"
                    placeholder="email@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
              <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
                {loading ? 'Отправляем...' : 'Сбросить пароль'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Готово!</h2>
            <p className="text-gray-500 text-sm mb-4">{result.message}</p>

            {result.resetUrl && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left mb-4">
                <p className="text-xs font-medium text-yellow-800 mb-2">{result.note || 'Ссылка для сброса пароля:'}</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={result.resetUrl}
                    className="flex-1 bg-white border border-yellow-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none"
                    onClick={e => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors whitespace-nowrap"
                  >
                    {copied ? <><CheckCircle className="w-3 h-3" /> Скопировано</> : <><Copy className="w-3 h-3" /> Копировать</>}
                  </button>
                </div>
                <p className="text-xs text-yellow-700 mt-2">⚠ Ссылка действительна 1 час.</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Вернуться ко входу
          </Link>
        </div>
      </div>
    </div>
  )
}
