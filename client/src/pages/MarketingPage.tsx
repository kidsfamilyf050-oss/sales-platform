import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { ChevronLeft, ChevronRight, Save, CheckCircle } from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPeriod(d: Date) { return d.toISOString().slice(0, 7) }
function formatMonth(p: string) {
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const [y, m] = p.split('-')
  return `${months[+m - 1]} ${y}`
}
function shiftMonth(p: string, d: number) {
  const [y, m] = p.split('-').map(Number)
  return getPeriod(new Date(y, m - 1 + d, 1))
}
function daysInMonth(p: string) {
  const [y, m] = p.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'М'
  if (n >= 1_000) return Math.round(n / 1_000) + 'тыс'
  return String(n)
}

const FIELDS = [
  { key: 'leads',          label: 'Лидов получено',        unit: 'шт', hint: 'Новых лидов за день' },
  { key: 'qualifiedLeads', label: 'Квалифицированных',      unit: 'шт', hint: 'Лидов прошло квалификацию' },
  { key: 'budget',         label: 'Рекламный бюджет',       unit: '₸',  hint: 'Потрачено на рекламу за день' },
]

// ─── Stat card ───────────────────────────────────────────────────────────────

function Card({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const todayStr = new Date().toISOString().slice(0, 10)
  const [period, setPeriod] = useState(getPeriod(new Date()))
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [vals, setVals] = useState<Record<string, string>>({ leads: '', qualifiedLeads: '', budget: '' })
  const [comment, setComment] = useState('')
  const [saved, setSaved] = useState(false)

  const totalDays = daysInMonth(period)
  const periodStart = `${period}-01`
  const periodEnd = `${period}-${String(totalDays).padStart(2, '0')}`

  // Fetch all company reports, filter to MARKETER type for this period
  const { data: allReports = [] } = useQuery({
    queryKey: ['reports-company', period],
    queryFn: () => api.get(`/reports/company?from=${periodStart}&to=${periodEnd}`).then(r => r.data),
  })

  const reports = useMemo(
    () => (allReports as any[]).filter((r: any) => r.type === 'MARKETER'),
    [allReports]
  )

  // Fetch plans for marketing
  const { data: plans = [] } = useQuery({
    queryKey: ['plans', period],
    queryFn: () => api.get(`/plans?period=${period}`).then(r => r.data),
  })

  // Compute summary
  const leadsplan = (plans as any[]).find((p: any) => p.type === 'LEADS' && !p.userId && !p.departmentId)?.value || 0
  const budgetPlan = (plans as any[]).find((p: any) => p.type === 'BUDGET' && !p.userId && !p.departmentId)?.value || 0

  const totalLeads = reports.reduce((s: number, r: any) => s + (Number(r.data?.leads) || 0), 0)
  const totalQualified = reports.reduce((s: number, r: any) => s + (Number(r.data?.qualifiedLeads) || 0), 0)
  const totalBudget = reports.reduce((s: number, r: any) => s + (Number(r.data?.budget) || 0), 0)
  const leadCost = totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0
  const qualLeadCost = totalQualified > 0 ? Math.round(totalBudget / totalQualified) : 0
  const planPct = leadsplan > 0 ? Math.round((totalLeads / leadsplan) * 100) : 0

  // Reports by date map
  const byDate = useMemo(() => {
    const m: Record<string, any> = {}
    reports.forEach((r: any) => { m[r.date.slice(0, 10)] = r })
    return m
  }, [reports])

  // Prefill form when date changes
  const existingReport = byDate[selectedDate]

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => api.post('/reports/for-user', {
      userId: user!.id,
      date: selectedDate,
      type: 'MARKETER',
      data: Object.fromEntries(FIELDS.map(f => [f.key, vals[f.key] ? +vals[f.key] : 0])),
      comment,
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['reports-company', period] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  function handleDateChange(date: string) {
    setSelectedDate(date)
    const r = byDate[date]
    if (r) {
      setVals({ leads: String(r.data?.leads || ''), qualifiedLeads: String(r.data?.qualifiedLeads || ''), budget: String(r.data?.budget || '') })
      setComment(r.comment || '')
    } else {
      setVals({ leads: '', qualifiedLeads: '', budget: '' })
      setComment('')
    }
  }

  const today = new Date()
  const todayPeriod = getPeriod(today)
  const todayDay = period === todayPeriod ? today.getDate() : null
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Маркетинг</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ввод данных по лидогенерации и рекламному бюджету</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => { setPeriod(p => shiftMonth(p, -1)) }} className="p-1.5 hover:bg-white rounded-md transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="px-3 text-sm font-semibold text-gray-800 min-w-[140px] text-center">{formatMonth(period)}</span>
          <button
            onClick={() => { setPeriod(p => shiftMonth(p, 1)) }}
            disabled={period >= todayPeriod}
            className="p-1.5 hover:bg-white rounded-md transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Лиды (план)" value={leadsplan || '—'} />
        <Card label="Лиды (факт)" value={totalLeads} sub={leadsplan ? `${planPct}% выполнения` : undefined} highlight={totalLeads > 0} />
        <Card label="Квалифицировано" value={totalQualified} sub={totalLeads > 0 ? `${Math.round(totalQualified/totalLeads*100)}% квалификации` : undefined} />
        <Card label="Стоимость лида" value={leadCost ? `₸ ${fmt(leadCost)}` : '—'} />
        <Card label="Бюджет (план)" value={budgetPlan ? `₸ ${fmt(budgetPlan)}` : '—'} />
        <Card label="Бюджет (факт)" value={totalBudget ? `₸ ${fmt(totalBudget)}` : '—'} />
        <Card label="Ст-ть квал. лида" value={qualLeadCost ? `₸ ${fmt(qualLeadCost)}` : '—'} />
        <Card label="Дней с данными" value={`${reports.length} / ${totalDays}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily entry form */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Ввод за день</h2>

          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm font-medium text-gray-700">Дата:</label>
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={e => handleDateChange(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {existingReport && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Данные есть
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            {FIELDS.map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                <div className="relative">
                  <input
                    type="number" min="0"
                    value={vals[f.key]}
                    onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder="—"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{f.unit}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{f.hint}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Комментарий (необязательно)"
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || Object.values(vals).every(v => !v)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            >
              {saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? 'Сохранено' : 'Сохранить'}
            </button>
          </div>

          {saveMutation.isError && (
            <p className="text-xs text-red-500 mt-2">Ошибка сохранения. Попробуйте ещё раз.</p>
          )}
        </div>

        {/* Quick stats for selected date */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Данные за {new Date(selectedDate + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </h2>
          {existingReport ? (
            <div className="space-y-3">
              {FIELDS.map(f => (
                <div key={f.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{f.label}</span>
                  <span className="font-semibold text-gray-900">
                    {f.unit === '₸' ? `₸ ${fmt(Number(existingReport.data?.[f.key]) || 0)}` : (existingReport.data?.[f.key] || 0)}
                    <span className="text-xs text-gray-400 ml-1">{f.unit !== '₸' ? f.unit : ''}</span>
                  </span>
                </div>
              ))}
              {existingReport.comment && (
                <p className="text-xs text-gray-500 pt-2">💬 {existingReport.comment}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              Данных за этот день нет
            </div>
          )}
        </div>
      </div>

      {/* Monthly table */}
      {reports.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Таблица по дням — {formatMonth(period)}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium text-gray-500 border-r border-gray-200 min-w-[148px]">Показатель</th>
                  {days.map(d => {
                    const isToday = d === todayDay
                    const dateStr = `${period}-${String(d).padStart(2, '0')}`
                    const dow = ['вс','пн','вт','ср','чт','пт','сб'][new Date(dateStr).getDay()]
                    return (
                      <th key={d} className={`px-1 py-1.5 font-medium border-r border-gray-100 text-center w-[52px] min-w-[52px] ${isToday ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}>
                        <div>{d}</div>
                        <div className="text-gray-400 font-normal">{dow}</div>
                      </th>
                    )
                  })}
                  <th className="px-3 py-2 font-semibold text-center text-gray-700 bg-gray-100 border-l border-gray-200 min-w-[64px]">Итого</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((f, rowIdx) => {
                  const rowTotal = reports.reduce((s: number, r: any) => s + (Number(r.data?.[f.key]) || 0), 0)
                  return (
                    <tr key={f.key} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-r border-gray-200 font-medium text-gray-600 whitespace-nowrap">
                        {f.label} <span className="text-gray-400 font-normal text-[10px]">{f.unit}</span>
                      </td>
                      {days.map(d => {
                        const dateStr = `${period}-${String(d).padStart(2, '0')}`
                        const isToday = d === todayDay
                        const isFuture = todayDay ? d > todayDay : false
                        const r = byDate[dateStr]
                        const val = r ? Number(r.data?.[f.key]) || 0 : null
                        return (
                          <td key={d} className={`px-1 py-2 border-r border-gray-100 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                            {isFuture ? (
                              <span className="text-gray-200">·</span>
                            ) : val !== null ? (
                              <span className="font-medium text-gray-800">{f.unit === '₸' ? fmt(val) : val}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center font-bold border-l border-gray-200 bg-gray-50 text-gray-700">
                        {rowTotal > 0 ? (f.unit === '₸' ? fmt(rowTotal) : rowTotal) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
