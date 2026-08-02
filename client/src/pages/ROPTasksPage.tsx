import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useT } from '../i18n'
import { CheckSquare, Circle, Plus, X, Check, Users, ChevronDown, ChevronUp, MessageSquare, CalendarClock, Trash2 } from 'lucide-react'

type LeadTask = {
  id: string
  title: string
  dueDate: string
  completed: boolean
  comment: string | null
  userId: string
  user: { id: string; name: string; managerType: string | null }
  lead: { id: string; clientName: string; phone: string } | null
  createdBy: { id: string; name: string } | null
}

function localDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isOverdue(dueDate: string) { return dueDate < localDate() }

function fmtDate(s: string, fmtToday: string, fmtTomorrow: string) {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  const today = localDate()
  const tm = new Date(); tm.setDate(tm.getDate() + 1)
  const tomorrow = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, '0')}-${String(tm.getDate()).padStart(2, '0')}`
  if (s === today) return fmtToday
  if (s === tomorrow) return fmtTomorrow
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function CreateTaskModal({ users, onClose }: { users: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { t } = useT()
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(localDate())
  const [userId, setUserId] = useState('')

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/lead-tasks', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rop-tasks'] }); onClose() },
  })

  const save = () => {
    if (!title.trim() || !dueDate || !userId) return
    createMut.mutate({ title: title.trim(), dueDate, userId })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{t('tasks.modal.assignTitle')}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="label">{t('tasks.modal.employee')} <span className="text-red-500">*</span></label>
          <select className="input" value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">{t('tasks.modal.chooseEmployee')}</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.managerType === 'LIDER' ? t('tasks.roType.lider') : t('tasks.roType.closer')})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">{t('tasks.modal.taskLabel')} <span className="text-red-500">*</span></label>
          <textarea
            className="input"
            rows={3}
            placeholder={t('tasks.modal.taskPlaceholder')}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="label">{t('tasks.modal.dueDateLabel')} <span className="text-red-500">*</span></label>
          <input
            type="date"
            className="input"
            value={dueDate}
            min={localDate()}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1 flex items-center justify-center gap-1.5">
            <X className="w-3.5 h-3.5" /> {t('common.cancel')}
          </button>
          <button
            onClick={save}
            disabled={!title.trim() || !dueDate || !userId || createMut.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> {t('tasks.modal.assign')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskExpanded({ task, onClose }: { task: LeadTask; onClose: () => void }) {
  const qc = useQueryClient()
  const { t } = useT()
  const [comment, setComment] = useState(task.comment || '')
  const [postponeDate, setPostponeDate] = useState('')
  const [showPostpone, setShowPostpone] = useState(false)

  const updateMut = useMutation({
    mutationFn: (data: any) => api.put(`/lead-tasks/${task.id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rop-tasks'] }),
  })
  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/lead-tasks/${task.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rop-tasks'] }); onClose() },
  })

  const saveComment = () => {
    if (comment !== (task.comment || '')) updateMut.mutate({ comment: comment.trim() || null })
  }
  const markClosed = () => updateMut.mutate({ completed: true, comment: comment.trim() || task.comment || null })
  const markPostponed = () => {
    if (!postponeDate) return
    updateMut.mutate({ dueDate: postponeDate, comment: comment.trim() || task.comment || null })
    setShowPostpone(false); onClose()
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {task.completed ? t('tasks.reportLabel') : t('tasks.expanded.comment')}
        </label>
        <textarea
          rows={2}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={task.completed ? t('tasks.reportPlaceholder') : t('tasks.notePlaceholder')}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none text-gray-700 placeholder-gray-400"
        />
        <div className="flex justify-end mt-1">
          <button
            onClick={saveComment}
            disabled={comment === (task.comment || '') || updateMut.isPending}
            className="text-xs font-semibold px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> {t('common.save')}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!task.completed && (
          <>
            <button onClick={markClosed} disabled={updateMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
              <Check className="w-3 h-3" /> {t('tasks.expanded.close')}
            </button>
            <button onClick={() => setShowPostpone(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 text-orange-700 hover:bg-orange-50 text-xs font-semibold rounded-lg transition-colors">
              <CalendarClock className="w-3 h-3" /> {t('tasks.expanded.postpone')}
            </button>
          </>
        )}
        <button onClick={() => { if (confirm(t('tasks.deleteConfirm'))) deleteMut.mutate() }} disabled={deleteMut.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors ml-auto disabled:opacity-50">
          <Trash2 className="w-3 h-3" /> {t('tasks.expanded.delete')}
        </button>
      </div>
      {showPostpone && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
          <CalendarClock className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-xs text-orange-700 font-medium shrink-0">{t('tasks.expanded.newDate')}</span>
          <input type="date" value={postponeDate} min={localDate()}
            onChange={e => setPostponeDate(e.target.value)}
            className="text-sm border border-orange-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white" />
          <button onClick={markPostponed} disabled={!postponeDate || updateMut.isPending}
            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors">
            {t('tasks.expanded.postpone')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ROPTasksPage() {
  const qc = useQueryClient()
  const { t } = useT()
  const [showCreate, setShowCreate] = useState(false)
  const [filterUser, setFilterUser] = useState('')
  const [filterCompleted, setFilterCompleted] = useState<'all' | 'active' | 'done'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const tasksQ = useQuery({
    queryKey: ['rop-tasks', filterUser],
    queryFn: () => api.get(`/lead-tasks/team${filterUser ? `?userId=${filterUser}` : ''}`).then(r => r.data),
    refetchInterval: 30000,
  })

  const usersQ = useQuery({
    queryKey: ['team-managers'],
    queryFn: () => api.get('/users').then(r => r.data.filter((u: any) => u.role === 'MANAGER')),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.put(`/lead-tasks/${id}`, { completed }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rop-tasks'] }),
  })

  const allTasks: LeadTask[] = tasksQ.data || []
  const users: any[] = usersQ.data || []

  const filtered = allTasks.filter(t => {
    if (filterCompleted === 'active') return !t.completed
    if (filterCompleted === 'done') return t.completed
    return true
  })

  const grouped = filtered.reduce<Record<string, LeadTask[]>>((acc, t) => {
    const key = t.user?.id || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const overdue = allTasks.filter(t => !t.completed && isOverdue(t.dueDate)).length
  const active = allTasks.filter(t => !t.completed).length
  const done = allTasks.filter(t => t.completed).length

  return (
    <div className="space-y-5 px-4 md:px-6 py-2 md:py-4">
      {showCreate && <CreateTaskModal users={users} onClose={() => setShowCreate(false)} />}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('tasks.teamTitle')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('tasks.subtitle.rop')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> {t('tasks.assignBtn')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-red-500">{overdue}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('tasks.overdue')}</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{active}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('tasks.activeCount')}</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-green-600">{done}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('tasks.doneCount')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          className="input text-sm py-2 w-auto"
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
        >
          <option value="">{t('tasks.allEmployees')}</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', 'active', 'done'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterCompleted(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterCompleted === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {f === 'all' ? t('tasks.tabAll') : f === 'active' ? t('tasks.tabActive') : t('tasks.tabDone')}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks grouped by user */}
      {tasksQ.isLoading && <div className="card text-center text-gray-400 py-12">{t('common.loading')}</div>}

      {!tasksQ.isLoading && filtered.length === 0 && (
        <div className="card text-center py-14">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">{t('tasks.emptyTeam')}</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-blue-500 hover:underline">
            {t('tasks.assignFirst')}
          </button>
        </div>
      )}

      {!tasksQ.isLoading && Object.entries(grouped).map(([uid, tasks]) => {
        const user = tasks[0]?.user
        return (
          <div key={uid} className="card space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-blue-700">{user?.name?.[0]}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-400">
                  {user?.managerType === 'LIDER' ? t('tasks.roType.lider') : t('tasks.roType.closer')}
                </p>
              </div>
              <span className="ml-auto text-xs text-gray-400">
                {tasks.filter(t => !t.completed).length} {t('tasks.activeOf')}
              </span>
            </div>
            <div className="space-y-2">
              {tasks.map(task => {
                const overdue = !task.completed && isOverdue(task.dueDate)
                const isOpen = expandedId === task.id
                return (
                  <div
                    key={task.id}
                    className={`rounded-xl border transition-colors ${
                      task.completed ? 'border-gray-100 bg-gray-50/50 opacity-70' :
                      overdue ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 p-3">
                      <button
                        onClick={() => toggleMut.mutate({ id: task.id, completed: !task.completed })}
                        className={`mt-0.5 shrink-0 transition-colors ${task.completed ? 'text-green-500' : overdue ? 'text-red-400 hover:text-red-600' : 'text-gray-300 hover:text-blue-500'}`}
                      >
                        {task.completed ? <CheckSquare className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.completed ? 'line-through text-gray-400' : overdue ? 'text-red-700' : 'text-gray-800'}`}>
                          {task.title}
                        </p>
                        {task.lead && (
                          <p className="text-xs text-gray-400 mt-0.5">{t('tasks.leadLabel')} {task.lead.clientName} {task.lead.phone}</p>
                        )}
                        {task.completed && task.comment && !isOpen && (
                          <p className="text-xs text-green-700 mt-1 italic line-clamp-1 bg-green-50 px-2 py-0.5 rounded-lg">
                            <MessageSquare className="w-3 h-3 inline mr-1" />{t('tasks.reportPreview')} {task.comment}
                          </p>
                        )}
                        {!task.completed && task.comment && !isOpen && (
                          <p className="text-xs text-gray-500 mt-1 italic line-clamp-1">
                            <MessageSquare className="w-3 h-3 inline mr-1" />{task.comment}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                        <p className={`text-xs font-semibold ${overdue && !task.completed ? 'text-red-500' : 'text-gray-400'}`}>
                          {fmtDate(task.dueDate, t('tasks.fmtToday'), t('tasks.fmtTomorrow'))}
                        </p>
                        <button
                          onClick={() => setExpandedId(isOpen ? null : task.id)}
                          className={`flex items-center gap-1 text-xs font-medium transition-colors px-2 py-0.5 rounded-lg ${isOpen ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        >
                          {isOpen
                            ? <><ChevronUp className="w-3.5 h-3.5" /> {t('tasks.expanded.collapse')}</>
                            : <><ChevronDown className="w-3.5 h-3.5" /> {t('tasks.expanded.edit')}</>}
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-3 pb-3">
                        <TaskExpanded task={task} onClose={() => setExpandedId(null)} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
