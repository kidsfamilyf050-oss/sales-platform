import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('ru') }

export default function OwnerDashboard() {
  const { period } = usePeriodStore()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-owner', period],
    queryFn: () => api.get(`/dashboard/owner?period=${period}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  if (!data) return null

  const { summary, dailyChart, managerRating } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Дашборд собственника</h1>
        <p className="text-gray-500 text-sm mt-0.5">Общая картина компании</p>
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
