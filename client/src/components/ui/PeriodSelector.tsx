import { create } from 'zustand'

export type Period = 'today' | 'yesterday' | 'week' | 'month'

interface PeriodState {
  period: Period
  setPeriod: (p: Period) => void
}

export const usePeriodStore = create<PeriodState>((set) => ({
  period: 'month',
  setPeriod: (period) => set({ period }),
}))

const options: { value: Period; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
]

export default function PeriodSelector() {
  const { period, setPeriod } = usePeriodStore()
  return (
    <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => setPeriod(o.value)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            period === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
