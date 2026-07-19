interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  extraSub?: React.ReactNode
  color?: 'default' | 'green' | 'red' | 'yellow' | 'blue'
  icon?: React.ReactNode
}

const colorMap = {
  default: 'text-gray-900',
  green: 'text-green-600',
  red: 'text-red-600',
  yellow: 'text-yellow-600',
  blue: 'text-blue-600',
}

export default function StatCard({ label, value, sub, extraSub, color = 'default', icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <p className="stat-label">{label}</p>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <p className={`stat-value ${colorMap[color]}`}>{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
      {extraSub && <div className="mt-0.5">{extraSub}</div>}
    </div>
  )
}
