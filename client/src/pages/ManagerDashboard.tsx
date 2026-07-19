import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { usePeriodStore } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import { FileText, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

function fmt(n: number) { return n.toLocaleString('ru') }

export default function ManagerDashboard() {
  const { period } = usePeriodStore()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-manager', period],
    queryFn: () => api.get(`/dashboard/manager?period=${period}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  if (!data) return null

  const { summary, todayReport, recentReports, type } = data
  const isCloser = type === 'CLOSER'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мой кабинет</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isCloser ? 'Клоузер' : 'Лидоруб'}</p>
        </div>
        <div>
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
      </div>

      {isCloser ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="План продаж" value={`₸ ${fmt(summary.salesPlan)}`} />
            <StatCard label="Продажи" value={`₸ ${fmt(summary.salesAmount)}`} color="blue" />
            <StatCard label="Выполнение" value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
            <StatCard label="Сделок" value={summary.salesCount} />
            <StatCard label="Конверсия" value={`${summary.conversion}%`} />
            <StatCard label="Средний чек" value={`₸ ${fmt(summary.avgCheck)}`} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="План лидов" value={summary.leadsplan} />
            <StatCard label="Получено лидов" value={summary.leadsReceived} color="blue" />
            <StatCard label="Выполнение" value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
            <StatCard label="Квалифицировано" value={summary.qualifiedLeads} />
          </div>
          <StatCard label="Конверсия в квалификацию" value={`${summary.conversion}%`} />
        </>
      )}

      <ProgressBar value={summary.planCompletion} label="Выполнение плана" />

      {/* Recent reports */}
      {recentReports?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">История отчётов</h3>
          <div className="space-y-2">
            {recentReports.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-600">{format(new Date(r.date), 'd MMM yyyy', { locale: ru })}</span>
                {isCloser ? (
                  <div className="flex gap-4 text-right">
                    <span className="text-gray-500">Продаж: <span className="font-medium text-gray-900">{(r.data as any).salesCount}</span></span>
                    <span className="text-gray-500">₸ <span className="font-medium text-gray-900">{fmt(Number((r.data as any).salesAmount))}</span></span>
                  </div>
                ) : (
                  <div className="flex gap-4 text-right">
                    <span className="text-gray-500">Лидов: <span className="font-medium text-gray-900">{(r.data as any).leadsReceived}</span></span>
                    <span className="text-gray-500">Квал.: <span className="font-medium text-gray-900">{(r.data as any).qualifiedLeads}</span></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
