import { useState, useRef, useEffect } from 'react'
import { create } from 'zustand'
import { CalendarRange } from 'lucide-react'
import { useT } from '../../i18n'

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

interface PeriodState {
  period: Period
  customFrom: string  // 'YYYY-MM-DD'
  customTo: string    // 'YYYY-MM-DD'
  setPeriod: (p: Period) => void
  setCustomRange: (from: string, to: string) => void
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function firstOfMonth() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().slice(0, 10)
}

export const usePeriodStore = create<PeriodState>((set) => ({
  period: 'month',
  customFrom: firstOfMonth(),
  customTo: todayStr(),
  setPeriod: (period) => set({ period }),
  setCustomRange: (customFrom, customTo) => set({ period: 'custom', customFrom, customTo }),
}))

// Build query params string for API calls
export function buildPeriodParams(state: PeriodState): string {
  if (state.period === 'custom') {
    return `from=${state.customFrom}&to=${state.customTo}`
  }
  return `period=${state.period}`
}

export default function PeriodSelector() {
  const { period, customFrom, customTo, setPeriod, setCustomRange } = usePeriodStore()
  const { t } = useT()
  const [showPicker, setShowPicker] = useState(false)
  const [tmpFrom, setTmpFrom] = useState(customFrom)
  const [tmpTo, setTmpTo] = useState(customTo)
  const pickerRef = useRef<HTMLDivElement>(null)

  const presets: { value: Exclude<Period, 'custom'>; labelKey: string }[] = [
    { value: 'today',     labelKey: 'period.today' },
    { value: 'yesterday', labelKey: 'period.yesterday' },
    { value: 'week',      labelKey: 'period.week' },
    { value: 'month',     labelKey: 'period.month' },
  ]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const applyCustom = () => {
    if (tmpFrom && tmpTo && tmpFrom <= tmpTo) {
      setCustomRange(tmpFrom, tmpTo)
      setShowPicker(false)
    }
  }

  const openPicker = () => {
    setTmpFrom(customFrom)
    setTmpTo(customTo)
    setShowPicker(true)
    setPeriod('custom')
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
        {presets.map(o => (
          <button
            key={o.value}
            onClick={() => { setPeriod(o.value); setShowPicker(false) }}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              period === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(o.labelKey as any)}
          </button>
        ))}
      </div>

      {/* Custom range button */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={openPicker}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            period === 'custom'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-gray-100 text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          {period === 'custom'
            ? `${customFrom.slice(5).replace('-', '.')} – ${customTo.slice(5).replace('-', '.')}`
            : t('period.custom')}
        </button>

        {showPicker && (
          <div className="absolute top-full mt-2 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-72">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('period.customLabel')}</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">{t('period.from')}</label>
                <input
                  type="date"
                  max={tmpTo || todayStr()}
                  value={tmpFrom}
                  onChange={e => setTmpFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">{t('period.to')}</label>
                <input
                  type="date"
                  min={tmpFrom}
                  max={todayStr()}
                  value={tmpTo}
                  onChange={e => setTmpTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <button
              onClick={applyCustom}
              disabled={!tmpFrom || !tmpTo || tmpFrom > tmpTo}
              className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {t('period.apply')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
