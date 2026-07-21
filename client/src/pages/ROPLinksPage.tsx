import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import PeriodSelector from '../components/ui/PeriodSelector'
import { ArrowLeft, Link2, Pencil, Trash2, X, Check, ExternalLink } from 'lucide-react'

function fmt(s: string) {
  // Format YYYY-MM-DD to readable date
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ROPLinksPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const periodState = usePeriodStore()
  const params = buildPeriodParams(periodState)

  const [tab, setTab] = useState<'REFUSAL' | 'IN_WORK'>('REFUSAL')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ link: '', note: '' })
  const [filterManager, setFilterManager] = useState<string>('all')

  const linksQuery = useQuery({
    queryKey: ['rop-links-page', params, tab],
    queryFn: () => api.get(`/deal-links/all?${params}&type=${tab}`).then(r => r.data),
    refetchInterval: 30000,
  })

  const deleteLink = useMutation({
    mutationFn: (id: string) => api.delete(`/deal-links/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rop-links-page'] })
      setSelectedIds(prev => { const n = new Set(prev); return n })
    },
  })

  const updateLink = useMutation({
    mutationFn: ({ id, link, note }: { id: string; link: string; note: string }) =>
      api.put(`/deal-links/${id}`, { link, note }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rop-links-page'] }); setEditingId(null) },
  })

  const deleteBulk = async () => {
    await Promise.all(Array.from(selectedIds).map(id => api.delete(`/deal-links/${id}`)))
    qc.invalidateQueries({ queryKey: ['rop-links-page'] })
    setSelectedIds(new Set())
  }

  const links: any[] = linksQuery.data || []

  // Get unique managers for filter
  const managers = Array.from(new Map(links.map(l => [l.user.id, l.user.name])).entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Apply manager filter
  const filtered = filterManager === 'all' ? links : links.filter(l => l.user.id === filterManager)

  // Group by manager
  const byManager: Record<string, { name: string; items: any[] }> = {}
  for (const l of filtered) {
    if (!byManager[l.user.id]) byManager[l.user.id] = { name: l.user.name, items: [] }
    byManager[l.user.id].items.push(l)
  }
  const managerGroups = Object.entries(byManager)

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)))
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/rop')}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">CRM-ссылки клоузеров</h1>
          <p className="text-sm text-gray-400 mt-0.5">Все отказы и сделки в работе за период</p>
        </div>
      </div>

      {/* Period selector + tabs row */}
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodSelector />
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => { setTab('REFUSAL'); setSelectedIds(new Set()); setEditingId(null) }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'REFUSAL' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            Отказники
            {links.filter(l => l.type === 'REFUSAL').length > 0 && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                {linksQuery.data?.filter((l: any) => l.type === 'REFUSAL').length ?? 0}
              </span>
            )}
          </button>
          <button
            onClick={() => { setTab('IN_WORK'); setSelectedIds(new Set()); setEditingId(null) }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'IN_WORK' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            В работе
            {links.filter(l => l.type === 'IN_WORK').length > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full text-xs font-bold">
                {linksQuery.data?.filter((l: any) => l.type === 'IN_WORK').length ?? 0}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toolbar: filter by manager + bulk actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {managers.length > 1 && (
          <select
            value={filterManager}
            onChange={e => { setFilterManager(e.target.value); setSelectedIds(new Set()) }}
            className="input text-sm py-1.5 w-auto"
          >
            <option value="all">Все менеджеры ({managers.length})</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        {filtered.length > 0 && (
          <button
            onClick={selectAll}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {selectedIds.size === filtered.length ? 'Снять выделение' : `Выбрать все (${filtered.length})`}
          </button>
        )}
        {selectedIds.size > 0 && (
          <button
            onClick={deleteBulk}
            className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <Trash2 className="w-4 h-4" /> Удалить выбранные ({selectedIds.size})
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400">
          {filtered.length} ссылок
        </span>
      </div>

      {/* Loading */}
      {linksQuery.isLoading && (
        <div className="card text-center text-gray-400 py-12">Загрузка...</div>
      )}

      {/* Empty state */}
      {!linksQuery.isLoading && filtered.length === 0 && (
        <div className="card text-center py-12">
          <Link2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Нет ссылок за выбранный период</p>
          <p className="text-sm text-gray-300 mt-1">Клоузеры добавляют ссылки при заполнении отчёта</p>
        </div>
      )}

      {/* Links grouped by manager */}
      {!linksQuery.isLoading && managerGroups.length > 0 && (
        <div className="space-y-4">
          {managerGroups.map(([managerId, mgr]) => (
            <div key={managerId} className="card p-0 overflow-hidden">
              {/* Manager header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">{mgr.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="font-semibold text-gray-800 text-sm">{mgr.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{mgr.items.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  {mgr.items.some(l => selectedIds.has(l.id)) && (
                    <span className="text-xs text-blue-600 font-medium">
                      {mgr.items.filter(l => selectedIds.has(l.id)).length} выбрано
                    </span>
                  )}
                </div>
              </div>

              {/* Links */}
              <div className="divide-y divide-gray-50">
                {mgr.items.map((dl: any) => {
                  const checked = selectedIds.has(dl.id)
                  const isEditing = editingId === dl.id
                  return (
                    <div key={dl.id} className={`transition-colors ${checked ? 'bg-blue-50' : 'bg-white hover:bg-gray-50/60'}`}>
                      {isEditing ? (
                        <div className="p-4 space-y-2.5 bg-blue-50/40 border-l-2 border-blue-400">
                          <input
                            type="url"
                            className="input text-sm py-2"
                            value={editForm.link}
                            onChange={e => setEditForm(f => ({ ...f, link: e.target.value }))}
                            placeholder="https://..."
                            autoFocus
                          />
                          <input
                            type="text"
                            className="input text-sm py-2"
                            value={editForm.note}
                            onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                            placeholder="Заметка (имя клиента, статус, сумма...)"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-white transition-colors"
                            >
                              <X className="w-3.5 h-3.5" /> Отмена
                            </button>
                            <button
                              onClick={() => updateLink.mutate({ id: dl.id, link: editForm.link, note: editForm.note })}
                              disabled={!editForm.link.trim() || updateLink.isPending}
                              className="flex items-center gap-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors font-medium"
                            >
                              <Check className="w-3.5 h-3.5" /> Сохранить
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(dl.id)}
                            className="mt-1 shrink-0 accent-blue-600 w-4 h-4"
                          />
                          <Link2 className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <a
                              href={dl.link}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium group/link"
                            >
                              <span className="truncate">{dl.link}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                            </a>
                            {dl.note && (
                              <p className="text-sm text-gray-600 mt-0.5">{dl.note}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">{fmt(dl.date)}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => { setEditingId(dl.id); setEditForm({ link: dl.link, note: dl.note || '' }) }}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                              title="Редактировать"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { if (confirm('Удалить ссылку?')) deleteLink.mutate(dl.id) }}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
