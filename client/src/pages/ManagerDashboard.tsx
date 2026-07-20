import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { usePeriodStore } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import { FileText, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useT } from '../i18n'

function fmt(n: number) { return n.toLocaleString('ru') }

export default function ManagerDashboard() {
  const { t } = useT()
  const { period } = usePeriodStore()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-manager', period],
    queryFn: () => api.get(`/dashboard/manager?period=${period}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>
  if (!data) return null

  const { summary, todayReport, recentReports, type } = data
  const isCloser = type === 'CLOSER'
  const todayData = todayReport?.data as any

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dash.manager.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isCloser ? t('role.closer') : t('role.lider')}</p>
        </div>
        <div>
          {todayReport ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded-lg text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              {t('dash.manager.reportDone')}
            </div>
          ) : (
            <button onClick={() => navigate('/report')} className="btn-primary flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('dash.manager.fillReport')}
            </button>
          )}
        </div>
      </div>

      {isCloser ? (
        <>
          {/* Month stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label={t('dash.manager.salesPlan')} value={`₸ ${fmt(summary.salesPlan)}`} />
            <StatCard label={t('dash.manager.salesPeriod')} value={`₸ ${fmt(summary.salesAmount)}`} color="blue" />
            <StatCard label={t('dash.completion')} value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
            <StatCard label={t('dash.manager.deals')} value={summary.salesCount} />
            <StatCard label={t('dash.conversion')} value={`${summary.conversion}%`} />
            <StatCard label={t('dash.avgCheck')} value={`₸ ${fmt(summary.avgCheck)}`} />
          </div>

          <ProgressBar value={summary.planCompletion} label={t('dash.manager.planCompletionSales')} />

          {/* Today */}
          {todayData && (
            <div className="card border-blue-100 bg-blue-50/30">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">{t('dash.manager.today')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">{t('dash.manager.salesAmount')}</p><p className="font-bold text-gray-900 mt-0.5">₸ {fmt(Number(todayData.salesAmount) || 0)}</p></div>
                <div><p className="text-xs text-gray-400">{t('dash.manager.deals')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.salesCount || 0}</p></div>
                <div><p className="text-xs text-gray-400">{t('dash.manager.clients')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.clients || 0}</p></div>
                <div><p className="text-xs text-gray-400">{t('dash.manager.consultations')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.consultations || 0}</p></div>
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
            <StatCard label={t('dash.manager.leadsplan')} value={summary.leadsplan} />
            <StatCard label={t('dash.manager.leads')} value={summary.leads} color="blue" />
            <StatCard label={t('dash.completion')} value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
            <StatCard label={t('dash.manager.qualified')} value={summary.qualifiedLeads} />
            <StatCard label={t('dash.manager.qualRate')} value={`${summary.qualRate}%`} />
            <StatCard label={t('dash.manager.meetingsAttended')} value={summary.meetingsAttended} />
          </div>

          <ProgressBar value={summary.planCompletion} label={t('dash.manager.planCompletionLider')} />

          {/* Today */}
          {todayData && (
            <div className="card border-purple-100 bg-purple-50/30">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">{t('dash.manager.today')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">{t('dash.manager.leads')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.leads || 0}</p></div>
                <div><p className="text-xs text-gray-400">{t('dash.manager.qualified')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.qualifiedLeads || 0}</p></div>
                <div><p className="text-xs text-gray-400">{t('dash.manager.meetings')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.meetingsScheduled || 0}</p></div>
                <div><p className="text-xs text-gray-400">{t('dash.manager.attended')}</p><p className="font-bold text-gray-900 mt-0.5">{todayData.meetingsAttended || 0}</p></div>
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
          <h3 className="font-semibold text-gray-900 mb-4">{t('dash.manager.history')}</h3>
          <div className="space-y-0">
            {recentReports.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-500 w-24 shrink-0">{format(new Date(r.date), 'd MMM', { locale: ru })}</span>
                {isCloser ? (
                  <div className="flex gap-6 text-right">
                    <span className="text-gray-500">{t('dash.manager.dealsLabel')} <span className="font-medium text-gray-900">{(r.data as any).salesCount || 0}</span></span>
                    <span className="text-gray-500">{t('dash.manager.amountLabel')} <span className="font-medium text-gray-900">₸ {fmt(Number((r.data as any).salesAmount) || 0)}</span></span>
                  </div>
                ) : (
                  <div className="flex gap-6 text-right">
                    <span className="text-gray-500">{t('dash.manager.leadsLabel')} <span className="font-medium text-gray-900">{(r.data as any).leads || 0}</span></span>
                    <span className="text-gray-500">{t('dash.manager.qualLabel')} <span className="font-medium text-gray-900">{(r.data as any).qualifiedLeads || 0}</span></span>
                    <span className="text-gray-500">{t('dash.manager.attendedLabel')} <span className="font-medium text-gray-900">{(r.data as any).meetingsAttended || 0}</span></span>
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
