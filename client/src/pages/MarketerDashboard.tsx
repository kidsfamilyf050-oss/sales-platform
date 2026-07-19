import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { usePeriodStore } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { FileText, CheckCircle } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('ru') }

export default function MarketerDashboard() {
  const { period } = usePeriodStore()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-marketer', period],
    queryFn: () => api.get(`/dashboard/marketer?period=${period}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  if (!data) return null

  const { summary, dailyChart, todayReport } = data

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Кабинет маркетолога</h1>
          <p className="text-gray-500 text-sm mt-0.5">Лидогенерация и бюджет</p>
        </div>
        {todayReport ? (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Отчёт сдан
          </div>
        ) : (
          <button onClick={() => navigate('/report')} className="btn-primary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Заполнить отчёт
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="План лидов" value={summary.leadsplan} />
        <StatCard label="Получено лидов" value={summary.totalLeads} color="blue" />
        <StatCard label="Выполнение" value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
        <StatCard label="Квалиф. лиды" value={summary.totalQualified} />
        <StatCard label="Стоимость лида" value={`₸ ${fmt(summary.leadCost)}`} />
        <StatCard label="Рекл. бюджет" value={`₸ ${fmt(summary.totalBudget)}`} sub={`план: ₸ ${fmt(summary.budgetPlan)}`} />
      </div>

      <ProgressBar value={summary.planCompletion} label="Выполнение плана по лидам" />

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Лидов в день (среднее)" value={summary.avgLeadsPerDay} />
        <StatCard label="Прогноз на месяц" value={summary.projectedLeads} sub={`при текущем темпе`} color={summary.projectedLeads >= summary.leadsplan ? 'green' : 'yellow'} />
      </div>

      {/* Charts */}
      {dailyChart?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Лиды по дням</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyChart}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leads" name="Лиды" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="qualified" name="Квалиф." fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Бюджет по дням</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyChart}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₸ ${fmt(v)}`} />
                <Line type="monotone" dataKey="budget" name="Бюджет" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <AIInsights data={summary} period={period} />
    </div>
  )
}
