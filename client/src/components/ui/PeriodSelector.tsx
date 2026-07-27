import { create } from 'zustand'
import { CalendarRange, ChevronLeft, ChevronRight as ChevronRightIcon, X } from 'lucide-react'
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

  const presets: { value: Exclude<Period, 'custom'>; labelKey: string }[] = [
    { value: 'today',     labelKey: 'period.today' },
    { value: 'yesterday', labelKey: 'period.yesterday' },
    { value: 'month',     labelKey: 'period.month' },
  ]

  const { label: monthLabel } = getOffsetMonthDates(monthOffset)

  // When custom period is active — show inline date pickers (no popup, works in all browsers)
  if (period === 'custom') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Preset buttons — visible to switch back */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
          {presets.map(o => (
            <button
              key={o.value}
              onClick={() => {
                setPeriod(o.value)
                if (o.value === 'month') setMonthOffset(0)
              }}
              className="px-2 md:px-3 py-1 rounded-md text-xs md:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap"
            >
              {t(o.labelKey as any)}
            </button>
          ))}
        </div>

        {/* Inline date range — no dropdown, safe in Safari */}
        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
          <CalendarRange className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-xs text-blue-500 font-medium whitespace-nowrap hidden sm:inline">{t('period.from')}:</span>
          <input
            type="date"
            value={customFrom}
            max={customTo || todayStr()}
            onChange={e => {
              const val = e.target.value
              if (val) setCustomRange(val, customTo && val <= customTo ? customTo : val)
            }}
            className="text-xs md:text-sm font-semibold text-blue-700 bg-transparent border-none outline-none cursor-pointer"
          />
          <span className="text-blue-300 text-xs font-bold">—</span>
          <span className="text-xs text-blue-500 font-medium whitespace-nowrap hidden sm:inline">{t('period.to')}:</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={todayStr()}
            onChange={e => {
              const val = e.target.value
              if (val) setCustomRange(customFrom && customFrom <= val ? customFrom : val, val)
            }}
            className="text-xs md:text-sm font-semibold text-blue-700 bg-transparent border-none outline-none cursor-pointer"
          />
          <button
            onClick={() => { setPeriod('month'); setMonthOffset(0) }}
            className="ml-0.5 p-0.5 text-blue-300 hover:text-blue-600 transition-colors rounded"
            title="Сбросить период"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
        {presets.map(o => (
          <button
            key={o.value}
            onClick={() => {
              setPeriod(o.value)
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

      {/* "Период" button — switches to custom inline date range */}
      <button
        onClick={() => {
          // Initialize to current month range if customFrom/customTo are defaults
          if (!customFrom || !customTo) {
            const { from, to } = getOffsetMonthDates(monthOffset)
            setCustomRange(from, to)
          } else {
            setPeriod('custom')
          }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
      >
        <CalendarRange className="w-4 h-4" />
        {t('period.custom')}
      </button>
    </div>
  )
}
