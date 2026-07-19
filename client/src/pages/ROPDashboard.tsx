import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import { ArrowRight } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('ru') }

const statusConfig = {
  green: { dot: 'bg-green-400', label: 'В норме' },
  yellow: { dot: 'bg-yellow-400', label: 'Отстаёт' },
  red: { dot: 'bg-red-500', label: 'Нет отчёта' },
}

export default function ROPDashboard() {
  const { period } = usePeriodStore()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-rop', period],
    queryFn: () => api.get(`/dashboard/rop?period=${period}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  if (!data) return null

  const { summary, funnel, marketing, managerRating } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Кабинет РОПа</h1>
        <p className="text-gray-500 text-sm mt-0.5">Показатели отдела продаж</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="План продаж" value={`₸ ${fmt(summary.salesPlan)}`} />
        <StatCard label="Факт продаж" value={`₸ ${fmt(summary.salesAmount)}`} color="blue" />
        <StatCard label="Выполнение" value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
        <StatCard label="Сделок" value={summary.salesCount} />
        <StatCard label="Конверсия" value={`${summary.conversion}%`} />
        <StatCard label="Средний чек" value={`₸ ${fmt(summary.avgCheck)}`} />
      </div>

      <ProgressBar value={summary.planCompletion} label="Выполнение плана" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Воронка продаж</h3>
          <div className="space-y-3">
            {[
              { label: 'Лиды получено', value: funnel.leadsReceived },
              { label: 'Квалифицировано', value: funnel.qualifiedLeads },
              { label: 'Передано клоузерам', value: funnel.transferredToCloser },
              { label: 'Продажи', value: funnel.salesCount },
            ].map((item, i, arr) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex justify-center my-1"><ArrowRight className="w-3 h-3 text-gray-300 rotate-90" /></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Marketing */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Маркетинг</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">План лидов</span><span className="font-medium">{marketing.leadsplan}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Факт лидов</span><span className="font-medium text-blue-600">{marketing.totalLeads}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Квалифицированных</span><span className="font-medium">{marketing.qualifiedLeads}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Стоимость лида</span><span className="font-medium">₸ {fmt(marketing.leadCost)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Бюджет</span><span className="font-medium">₸ {fmt(marketing.totalBudget)}</span></div>
          </div>
        </div>

        {/* Legend */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Статусы менеджеров</h3>
          <div className="space-y-2.5">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className="text-gray-600">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manager Rating */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Рейтинг менеджеров</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Статус</th>
                <th className="pb-2 font-medium">Менеджер</th>
                <th className="pb-2 font-medium text-right">План</th>
                <th className="pb-2 font-medium text-right">Продажи</th>
                <th className="pb-2 font-medium text-right">Выполнение</th>
                <th className="pb-2 font-medium text-right">Конверсия</th>
              </tr>
            </thead>
            <tbody>
              {managerRating?.map((m: any) => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusConfig[m.status as keyof typeof statusConfig]?.dot}`} />
                  </td>
                  <td className="py-2.5 font-medium text-gray-900">
                    {m.name}
                    {m.managerType && <span className="ml-1 text-xs text-gray-400">({m.managerType === 'LIDER' ? 'Лидоруб' : 'Клоузер'})</span>}
                  </td>
                  <td className="py-2.5 text-right">₸ {fmt(m.plan)}</td>
                  <td className="py-2.5 text-right">₸ {fmt(m.salesAmount)}</td>
                  <td className="py-2.5 text-right">
                    <span className={`font-medium ${m.completion >= 75 ? 'text-green-600' : m.completion >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {m.completion}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right">{m.conversion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AIInsights data={summary} managerRating={managerRating} funnel={funnel} period={period} />
    </div>
  )
}
