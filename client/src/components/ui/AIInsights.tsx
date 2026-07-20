import { useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { api } from '../../api/client'
import { useT } from '../../i18n'

interface AIInsightsProps {
  data: Record<string, any>
  managerRating?: any[]
  funnel?: Record<string, number>
  period?: string
}

export default function AIInsights({ data, managerRating, funnel, period }: AIInsightsProps) {
  const { t } = useT()
  const [insights, setInsights] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const getInsights = async () => {
    setLoading(true)
    try {
      const res = await api.post('/ai/insights', { summary: data, managerRating, funnel, period: period || 'текущий месяц' })
      setInsights(res.data.insights)
    } catch {
      setInsights(t('ai.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">{t('ai.title')}</h3>
        </div>
        <button
          onClick={getInsights}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {insights ? t('ai.update') : t('ai.getRecommendations')}
        </button>
      </div>
      {insights ? (
        <div className="text-sm text-gray-700 space-y-2 whitespace-pre-wrap leading-relaxed">{insights}</div>
      ) : (
        <p className="text-sm text-gray-400">{t('ai.hint')}</p>
      )}
    </div>
  )
}
