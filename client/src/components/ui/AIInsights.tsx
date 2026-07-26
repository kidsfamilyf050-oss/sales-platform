import { useState, useEffect, useRef } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { api } from '../../api/client'
import { useT } from '../../i18n'

interface AIInsightsProps {
  data: Record<string, any>
  managerRating?: any[]
  liderRating?: any[]
  funnel?: Record<string, number>
  productStats?: any[]
  period?: string
  autoLoad?: boolean
}

// Strip emoji characters from a string
function stripEmoji(str: string): string {
  return str.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim()
}

// Parse AI text into structured blocks for better display
function parseInsights(text: string): { emoji: string; title: string; content: string }[] {
  const blocks: { emoji: string; title: string; content: string }[] = []
  const lines = text.split('\n').filter(l => l.trim())
  let current: { emoji: string; title: string; lines: string[] } | null = null

  for (const line of lines) {
    // Detect header lines: emoji + CAPS or emoji + text ending with ':'
    const headerMatch = line.match(/^([🔥⚡📈📉🎯💪💰🚀🏆⚠️🔴✅📊📋👥💡🔍📞📅]+)\s+(.+)/)
    if (headerMatch && (line.includes(':') || /[А-ЯA-Z]{3,}/.test(line))) {
      if (current) blocks.push({ emoji: current.emoji, title: current.title, content: current.lines.join('\n') })
      current = { emoji: headerMatch[1], title: stripEmoji(headerMatch[2]).replace(/:$/, '').trim(), lines: [] }
    } else if (current) {
      current.lines.push(stripEmoji(line))
    } else {
      // First paragraph before any header
      blocks.push({ emoji: '📊', title: '', content: stripEmoji(line) })
    }
  }
  if (current) blocks.push({ emoji: current.emoji, title: current.title, content: current.lines.join('\n') })
  return blocks.filter(b => b.content.trim() || b.title.trim())
}

function severityColor(emoji: string): string {
  if (['🔴', '⚠️'].includes(emoji)) return 'border-l-red-400 bg-red-50/40'
  if (['✅', '🏆', '📈'].includes(emoji)) return 'border-l-green-400 bg-green-50/40'
  if (['🚀', '⚡', '🎯'].includes(emoji)) return 'border-l-blue-400 bg-blue-50/40'
  if (['💰', '💡'].includes(emoji)) return 'border-l-amber-400 bg-amber-50/40'
  return 'border-l-gray-200 bg-gray-50/40'
}

export default function AIInsights({ data, managerRating, liderRating, funnel, productStats, period, autoLoad = true }: AIInsightsProps) {
  const { t, lang } = useT()
  const [insights, setInsights] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const loadedRef = useRef(false)

  const getInsights = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await api.post('/ai/insights', {
        summary: data,
        managerRating,
        liderRating,
        funnel,
        productStats,
        period: period || 'текущий месяц',
        lang,
      })
      setInsights(res.data.insights)
    } catch {
      setError(true)
      setInsights(t('ai.error'))
    } finally {
      setLoading(false)
    }
  }

  // Auto-load once when data arrives
  useEffect(() => {
    if (autoLoad && !loadedRef.current && Object.keys(data).length > 0) {
      loadedRef.current = true
      getInsights()
    }
  }, [data])

  const blocks = insights ? parseInsights(insights) : []

  return (
    <div className="card border border-blue-100 bg-gradient-to-br from-white to-blue-50/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-white" style={{ width: '18px', height: '18px' }} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{t('ai.title')}</h3>
            <p className="text-xs text-gray-400">Персональный анализ на основе ваших данных</p>
          </div>
        </div>
        <button
          onClick={getInsights}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Анализирую...' : 'Обновить'}
        </button>
      </div>

      {loading && !insights && (
        <div className="space-y-2.5 animate-pulse">
          {[80, 60, 90, 70].map((w, i) => (
            <div key={i} className="h-3 bg-blue-100 rounded-full" style={{ width: `${w}%` }} />
          ))}
          <p className="text-xs text-blue-400 mt-3">Анализирую ваши показатели...</p>
        </div>
      )}

      {!loading && !insights && (
        <div className="text-center py-4">
          <Sparkles className="w-8 h-8 text-blue-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Нажмите «Обновить» для получения анализа</p>
        </div>
      )}

      {insights && blocks.length > 0 && (
        <div className="space-y-2.5">
          {blocks.map((block, i) => (
            <div key={i} className={`border-l-2 pl-3 py-1.5 rounded-r-lg ${severityColor(block.emoji)}`}>
              {block.title && (
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  {block.title}
                </p>
              )}
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {block.content}
              </div>
            </div>
          ))}
          {loading && (
            <p className="text-xs text-blue-400 animate-pulse">Обновляю анализ...</p>
          )}
        </div>
      )}

      {insights && blocks.length === 0 && (
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{insights}</div>
      )}
    </div>
  )
}
