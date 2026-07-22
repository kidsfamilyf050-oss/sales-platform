import { useEffect, useState } from 'react'
import { adminApi } from '../../api/adminClient'
import { Building2, Users, FileText, Activity, TrendingUp, TrendingDown, Trash2 } from 'lucide-react'

interface Stats {
  totalCompanies: number
  activeCompanies: number
  inactiveCompanies: number
  totalUsers: number
  activeUsers: number
  totalReports: number
  uniqueActiveToday: number
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number; sub?: string; icon: any; color: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    adminApi.get('/api/admin/stats')
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleResetAll = async () => {
    if (!window.confirm('ВНИМАНИЕ! Удалить ВСЕ продажи, отчёты и CRM-ссылки во ВСЕХ компаниях? Это необратимо.')) return
    if (!window.confirm('Подтвердите ещё раз: все данные будут удалены навсегда.')) return
    setResetting(true)
    try {
      const r = await adminApi.post('/api/admin/reset-all-data', { confirm: 'RESET_ALL' })
      alert(`Готово! Удалено: лидов — ${r.data.deleted.leads}, задач — ${r.data.deleted.leadTasks}, продаж — ${r.data.deleted.sales}, отчётов — ${r.data.deleted.reports}, CRM-ссылок — ${r.data.deleted.dealLinks}`)
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Ошибка при сбросе')
    } finally {
      setResetting(false)
    }
  }

  if (loading) return (
    <div className="p-8 text-gray-500 flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" />
      Загрузка статистики...
    </div>
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Обзор платформы</h1>
        <p className="text-gray-500 text-sm mt-1">Сводная статистика по всем компаниям</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Всего компаний" value={stats?.totalCompanies || 0} icon={Building2} color="bg-blue-600" />
        <StatCard
          label="Активные компании"
          value={stats?.activeCompanies || 0}
          sub={`${stats?.inactiveCompanies || 0} заблокировано`}
          icon={TrendingUp}
          color="bg-green-600"
        />
        <StatCard
          label="Всего пользователей"
          value={stats?.totalUsers || 0}
          sub={`${stats?.activeUsers || 0} активных`}
          icon={Users}
          color="bg-purple-600"
        />
        <StatCard label="Отчётов всего" value={stats?.totalReports || 0} icon={FileText} color="bg-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-500" />
            Активность сегодня
          </h2>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-4xl font-bold text-white">{stats?.uniqueActiveToday || 0}</div>
              <div className="text-sm text-gray-400">уникальных входов за 24ч</div>
            </div>
            <div className={`flex items-center gap-1 text-sm ${(stats?.uniqueActiveToday || 0) > 0 ? 'text-green-400' : 'text-gray-600'}`}>
              {(stats?.uniqueActiveToday || 0) > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {(stats?.uniqueActiveToday || 0) > 0 ? 'Есть активность' : 'Нет активности'}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Быстрые действия</h2>
          <div className="space-y-2">
            <a href="/admin/companies" className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 text-sm">
              <Building2 className="w-4 h-4 text-blue-400" />
              Управление компаниями
            </a>
            <a href="/admin/users" className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 text-sm">
              <Users className="w-4 h-4 text-purple-400" />
              Все пользователи
            </a>
            <a href="/admin/companies/new" className="flex items-center gap-3 p-3 bg-red-900/30 hover:bg-red-900/50 border border-red-800 rounded-lg transition-colors text-red-300 text-sm">
              <Building2 className="w-4 h-4" />
              + Создать компанию вручную
            </a>
            <button
              onClick={handleResetAll}
              disabled={resetting}
              className="w-full flex items-center gap-3 p-3 bg-red-950/50 hover:bg-red-950 border border-red-700 rounded-lg transition-colors text-red-400 text-sm disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {resetting ? 'Удаление...' : '🗑 Сбросить ВСЕ данные (лиды, продажи, отчёты)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
