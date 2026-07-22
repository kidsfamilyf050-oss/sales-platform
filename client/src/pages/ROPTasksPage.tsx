import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { CheckSquare, Circle, AlertCircle, Clock, Plus, X, Check, Users } from 'lucide-react'

type LeadTask = {
  id: string
  title: string
  dueDate: string
  completed: boolean
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

function fmtDate(s: string) {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  const today = localDate()
  const tm = new Date(); tm.setDate(tm.getDate() + 1)
  const tomorrow = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, '0')}-${String(tm.getDate()).padStart(2, '0')}`
  if (s === today) return 'Сегодня'
  if (s === tomorrow) return 'Завтра'
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function CreateTaskModal({ users, onClose }: { users: any[]; onClose: () => void }) {
  const qc = useQueryClient()
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
          <h3 className="text-lg font-semibold text-gray-900">Поставить задачу</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="label">Сотрудник <span className="text-red-500">*</span></label>
          <select className="input" value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">Выберите сотрудника...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.managerType === 'LIDER' ? 'Лидоруб' : 'Клоузер'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Задача <span className="text-red-500">*</span></label>
          <textarea
            className="input"
            rows={3}
            placeholder="Опишите задачу..."
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Срок выполнения <span className="text-red-500">*</span></label>
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
            <X className="w-3.5 h-3.5" /> Отмена
          </button>
          <button
            onClick={save}
            disabled={!title.trim() || !dueDate || !userId || createMut.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> Поставить
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ROPTasksPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [filterUser, setFilterUser] = useState('')
  const [filterCompleted, setFilterCompleted] = useState<'all' | 'active' | 'done'>('all')

  // All team tasks
  const tasksQ = useQuery({
    queryKey: ['rop-tasks', filterUser],
    queryFn: () => api.get(`/lead-tasks/team${filterUser ? `?userId=${filterUser}` : ''}`).then(r => r.data),
    refetchInterval: 30000,
  })

  // Team members for assignment
  const usersQ = useQuery({
    queryKey: ['team-managers'],
    queryFn: () => api.get('/users').then(r => r.data.filter((u: any) => u.role === 'MANAGER')),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.put(`/lead-tasks/${id}`, { completed }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rop-tasks'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/lead-tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rop-tasks'] }),
  })

  const allTasks: LeadTask[] = tasksQ.data || []
  const users: any[] = usersQ.data || []

  const today = localDate()
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
    <div className="space-y-5">
      {showCreate && <CreateTaskModal users={users} onClose={() => setShowCreate(false)} />}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Задачи команды</h1>
          <p className="text-sm text-gray-400 mt-0.5">Задачи клоузеров и лидорубов</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Поставить задачу
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-red-500">{overdue}</p>
          <p className="text-xs text-gray-400 mt-0.5">Просрочено</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{active}</p>
          <p className="text-xs text-gray-400 mt-0.5">Активных</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-green-600">{done}</p>
          <p className="text-xs text-gray-400 mt-0.5">Выполнено</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          className="input text-sm py-2 w-auto"
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
        >
          <option value="">Все сотрудники</option>
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
              {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Выполненные'}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks grouped by user */}
      {tasksQ.isLoading && <div className="card text-center text-gray-400 py-12">Загрузка...</div>}

      {!tasksQ.isLoading && filtered.length === 0 && (
        <div className="card text-center py-14">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Задач пока нет</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-blue-500 hover:underline">
            + Поставить первую задачу
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
                <p className="text-xs text-gray-400">{user?.managerType === 'LIDER' ? 'Лидоруб' : 'Клоузер'}</p>
              </div>
              <span className="ml-auto text-xs text-gray-400">{tasks.filter(t => !t.completed).length} активных</span>
            </div>
            <div className="space-y-2">
              {tasks.map(task => {
                const overdue = !task.completed && isOverdue(task.dueDate)
                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      task.completed ? 'border-gray-100 bg-gray-50/50 opacity-60' :
                      overdue ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50/30'
                    }`}
                  >
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
                        <p className="text-xs text-gray-400 mt-0.5">Заявка: {task.lead.clientName} {task.lead.phone}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      <p className={`text-xs font-semibold ${overdue && !task.completed ? 'text-red-500' : 'text-gray-400'}`}>
                        {fmtDate(task.dueDate)}
                      </p>
                      <button
                        onClick={() => { if (confirm('Удалить задачу?')) deleteMut.mutate(task.id) }}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
