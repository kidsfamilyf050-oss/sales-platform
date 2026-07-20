import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import AIInsights from '../components/ui/AIInsights'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('ru') }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0 }

function getMonthRange(offset: number) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + offset
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    from: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`,
    to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
    label: first.toLocaleString('ru-RU', { month: 'long', year: 'numeric' }),
  }
}

// Mini funnel step
function FunnelStep({ label, value, sub, pctVal, color }: { label: string; value: number; sub?: string; pctVal?: number; color: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{fmt(value)}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      {pctVal !== undefined && (
        <div className={`text-xs font-semibold mt-1 ${pctVal >= 30 ? 'text-green-600' : pctVal >= 15 ? 'text-amber-500' : 'text-red-500'}`}>
          {pctVal}% конв.
        </div>
      )}
    </div>
  )
}

export default function OwnerDashboard() {
  const periodState = usePeriodStore()
  const [monthOffset, setMonthOffset] = useState(0)

  const queryParams = periodState.period === 'month'
    ? (() => { const r = getMonthRange(monthOffset); return `from=${r.from}&to=${r.to}` })()
    : buildPeriodParams(periodState)

  const queryKey = periodState.period === 'custom'
    ? ['dashboard-owner', 'custom', periodState.customFrom, periodState.customTo]
    : ['dashboard-owner', periodState.period, monthOffset]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => api.get(`/dashboard/owner?${queryParams}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  if (!data) return null

  const { summary, dailyChart, managerRating, liderRating } = data
  const monthRange = getMonthRange(monthOffset)

  // Funnel percentages
  const leadsToQual    = pct(summary.totalQualifiedLeads, summary.totalLeads)
  const qualToMeetings = pct(summary.totalMeetingsAttended, summary.totalQualifiedLeads)
  const meetingsToSale = pct(summary.totalSalesCount, summary.totalMeetingsAttended)
  const leadsToSale    = pct(summary.totalSalesCount, summary.totalLeads)

  const leadDeficit = summary.leadsplan > 0 ? summary.leadsplan - summary.totalLeads : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дашборд собственника</h1>
          <p className="text-gray-500 text-sm mt-0.5">Общая картина компании</p>
        </div>
        {periodState.period === 'month' && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 self-center">
            <button onClick={() => setMonthOffset(o => o - 1)} className="p-1.5 hover:bg-white rounded-md transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="px-3 text-sm font-semibold text-gray-800 min-w-[150px] text-center">
              {monthRange.label.replace(' г.', '').replace(' г', '')}
            </span>
            <button
              onClick={() => setMonthOffset(o => Math.min(0, o + 1))}
              disabled={monthOffset >= 0}
              className="p-1.5 hover:bg-white rounded-md transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Row 1 — Sales */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard label="План продаж" value={`₸ ${fmt(summary.salesPlan)}`} />
        <StatCard label="Факт продаж" value={`₸ ${fmt(summary.totalSalesAmount)}`} color="blue" />
        <StatCard label="Выполнение" value={`${summary.planCompletion}%`}
          color={summary.planCompletion >= 75 ? 'green' : summary.planCompletion >= 50 ? 'yellow' : 'red'} />
        <StatCard label="Конверсия" value={`${summary.conversion}%`}
          sub={summary.conversionLabel}
          color={summary.conversion >= 20 ? 'green' : summary.conversion >= 10 ? 'yellow' : 'red'} />
        <StatCard label="Кол-во продаж" value={summary.totalSalesCount} />
        <StatCard label="Средний чек" value={`₸ ${fmt(summary.avgCheck)}`} />
      </div>

      <ProgressBar value={summary.planCompletion} label="Выполнение плана продаж" />

      {/* Row 2 — Marketing metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Лиды"
          value={summary.totalLeads}
          sub={`план: ${fmt(summary.leadsplan)}`}
          color={leadDeficit > 0 ? 'red' : 'green'}
          extraSub={leadDeficit > 0 ? <span className="text-red-500 text-xs font-semibold">−{fmt(leadDeficit)} отстаём</span> : undefined}
        />
        <StatCard label="Квалиф. лиды" value={summary.totalQualifiedLeads}
          sub={summary.totalLeads > 0 ? `${leadsToQual}% от лидов` : undefined} />
        <StatCard label="Стоимость лида" value={summary.leadCost ? `₸ ${fmt(summary.leadCost)}` : '—'}
          sub={summary.totalBudget > 0 ? 'факт. бюджет' : summary.budgetPlan > 0 ? 'план. бюджет' : undefined} />
        <StatCard label="Рекл. бюджет"
          value={summary.budgetPlan ? `₸ ${fmt(summary.budgetPlan)}` : summary.totalBudget ? `₸ ${fmt(summary.totalBudget)}` : '—'}
          sub={summary.totalBudget > 0 ? `факт: ₸ ${fmt(summary.totalBudget)}` : 'план'} />
      </div>

      {/* Funnel: Marketing → Sales */}
      {summary.totalLeads > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Воронка продаж</h3>
          <div className="flex items-start gap-2 overflow-x-auto pb-2">
            <FunnelStep label="Лиды" value={summary.totalLeads} color="text-blue-600" />
            <div className="flex items-center pt-4 flex-shrink-0">
              <ArrowRight className="w-4 h-4 text-gray-300" />
              <span className="text-xs text-gray-400 mx-1">{leadsToQual}%</span>
            </div>
            <FunnelStep label="Квалифицировано" value={summary.totalQualifiedLeads} color="text-purple-600" />
            {summary.totalMeetingsScheduled > 0 && (
              <>
                <div className="flex items-center pt-4 flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                  <span className="text-xs text-gray-400 mx-1">{qualToMeetings}%</span>
                </div>
                <FunnelStep label="Пришло на встречу" value={summary.totalMeetingsAttended}
                  sub={`запланировано: ${fmt(summary.totalMeetingsScheduled)}`} color="text-orange-600" />
              </>
            )}
            <div className="flex items-center pt-4 flex-shrink-0">
              <ArrowRight className="w-4 h-4 text-gray-300" />
              <span className="text-xs text-gray-400 mx-1">
                {summary.totalMeetingsAttended > 0 ? meetingsToSale : leadsToSale}%
              </span>
            </div>
            <FunnelStep label="Продажи" value={summary.totalSalesCount}
              sub={`₸ ${fmt(summary.totalSalesAmount)}`} color="text-green-600"
              pctVal={leadsToSale} />
          </div>

          {/* Conversion bar */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Лиды → квалиф.', val: leadsToQual },
              { label: 'Квалиф. → встречи', val: qualToMeetings },
              { label: 'Встречи → продажи', val: meetingsToSale },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-2.5">
                <div className={`text-lg font-bold ${item.val >= 30 ? 'text-green-600' : item.val >= 15 ? 'text-amber-500' : 'text-red-500'}`}>
                  {item.val}%
                </div>
                <div className="text-xs text-gray-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      {dailyChart?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Продажи по дням</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyChart}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `₸ ${fmt(v)}`} />
              <Legend />
              <Line type="monotone" dataKey="amount" name="Сумма продаж" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Closer Rating */}
      {managerRating?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-1">Рейтинг клоузеров</h3>
          <p className="text-xs text-gray-400 mb-4">По % выполнения плана продаж</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Менеджер</th>
                  <th className="pb-2 font-medium text-right">План</th>
                  <th className="pb-2 font-medium text-right">Факт</th>
                  <th className="pb-2 font-medium text-right">Выполнение</th>
                  <th className="pb-2 font-medium text-right">Сделок</th>
                  <th className="pb-2 font-medium text-right">Конверсия</th>
                  <th className="pb-2 font-medium text-right">Ср. чек</th>
                </tr>
              </thead>
              <tbody>
                {managerRating.map((m: any, i: number) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 text-gray-400 font-medium">{i + 1}</td>
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
                    <td className="py-2.5 text-right">₸ {fmt(m.avgCheck)}</td>
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
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Лидоруб</th>
                  <th className="pb-2 font-medium text-right">План лидов</th>
                  <th className="pb-2 font-medium text-right">Получено</th>
                  <th className="pb-2 font-medium text-right">Выполнение</th>
                  <th className="pb-2 font-medium text-right">Квалиф.</th>
                  <th className="pb-2 font-medium text-right">% квал.</th>
                  <th className="pb-2 font-medium text-right">На встречу</th>
                  <th className="pb-2 font-medium text-right">Пришло</th>
                </tr>
              </thead>
              <tbody>
                {liderRating.map((m: any, i: number) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 text-gray-400 font-medium">{i + 1}</td>
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

      <AIInsights data={summary} managerRating={managerRating} period={periodState.period} />
    </div>
  )
}
