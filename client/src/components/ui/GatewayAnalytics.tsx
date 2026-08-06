import { useT } from '../../i18n'

interface GatewayRow {
  method: string
  count: number
  grossAmount: number
  netAmount: number
  pct: number
}

const GATEWAY_LABELS: Record<string, string> = {
  GetPay: 'GetPay',
  TipTopPay_KZ: 'Tip Top Pay (КЗ)',
  TipTopPay_Foreign: 'Tip Top Pay (зарубеж.)',
  Kaspi_Gold: 'Каспи (GOLD)',
  Kaspi_Account: 'Каспи (Счёт)',
  Kaspi_Credit: 'Каспи (CREDIT)',
  Kaspi_Red: 'Каспи (RED)',
  Kaspi_Terminal: 'Apple/Google Pay',
  Cash: 'Наличные',
  Transfer_AE: 'Перевод АЕ',
  Card_Sberbank: 'Карта / СберБанк',
  Kaspi_Bookkeeper: 'Каспи (бухгалтер)',
}

const GATEWAY_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
  'bg-teal-500', 'bg-pink-500', 'bg-lime-500', 'bg-red-500',
]

function fmt(n: number) { return n.toLocaleString('ru') }

interface Props {
  data: GatewayRow[]
  compact?: boolean
}

export default function GatewayAnalytics({ data, compact = false }: Props) {
  const { t } = useT()

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">{t('dash.gateway.noData')}</div>
    )
  }

  const maxPct = Math.max(...data.map(g => g.pct), 1)

  return (
    <div className="space-y-2.5">
      {data.map((g, i) => {
        const label = GATEWAY_LABELS[g.method] ?? g.method
        const color = GATEWAY_COLORS[i % GATEWAY_COLORS.length]
        const fee = g.grossAmount > 0 ? Math.round((1 - g.netAmount / g.grossAmount) * 1000) / 10 : 0
        const lost = g.grossAmount - g.netAmount

        return (
          <div key={g.method} className="group">
            <div className="flex items-center justify-between mb-1 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                <span className="text-sm font-medium text-gray-800 truncate">{label}</span>
                {!compact && (
                  <span className="text-xs text-gray-400 shrink-0">
                    {fee > 0 ? `−${fee}%` : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 text-right">
                <span className="text-xs text-gray-400">{g.count} {t('dash.gateway.dealsShort')}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">₸ {fmt(Math.round(g.netAmount))}</span>
                  {!compact && g.grossAmount !== g.netAmount && (
                    <span className="text-xs text-gray-400 ml-1.5 line-through">₸ {fmt(Math.round(g.grossAmount))}</span>
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-500 w-10 text-right">{g.pct}%</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${color} opacity-80`}
                style={{ width: `${(g.pct / maxPct) * 100}%` }}
              />
            </div>
            {!compact && lost > 0 && (
              <div className="text-xs text-gray-400 mt-0.5 text-right">
                {t('dash.gateway.commission')} ₸ {fmt(Math.round(lost))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
