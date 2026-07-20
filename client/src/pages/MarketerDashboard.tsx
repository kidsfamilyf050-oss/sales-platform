import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { usePeriodStore } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { FileText, CheckCircle } from 'lucide-react'
import { useT } from '../i18n'

function fmt(n: number) { return n.toLocaleString('ru') }

export default function MarketerDashboard() {
  const { t } = useT()
  const { period } = usePeriodStore()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-marketer', period],
    queryFn: () => api.get(`/dashboard/marketer?period=${period}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>
  if (!data) return null

  const { summary, dailyChart, todayReport } = data

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dash.marketer.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('dash.marketer.subtitle')}</p>
        </div>
        {todayReport ? (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            {t('dash.marketer.reportDone')}
          </div>
        ) : (
          <button onClick={() => navigate('/report')} className="btn-primary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('dash.marketer.fillReport')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard label={t('dash.marketer.leadsplan')} value={summary.leadsplan} />
        <StatCard label={t('dash.marketer.received')} value={summary.totalLeads} color="blue" />
        <StatCard label={t('dash.completion')} value={`${summary.planCompletion}%`} color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
        <StatCard label={t('dash.marketer.qualLeads')} value={summary.totalQualified} />
        <StatCard label={t('dash.leadCost')} value={`₸ ${fmt(summary.leadCost)}`} />
        <StatCard label={t('dash.marketer.budget')} value={`₸ ${fmt(summary.totalBudget)}`} sub={`${t('dash.plan')} ₸ ${fmt(summary.budgetPlan)}`} />
      </div>

      <ProgressBar value={summary.planCompletion} label={t('dash.marketer.planCompletion')} />

      <div className="grid grid-cols-2 gap-4">
        <StatCard label={t('dash.marketer.avgPerDay')} value={summary.avgLeadsPerDay} />
        <StatCard label={t('dash.marketer.projected')} value={summary.projectedLeads} sub={t('dash.marketer.projectedNote')} color={summary.projectedLeads >= summary.leadsplan ? 'green' : 'yellow'} />
      </div>

      {/* Charts */}
      {dailyChart?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">{t('dash.marketer.chartLeads')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyChart}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leads" name={t('dash.leads')} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="qualified" name={t('dash.table.qualified')} fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">{t('dash.marketer.chartBudget')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyChart}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₸ ${fmt(v)}`} />
                <Line type="monotone" dataKey="budget" name={t('dash.rop.budgetLabel')} stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <AIInsights data={summary} period={period} />
    </div>
  )
}
