interface ProgressBarProps {
  value: number // 0-100+
  label?: string
  showPercent?: boolean
}

export default function ProgressBar({ value, label, showPercent = true }: ProgressBarProps) {
  const clamped = Math.min(value, 100)
  const grad = value >= 75
    ? 'from-emerald-400 to-green-600'
    : value >= 50
    ? 'from-yellow-300 to-amber-500'
    : value >= 20
    ? 'from-orange-400 to-red-500'
    : 'from-red-400 to-rose-600'
  const textColor = value >= 75 ? 'text-green-600' : value >= 50 ? 'text-amber-500' : 'text-red-500'

  return (
    <div>
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-xs font-medium text-gray-500">{label}</span>}
          {showPercent && <span className={`text-sm font-bold ${textColor}`}>{value}%</span>}
        </div>
      )}
      <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
        {/* Filled bar — min 4px wide when value > 0 so it's always visible */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${grad} transition-all duration-700 ease-out`}
          style={{ width: clamped > 0 ? `max(${clamped}%, 4px)` : '0%' }}
        />
        {/* Shimmer highlight */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none" />
        {/* Label inside bar */}
        {clamped > 18 && (
          <span className="absolute left-3 inset-y-0 flex items-center text-[11px] font-bold text-white/90 drop-shadow">
            {value}%
          </span>
        )}
      </div>
    </div>
  )
}
