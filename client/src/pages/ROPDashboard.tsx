import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'

function fmt(n: number) { return n.toLocaleString('ru') }

const STATUS = {
  green:  { dot: 'bg-green-400',  bg: '',              label: 'В норме' },
  yellow: { dot: 'bg-yellow-400', bg: 'bg-yellow-50',  label: 'Отстаёт' },
  red:    { dot: 'bg-red-500',    bg: 'bg-red-50',     label: 'Нет отчёта' },
}

// Visual funnel component
function Funnel({ steps }: { steps: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...steps.map(s => s.value), 1)
  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const pct = Math.round((step.value / max) * 100)
        const conv = i > 0 && steps[i - 1].value > 0
          ? Math.round((step.value / steps[i - 1].value) * 100) : null
        return (
          <div key={step.label}>
            {conv !== null && (
              <div className="flex items-center gap-1 pl-1 py-0.5">
                <div className="w-px h-3 bg-gray-300 ml-1" />
                <span className={`text-[11px] font-medium ${conv >= 50 ? 'text-green-600' : conv >= 30 ? 'text-amber-500' : 'text-red-500'}`}>
                  ↓ {conv}%
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-[140px] shrink-0 leading-tight">{step.label}</span>
              <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                <div
                  className={`h-6 rounded transition-all ${step.color || 'bg-blue-500'}`}
                  style={{ width: `${pct}%`, minWidth: step.value > 0 ? '2%' : '0' }}
                />
              </div>
              <span className="text-sm font-bold text-gray-800 w-8 text-right">{step.value}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ROPDashboard() {
  const { period } = usePeriodStore()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-rop', period],
    queryFn: () => api.get(`/dashboard/rop?period=${period}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  if (!data) return null

  const { summary, funnel, marketing, managerRating, liderRating } = data

  const funnelSteps = [
    { label: 'Лидов получено',      value: funnel.leadsReceived,    color: 'bg-purple-400' },
    { label: 'Квалифицировано',      value: funnel.qualifiedLeads,   color: 'bg-purple-500' },
    { label: 'Записано на встречу',  value: funnel.meetingsScheduled,color: 'bg-blue-400' },
    { label: 'Пришло на встречу',    value: funnel.meetingsAttended, color: 'bg-blue-500' },
    { label: 'Продажи (сделки)',     value: funnel.salesCount,       color: 'bg-green-500' },
  ]

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
        {/* Visual Funnel */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Воронка продаж</h3>
          <Funnel steps={funnelSteps} />
        </div>

        {/* Marketing */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Маркетинг</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">План лидов</span><span className="font-medium">{marketing.leadsplan}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Факт лидов</span><span className="font-medium text-blue-600">{marketing.totalLeads}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Квалифицированных</span><span className="font-medium">{marketing.qualifiedLeads}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-500">Стоимость лида</span><span className="font-medium">₸ {fmt(marketing.leadCost)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Бюджет</span><span className="font-medium">₸ {fmt(marketing.totalBudget)}</span></div>
          </div>
          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            {Object.entries(STATUS).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2 text-xs text-gray-500">
                <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Closer Rating */}
      {managerRating?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-1">Рейтинг клоузеров</h3>
          <p className="text-xs text-gray-400 mb-4">По % выполнения плана. 🔴 — нет отчёта, 🟡 — &lt; 50%, 🟢 — норма</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium w-6" />
                  <th className="pb-2 font-medium">Менеджер</th>
                  <th className="pb-2 font-medium text-right">План</th>
                  <th className="pb-2 font-medium text-right">Факт</th>
                  <th className="pb-2 font-medium text-right">Выполнение</th>
                  <th className="pb-2 font-medium text-right">Сделок</th>
                  <th className="pb-2 font-medium text-right">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {managerRating.map((m: any) => (
                  <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50 ${STATUS[m.status as keyof typeof STATUS]?.bg}`}>
                    <td className="py-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${STATUS[m.status as keyof typeof STATUS]?.dot}`} />
                    </td>
                    <td className="py-2.5 font-medium text-gray-900">{m.name}</td>
                    <td className="py-2.5 text-right text-gray-500">₸ {fmt(m.plan)}</td>
                    <td className="py-2.5 text-right font-medium">₸ {fmt(m.salesAmount)}</td>
                    <td className="py-2.5 text-right">
                      <span className={`font-bold ${m.completion >= 75 ? 'text-green-600' : m.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {m.completion}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right">{m.salesCount}</td>
                    <td className="py-2.5 text-right">{m.conversion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lider Rating */}
      {liderRating?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-1">Рейтинг лидорубов</h3>
          <p className="text-xs text-gray-400 mb-4">По % выполнения плана лидогенерации</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium w-6" />
                  <th className="pb-2 font-medium">Лидоруб</th>
                  <th className="pb-2 font-medium text-right">План</th>
                  <th className="pb-2 font-medium text-right">Лидов</th>
                  <th className="pb-2 font-medium text-right">Выполнение</th>
                  <th className="pb-2 font-medium text-right">Квалиф.</th>
                  <th className="pb-2 font-medium text-right">% квал.</th>
                  <th className="pb-2 font-medium text-right">На встречу</th>
                  <th className="pb-2 font-medium text-right">Пришло</th>
                </tr>
              </thead>
              <tbody>
                {liderRating.map((m: any) => (
                  <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50 ${STATUS[m.status as keyof typeof STATUS]?.bg}`}>
                    <td className="py-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${STATUS[m.status as keyof typeof STATUS]?.dot}`} />
                    </td>
                    <td className="py-2.5 font-medium text-gray-900">{m.name}</td>
                    <td className="py-2.5 text-right text-gray-500">{m.leadsplan}</td>
                    <td className="py-2.5 text-right font-medium">{m.leads}</td>
                    <td className="py-2.5 text-right">
                      <span className={`font-bold ${m.completion >= 75 ? 'text-green-600' : m.completion >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {m.completion}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right">{m.qualifiedLeads}</td>
                    <td className="py-2.5 text-right">{m.qualRate}%</td>
                    <td className="py-2.5 text-right">{m.meetingsScheduled}</td>
                    <td className="py-2.5 text-right">{m.meetingsAttended}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AIInsights data={summary} managerRating={managerRating} funnel={funnel} period={period} />
    </div>
  )
}
