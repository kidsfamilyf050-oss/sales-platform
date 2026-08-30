import { useEffect, useState } from 'react'
import { Clock, X, Lock } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import ContactFormModal from '../ContactFormModal'

function formatCountdown(ms: number) {
  if (ms <= 0) return { h: '00', m: '00', s: '00', expired: true }
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return {
    h: String(h).padStart(2, '0'),
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
    expired: false,
  }
}

export default function TrialBanner() {
  const user = useAuthStore(s => s.user)
  const [dismissed, setDismissed] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!user || user.subscriptionPlan !== 'trial') return null

  const trialEnd = user.trialEndsAt ? new Date(user.trialEndsAt).getTime() : null
  if (!trialEnd) return null

  const ms = trialEnd - now
  const { h, m, s, expired } = formatCountdown(ms)
  const isOwner = user.role === 'OWNER'

  // ── Full-screen blocking overlay when trial expired ──────────────────────────
  if (expired) {
    return (
      <>
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Пробный период истёк</h2>
            {isOwner ? (
              <>
                <p className="text-gray-500 text-sm mb-6">
                  Оставьте заявку — менеджер свяжется с вами и активирует тариф
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors"
                >
                  Выбрать тариф
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-6">
                  Обратитесь к руководителю для продления доступа
                </p>
                <div className="bg-gray-50 rounded-xl py-3 px-4 text-gray-500 text-sm">
                  Ожидайте активации тарифа
                </div>
              </>
            )}
          </div>
        </div>
        {showForm && <ContactFormModal onClose={() => setShowForm(false)} />}
      </>
    )
  }

  // ── Active trial — dismissible top banner ────────────────────────────────────
  if (dismissed) return null
  return (
    <>
      <div className="w-full flex items-center justify-between gap-4 px-4 py-2 text-sm font-medium bg-amber-500 text-white">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span className="flex items-center gap-2 flex-wrap">
            <span>Пробный период:</span>
            <span className="font-mono bg-black/20 px-2 py-0.5 rounded text-base tracking-widest">
              {h}:{m}:{s}
            </span>
            <span>— перейдите на тариф, чтобы сохранить доступ</span>
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setShowForm(true)}
            className="bg-white text-amber-600 hover:bg-amber-50 px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
          >
            Выбрать тариф
          </button>
          <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {showForm && <ContactFormModal onClose={() => setShowForm(false)} />}
    </>
  )
}
