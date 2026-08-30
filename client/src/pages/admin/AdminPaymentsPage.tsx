import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/adminClient'
import {
  DollarSign, TrendingUp, Building2, Download, ChevronDown, ChevronRight,
  Calendar, ExternalLink,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface MonthSummary {
  month: string        // YYYY-MM
  total: number
  count: number
  companiesCount: number
}

interface Payment {
  id: string
  amount: number
  paidAt: string
  periodFrom: string
  periodTo: string
  months: number
  note: string | null
  company: { id: string; name: string; subscriptionPlan: string | null }
}

interface Summary {
  months: MonthSummary[]
  allTimeTotal: number
  allTimeCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(n: number) {
  return `₸${n.toLocaleString('ru')}`
}

function fmtMonth(m: string) {
  const [y, mon] = m.split('-').map(Number)
  return new Date(y, mon - 1, 1).toLocaleString('ru', { month: 'long', year: 'numeric' })
}

const PLAN_LABELS: Record<string, string> = { trial: 'Триал', starter: 'Стартер', pro: 'Pro' }
const MONTHS_LABEL: Record<number, string> = { 1: '1 мес', 3: '3 мес', 6: '6 мес', 12: '1 год' }

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(payments: Payment[], month: string) {
  const header = ['Компания', 'Тариф', 'Дата оплаты', 'Период', 'Оплачено до', 'Сумма', 'Заметка']
  const rows = payments.map(p => [
    p.company.name,
    PLAN_LABELS[p.company.subscriptionPlan || ''] || p.company.subscriptionPlan || '',
    new Date(p.paidAt).toLocaleDateString('ru'),
    MONTHS_LABEL[p.months] || `${p.months} мес`,
    new Date(p.periodTo).toLocaleDateString('ru'),
    p.amount,
    p.note || '',
  ])

  const csv = [header, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `payments-${month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Month row component ──────────────────────────────────────────────────────
function MonthRow({ summary }: { summary: MonthSummary }) {
  const [open, setOpen] = useState(false)

  const { data: payments = [], isFetching } = useQuery<Payment[]>({
    queryKey: ['admin-payments', summary.month],
    queryFn: () => adminApi.get(`/api/admin/payments?month=${summary.month}`).then(r => r.data),
    enabled: open,
    staleTime: 60_000,
  })

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      {/* Month header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-800/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-gray-400">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Calendar className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <span className="text-white font-semibold capitalize">{fmtMonth(summary.month)}</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-right">
            <div className="text-emerald-400 font-bold">{fmtMoney(summary.total)}</div>
            <div className="text-gray-600 text-xs">{summary.count} платёж{summary.count === 1 ? '' : summary.count < 5 ? 'а' : 'ей'}</div>
          </div>
          <div className="text-right">
            <div className="text-gray-300 font-medium">{summary.companiesCount}</div>
            <div className="text-gray-600 text-xs">компани{summary.companiesCount === 1 ? 'я' : summary.companiesCount < 5 ? 'и' : 'й'}</div>
          </div>
          {open && (
            <button
              onClick={e => { e.stopPropagation(); exportCSV(payments, summary.month) }}
              disabled={isFetching || payments.length === 0}
              className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
        </div>
      </button>

      {/* Payments table — shown when open */}
      {open && (
        <div className="border-t border-gray-800">
          {isFetching ? (
            <div className="px-5 py-6 text-gray-500 text-sm flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" />
              Загрузка...
            </div>
          ) : payments.length === 0 ? (
            <div className="px-5 py-6 text-gray-600 text-sm">Нет данных</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800/60 bg-gray-900/50">
                    <th className="text-left px-5 py-3 font-medium">Компания</th>
                    <th className="text-left px-4 py-3 font-medium">Тариф</th>
                    <th className="text-left px-4 py-3 font-medium">Дата оплаты</th>
                    <th className="text-left px-4 py-3 font-medium">Период</th>
                    <th className="text-left px-4 py-3 font-medium">Действует до</th>
                    <th className="text-right px-5 py-3 font-medium">Сумма</th>
                    <th className="text-left px-4 py-3 font-medium">Заметка</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => {
                    const isActive = new Date(p.periodTo) >= new Date()
                    return (
                      <tr key={p.id} className={`border-b border-gray-800/30 last:border-0 hover:bg-gray-800/20 transition-colors ${isActive ? 'bg-emerald-950/10' : ''}`}>
                        <td className="px-5 py-3.5">
                          <Link
                            to={`/sys-ctl-9x7/companies/${p.company.id}`}
                            className="text-white hover:text-blue-400 transition-colors flex items-center gap-1.5 group"
                          >
                            {p.company.name}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            p.company.subscriptionPlan === 'pro'
                              ? 'bg-green-900/30 text-green-300 border-green-800'
                              : p.company.subscriptionPlan === 'starter'
                              ? 'bg-blue-900/30 text-blue-300 border-blue-800'
                              : 'bg-gray-800 text-gray-400 border-gray-700'
                          }`}>
                            {PLAN_LABELS[p.company.subscriptionPlan || ''] || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-300">
                          {new Date(p.paidAt).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                            {MONTHS_LABEL[p.months] || `${p.months} мес`}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">
                              {new Date(p.periodTo).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            {isActive && (
                              <span className="text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-800 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                активен
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-emerald-400 whitespace-nowrap">
                          {fmtMoney(p.amount)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500">
                          {p.note || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-800 bg-gray-900/60">
                    <td colSpan={5} className="px-5 py-3 text-xs text-gray-500 font-medium">
                      Итого за месяц
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-400">
                      {fmtMoney(payments.reduce((s, p) => s + p.amount, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminPaymentsPage() {
  const { data: summary, isLoading } = useQuery<Summary>({
    queryKey: ['admin-payments-summary'],
    queryFn: () => adminApi.get('/api/admin/payments/summary').then(r => r.data),
    refetchInterval: 60_000,
  })

  // Export ALL payments
  const handleExportAll = async () => {
    const { data } = await adminApi.get('/api/admin/payments')
    exportCSV(data, 'all')
  }

  const months = summary?.months || []

  // Last 3 months quick stats
  const last3 = months.slice(0, 3)
  const last3Total = last3.reduce((s, m) => s + m.total, 0)
  const activeCompanies = last3.length > 0 ? Math.max(...last3.map(m => m.companiesCount)) : 0

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Оплаты</h1>
          <p className="text-gray-400 text-sm">История платежей по всем компаниям</p>
        </div>
        <button
          onClick={handleExportAll}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Экспорт всех
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Всего получено
          </div>
          <div className="text-2xl font-bold text-white">
            {isLoading ? '—' : fmtMoney(summary?.allTimeTotal || 0)}
          </div>
          <div className="text-xs text-gray-600 mt-1">{summary?.allTimeCount || 0} платежей</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            За последние 3 месяца
          </div>
          <div className="text-2xl font-bold text-white">
            {isLoading ? '—' : fmtMoney(last3Total)}
          </div>
          <div className="text-xs text-gray-600 mt-1">{last3.reduce((s, m) => s + m.count, 0)} платежей</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
            <Building2 className="w-4 h-4 text-purple-400" />
            Платящих компаний
          </div>
          <div className="text-2xl font-bold text-white">
            {isLoading ? '—' : activeCompanies}
          </div>
          <div className="text-xs text-gray-600 mt-1">за последние 3 мес</div>
        </div>
      </div>

      {/* Mini bar chart — last 6 months */}
      {months.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-4">Выручка по месяцам</h2>
          <div className="flex items-end gap-2 h-20">
            {months.slice(0, 12).reverse().map(m => {
              const maxTotal = Math.max(...months.slice(0, 12).map(x => x.total), 1)
              const pct = (m.total / maxTotal) * 100
              const isCurrentMonth = m.month === new Date().toISOString().slice(0, 7)
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {fmtMoney(m.total)}
                  </div>
                  <div className="w-full flex items-end justify-center" style={{ height: '56px' }}>
                    <div
                      className={`w-full rounded-t-md transition-all ${isCurrentMonth ? 'bg-emerald-500' : 'bg-emerald-900/60 group-hover:bg-emerald-700'}`}
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 truncate w-full text-center">
                    {new Date(m.month + '-01').toLocaleString('ru', { month: 'short' })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Month list with drill-down */}
      <h2 className="text-sm font-semibold text-gray-400 mb-3">По месяцам</h2>

      {isLoading ? (
        <div className="text-gray-500 text-sm flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" />
          Загрузка...
        </div>
      ) : months.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
            <DollarSign className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-gray-500">Платежей ещё нет</p>
          <p className="text-gray-600 text-sm mt-1">Добавьте первый платёж через страницу компании</p>
        </div>
      ) : (
        <div className="space-y-2">
          {months.map(m => <MonthRow key={m.month} summary={m} />)}
        </div>
      )}
    </div>
  )
}
