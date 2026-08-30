import { useState } from 'react'
import axios from 'axios'
import { X, CheckCircle } from 'lucide-react'

interface Props {
  /** Pre-selected plan. If omitted, user picks inside the modal. */
  initialPlan?: 'starter' | 'pro'
  onClose: () => void
}

const PLAN_OPTIONS = [
  { value: 'starter', label: 'Стартер', price: '₸100 000 / мес' },
  { value: 'pro',     label: 'Pro',     price: '₸150 000 / мес' },
]

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export default function ContactFormModal({ initialPlan, onClose }: Props) {
  const [plan, setPlan]   = useState<'starter' | 'pro'>(initialPlan ?? 'starter')
  const [form, setForm]   = useState({ name: '', phone: '', email: '', companyName: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await axios.post(`${API_BASE}/plan-requests`, { ...form, plan })
      setSuccess(true)
    } catch {
      setError('Произошла ошибка. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Заявка отправлена!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Наш менеджер свяжется с вами в ближайшее время
            </p>
            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Оставить заявку</h2>
            <p className="text-sm text-gray-500 mb-5">Мы свяжемся с вами и активируем тариф</p>

            {/* Plan selector (shown when no plan pre-selected) */}
            {!initialPlan && (
              <div className="flex gap-3 mb-5">
                {PLAN_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setPlan(o.value as 'starter' | 'pro')}
                    className={`flex-1 border-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
                      plan === o.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div>{o.label}</div>
                    <div className={`text-xs font-normal mt-0.5 ${plan === o.value ? 'text-blue-500' : 'text-gray-400'}`}>
                      {o.price}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Pre-selected plan badge */}
            {initialPlan && (
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-semibold px-3 py-1.5 rounded-lg mb-5">
                Тариф: {PLAN_OPTIONS.find(o => o.value === initialPlan)?.label} —{' '}
                {PLAN_OPTIONS.find(o => o.value === initialPlan)?.price}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ФИО *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Иванов Иван Иванович"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Название компании *</label>
                <input
                  type="text"
                  required
                  value={form.companyName}
                  onChange={set('companyName')}
                  placeholder="ТОО «Компания»"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Телефон *</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+7 (777) 000-00-00"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={set('email')}
                  placeholder="info@company.kz"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors mt-1"
              >
                {loading ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
