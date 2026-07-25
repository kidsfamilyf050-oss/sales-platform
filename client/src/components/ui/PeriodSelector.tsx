import { useState, useRef, useEffect } from 'react'
import { create } from 'zustand'
import { CalendarRange, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { useT } from '../../i18n'

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

interface PeriodState {
  period: Period
  customFrom: string  // 'YYYY-MM-DD'
  customTo: string    // 'YYYY-MM-DD'
  monthOffset: number // 0 = current month, -1 = previous, etc.
  setPeriod: (p: Period) => void
  setCustomRange: (from: string, to: string) => void
  setMonthOffset: (n: number) => void
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayStr() { return localDateStr(new Date()) }
function firstOfMonth() {
  const d = new Date(); d.setDate(1)
  return localDateStr(d)
}

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function getOffsetMonthDates(offset: number): { from: string; to: string; label: string } {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const from = localDateStr(d)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const today = new Date()
  const to = lastDay > today ? localDateStr(today) : localDateStr(lastDay)
  const label = `${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`
  return { from, to, label }
}

export const usePeriodStore = create<PeriodState>((set) => ({
  period: 'month',
  customFrom: firstOfMonth(),
  customTo: todayStr(),
  monthOffset: 0,
  setPeriod: (period) => set({ period }),
  setCustomRange: (customFrom, customTo) => set({ period: 'custom', customFrom, customTo }),
  setMonthOffset: (monthOffset) => set({ monthOffset }),
}))

// Build query params string for API calls
export function buildPeriodParams(state: PeriodState): string {
  if (state.period === 'custom') {
    return `from=${state.customFrom}&to=${state.customTo}`
  }
  if (state.period === 'month') {
    const { from, to } = getOffsetMonthDates(state.monthOffset)
    return `from=${from}&to=${to}`
  }
  return `period=${state.period}`
}

export default function PeriodSelector() {
  const { period, customFrom, customTo, monthOffset, setPeriod, setCustomRange, setMonthOffset } = usePeriodStore()
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

  const { label: monthLabel } = getOffsetMonthDates(monthOffset)

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
      <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
        {presets.map(o => (
          <button
            key={o.value}
            onClick={() => {
              setPeriod(o.value)
              setShowPicker(false)
              if (o.value === 'month') setMonthOffset(0)
            }}
            className={`px-2 md:px-3 py-1 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
              period === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(o.labelKey as any)}
          </button>
        ))}
      </div>

      {/* Month navigation — shows when "Месяц" is active */}
      {period === 'month' && (
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMonthOffset(monthOffset - 1)}
            className="p-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-white transition-colors"
            title="Предыдущий месяц"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs md:text-sm font-semibold text-gray-800 px-2 whitespace-nowrap min-w-[110px] text-center">
            {monthLabel}
          </span>
          <button
            onClick={() => setMonthOffset(Math.min(0, monthOffset + 1))}
            disabled={monthOffset >= 0}
            className="p-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Следующий месяц"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}

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
          <div className="absolute top-full mt-2 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64 md:w-72">
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
