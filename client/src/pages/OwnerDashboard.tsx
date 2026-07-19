import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('ru') }

// Month navigation helpers
function getMonthRange(offset: number) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + offset
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    from: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`,
    to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
    label: first.toLocaleString('ru-RU', { month: 'long', year: 'numeric' }),
  }
}

export default function OwnerDashboard() {
  const { period } = usePeriodStore()
  const [monthOffset, setMonthOffset] = useState(0)

  const monthRange = getMonthRange(monthOffset)

  const queryParams = period === 'month'
    ? `from=${monthRange.from}&to=${monthRange.to}`
    : `period=${period}`

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-owner', period, monthOffset],
    queryFn: () => api.get(`/dashboard/owner?${queryParams}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  if (!data) return null

  const { summary, dailyChart, managerRating } = data

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дашборд собственника</h1>
          <p className="text-gray-500 text-sm mt-0.5">Общая картина компании</p>
        </div>

        {/* Month navigator — only when period === 'month' */}
        {period === 'month' && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 self-center">
            <button
              onClick={() => setMonthOffset(o => o - 1)}
              className="p-1.5 hover:bg-white rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="px-3 text-sm font-semibold text-gray-800 min-w-[150px] text-center capitalize">
              {monthRange.label}
            </span>
            <button
              onClick={() => setMonthOffset(o => Math.min(0, o + 1))}
              disabled={monthOffset >= 0}
              className="p-1.5 hover:bg-white rounded-md transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Row 1 — Sales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="План продаж" value={`₸ ${fmt(summary.salesPlan)}`} />
        <StatCard label="Факт продаж" value={`₸ ${fmt(summary.totalSalesAmount)}`} color="blue" />
        <StatCard label="Выполнение" value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
        <StatCard label="Средний чек" value={`₸ ${fmt(summary.avgCheck)}`} />
      </div>

      <div>
        <ProgressBar value={summary.planCompletion} label="Выполнение плана продаж" />
      </div>

      {/* Row 2 — Marketing */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Лиды" value={summary.totalLeads} sub={`план: ${summary.leadsplan}`} />
        <StatCard label="Квалиф. лиды" value={summary.totalQualifiedLeads} />
        <StatCard label="Стоимость лида" value={`₸ ${fmt(summary.leadCost)}`} />
        <StatCard label="Рекл. бюджет" value={`₸ ${fmt(summary.totalBudget)}`} />
      </div>

      {/* Row 3 — Team */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Конверсия" value={`${summary.conversion}%`} />
        <StatCard label="Лучший менеджер" value={summary.bestManager} icon={<TrendingUp className="w-4 h-4 text-green-500" />} />
        <StatCard label="Отстающий" value={summary.worstManager} icon={<TrendingDown className="w-4 h-4 text-red-500" />} />
      </div>

      {/* Chart */}
      {dailyChart?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Продажи по дням</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyChart}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `₸ ${fmt(v)}`} />
              <Legend />
              <Line type="monotone" dataKey="amount" name="Сумма продаж" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Manager Rating */}
      {managerRating?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Рейтинг менеджеров</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Менеджер</th>
                  <th className="pb-2 font-medium text-right">Продажи</th>
                  <th className="pb-2 font-medium text-right">Сумма</th>
                  <th className="pb-2 font-medium text-right">Конверсия</th>
                  <th className="pb-2 font-medium text-right">Ср. чек</th>
                </tr>
              </thead>
              <tbody>
                {managerRating.map((m: any, i: number) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 font-medium text-gray-900">{m.name}</td>
                    <td className="py-2.5 text-right">{m.salesCount}</td>
                    <td className="py-2.5 text-right font-medium">₸ {fmt(m.salesAmount)}</td>
                    <td className="py-2.5 text-right">{m.conversion}%</td>
                    <td className="py-2.5 text-right">₸ {fmt(m.avgCheck)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AIInsights data={summary} managerRating={managerRating} period={period} />
    </div>
  )
}
