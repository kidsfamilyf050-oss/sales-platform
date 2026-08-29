import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, X } from 'lucide-react'
import { useAuthStore } from '../../store/auth'

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

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (dismissed) return null
  if (!user || user.subscriptionPlan !== 'trial') return null

  const trialEnd = user.trialEndsAt ? new Date(user.trialEndsAt).getTime() : null
  if (!trialEnd) return null

  const ms = trialEnd - now
  const { h, m, s, expired } = formatCountdown(ms)

  return (
    <div className={`w-full flex items-center justify-between gap-4 px-4 py-2 text-sm font-medium ${expired ? 'bg-red-600' : 'bg-amber-500'} text-white`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Clock className="w-4 h-4 flex-shrink-0" />
        {expired ? (
          <span>Пробный период закончился. Перейдите на платный тариф, чтобы продолжить работу.</span>
        ) : (
          <span className="flex items-center gap-2 flex-wrap">
            <span>Пробный период:</span>
            <span className="font-mono bg-black/20 px-2 py-0.5 rounded text-base tracking-widest">
              {h}:{m}:{s}
            </span>
            <span>— перейдите на тариф, чтобы сохранить доступ</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link
          to="/plans"
          className="bg-white text-amber-600 hover:bg-amber-50 px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
          style={expired ? { color: '#dc2626' } : {}}
        >
          Выбрать тариф
        </Link>
        {!expired && (
          <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
