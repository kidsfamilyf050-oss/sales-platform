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
  const todayData = todayReport?.data as any

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мой кабинет</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isCloser ? 'Клоузер' : 'Лидоруб'}</p>
        </div>
        <div>
          {todayReport ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded-lg text-sm font-medium">
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
          {/* Month stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="План продаж" value={`₸ ${fmt(summary.salesPlan)}`} />
            <StatCard label="Продажи за период" value={`₸ ${fmt(summary.salesAmount)}`} color="blue" />
            <StatCard label="Выполнение" value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
            <StatCard label="Сделок" value={summary.salesCount} />
            <StatCard label="Конверсия" value={`${summary.conversion}%`} />
            <StatCard label="Средний чек" value={`₸ ${fmt(summary.avgCheck)}`} />
          </div>

          <ProgressBar value={summary.planCompletion} label="Выполнение плана продаж" />

          {/* Today */}
          {todayData && (
            <div className="card border-blue-100 bg-blue-50/30">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Сегодня</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">Сумма продаж</p><p className="font-bold text-gray-900 mt-0.5">₸ {fmt(Number(todayData.salesAmount) || 0)}</p></div>
                <div><p className="text-xs text-gray-400">Сделок</p><p className="font-bold text-gray-900 mt-0.5">{todayData.salesCount || 0}</p></div>
                <div><p className="text-xs text-gray-400">Входящих заявок</p><p className="font-bold text-gray-900 mt-0.5">{todayData.clients || 0}</p></div>
                <div><p className="text-xs text-gray-400">Встреч / звонков</p><p className="font-bold text-gray-900 mt-0.5">{todayData.consultations || 0}</p></div>
              </div>
              {todayReport.comment && (
                <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-blue-100">💬 {todayReport.comment}</p>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Month stats — Lider */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="План лидов" value={summary.leadsplan} />
            <StatCard label="Лидов получено" value={summary.leads} color="blue" />
            <StatCard label="Выполнение" value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
            <StatCard label="Квалифицировано" value={summary.qualifiedLeads} />
            <StatCard label="% квалификации" value={`${summary.qualRate}%`} />
            <StatCard label="Пришло на встречу" value={summary.meetingsAttended} />
          </div>

          <ProgressBar value={summary.planCompletion} label="Выполнение плана лидогенерации" />

          {/* Today */}
          {todayData && (
            <div className="card border-purple-100 bg-purple-50/30">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Сегодня</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">Лидов</p><p className="font-bold text-gray-900 mt-0.5">{todayData.leads || 0}</p></div>
                <div><p className="text-xs text-gray-400">Квалиф.</p><p className="font-bold text-gray-900 mt-0.5">{todayData.qualifiedLeads || 0}</p></div>
                <div><p className="text-xs text-gray-400">Записано</p><p className="font-bold text-gray-900 mt-0.5">{todayData.meetingsScheduled || 0}</p></div>
                <div><p className="text-xs text-gray-400">Пришло</p><p className="font-bold text-gray-900 mt-0.5">{todayData.meetingsAttended || 0}</p></div>
              </div>
              {todayReport.comment && (
                <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-purple-100">💬 {todayReport.comment}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Recent reports */}
      {recentReports?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">История отчётов</h3>
          <div className="space-y-0">
            {recentReports.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-500 w-24 shrink-0">{format(new Date(r.date), 'd MMM', { locale: ru })}</span>
                {isCloser ? (
                  <div className="flex gap-6 text-right">
                    <span className="text-gray-500">Сделок: <span className="font-medium text-gray-900">{(r.data as any).salesCount || 0}</span></span>
                    <span className="text-gray-500">Сумма: <span className="font-medium text-gray-900">₸ {fmt(Number((r.data as any).salesAmount) || 0)}</span></span>
                  </div>
                ) : (
                  <div className="flex gap-6 text-right">
                    <span className="text-gray-500">Лидов: <span className="font-medium text-gray-900">{(r.data as any).leads || 0}</span></span>
                    <span className="text-gray-500">Квал.: <span className="font-medium text-gray-900">{(r.data as any).qualifiedLeads || 0}</span></span>
                    <span className="text-gray-500">Пришло: <span className="font-medium text-gray-900">{(r.data as any).meetingsAttended || 0}</span></span>
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
