import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '../../api/adminClient'
import { Clock, Search, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

interface AuditLog {
  id: string
  action: string
  description: string
  adminEmail: string | null
  targetType: string | null
  oldValue: string | null
  newValue: string | null
  companyName: string | null
  createdAt: string
}

const ACTION_COLORS: Record<string, string> = {
  COMPANY_PLAN_CHANGED: 'bg-blue-900/40 text-blue-300',
  COMPANY_ACTIVATED: 'bg-green-900/40 text-green-300',
  COMPANY_BLOCKED: 'bg-red-900/40 text-red-300',
  COMPANY_CREATED: 'bg-purple-900/40 text-purple-300',
  COMPANY_ACCESS_DATE_CHANGED: 'bg-yellow-900/40 text-yellow-300',
  USER_BLOCKED: 'bg-red-900/40 text-red-300',
  USER_ACTIVATED: 'bg-green-900/40 text-green-300',
  USER_ROLE_CHANGED: 'bg-blue-900/40 text-blue-300',
  USER_PASSWORD_RESET: 'bg-orange-900/40 text-orange-300',
  USER_NAME_CHANGED: 'bg-gray-700/60 text-gray-300',
  AUDIT_LOGS_CLEARED: 'bg-gray-700/60 text-gray-400',
}

function getDefaultDates() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export default function AdminAuditPage() {
  const defaults = getDefaultDates()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 50

  const [filters, setFilters] = useState({ from: defaults.from, to: defaults.to, search: '' })
  const [applied, setApplied] = useState({ from: defaults.from, to: defaults.to, search: '' })

  // Delete modal
  const [showDelete, setShowDelete] = useState(false)
  const [deleteRange, setDeleteRange] = useState({ from: defaults.from, to: defaults.to })
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<string | null>(null)

  const load = useCallback(async (p = page, f = applied) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (f.from) params.set('from', f.from)
      if (f.to) params.set('to', f.to)
      if (f.search) params.set('search', f.search)
      const r = await adminApi.get(`/api/admin/audit-logs?${params}`)
      setLogs(r.data.logs)
      setTotal(r.data.total)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page, applied])

  useEffect(() => { load(page, applied) }, [page])

  const applyFilters = () => {
    setApplied(filters)
    setPage(1)
    load(1, filters)
  }

  const doDelete = async () => {
    setDeleting(true)
    setDeleteResult(null)
    try {
      const r = await adminApi.delete('/api/admin/audit-logs', { data: deleteRange })
      setDeleteResult(`Удалено ${r.data.deleted} записей`)
      load(1, applied)
      setPage(1)
    } catch { setDeleteResult('Ошибка удаления') }
    finally { setDeleting(false) }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">История изменений</h1>
          <p className="text-gray-500 text-sm mt-1">Все действия администраторов в системе</p>
        </div>
        <button
          onClick={() => { setShowDelete(true); setDeleteResult(null) }}
          className="flex items-center gap-2 text-sm text-red-400 border border-red-800 hover:bg-red-900/30 px-4 py-2 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Очистить историю
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">С</label>
          <input type="date"
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">По</label>
          <input type="date"
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
          />
        </div>
        <div className="flex-1 min-w-48">
          <label className="text-xs text-gray-500 block mb-1">Поиск</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text" placeholder="Компания, действие, email..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-red-500"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
        </div>
        <button
          onClick={applyFilters}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Применить
        </button>
        <span className="text-gray-600 text-sm self-end pb-2">
          Найдено: {total}
        </span>
      </div>

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <h2 className="text-lg font-bold text-white">Очистить историю</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">Удалить записи за выбранный период. Это действие необратимо.</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">С</label>
                <input type="date"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={deleteRange.from}
                  onChange={e => setDeleteRange(r => ({ ...r, from: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">По</label>
                <input type="date"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={deleteRange.to}
                  onChange={e => setDeleteRange(r => ({ ...r, to: e.target.value }))}
                />
              </div>
            </div>
            {deleteResult && (
              <p className={`text-sm mb-3 ${deleteResult.includes('Ошибка') ? 'text-red-400' : 'text-green-400'}`}>
                {deleteResult}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={doDelete} disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Удаляем...' : 'Удалить'}
              </button>
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs list */}
      {loading ? (
        <div className="text-gray-500 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" />
          Загрузка...
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-600">История пуста за выбранный период</div>
      ) : (
        <>
          <div className="space-y-1.5">
            {logs.map(log => (
              <div key={log.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${ACTION_COLORS[log.action] || 'bg-gray-800 text-gray-400'}`}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{log.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 flex-wrap">
                    {log.companyName && <span className="text-gray-500">{log.companyName}</span>}
                    {log.adminEmail && <span>{log.adminEmail}</span>}
                    {log.oldValue && log.newValue && (
                      <span className="text-gray-700">{log.oldValue} → {log.newValue}</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {new Date(log.createdAt).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-gray-500 text-sm">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
