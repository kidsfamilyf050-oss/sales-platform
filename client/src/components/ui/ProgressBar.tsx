interface ProgressBarProps {
  value: number // 0-100+
  label?: string
  showPercent?: boolean
}

export default function ProgressBar({ value, label, showPercent = true }: ProgressBarProps) {
  const clamped = Math.min(value, 100)
  const color = value >= 100 ? 'bg-green-500' : value >= 75 ? 'bg-blue-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div>
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-gray-500">{label}</span>}
          {showPercent && <span className="text-xs font-medium text-gray-700">{value}%</span>}
        </div>
      )}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}
