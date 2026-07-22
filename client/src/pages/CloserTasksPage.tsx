import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { CheckSquare, Circle, Phone, AlertCircle, Clock, Plus, X, Check } from 'lucide-react'

type LeadTask = {
  id: string
  title: string
  dueDate: string
  completed: boolean
  lead: {
    id: string
    clientName: string
    phone: string
    status: string
    salesChannel: { name: string } | null
    createdBy: { name: string }
  } | null
  createdBy: { id: string; name: string; role: string } | null
}

function localDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isOverdue(dueDate: string) {
  return dueDate < localDate()
}

function fmtDate(s: string) {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  const today = localDate()
  const tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1)
  const tomorrow = `${tomorrowD.getFullYear()}-${String(tomorrowD.getMonth() + 1).padStart(2, '0')}-${String(tomorrowD.getDate()).padStart(2, '0')}`
  if (s === today) return 'Сегодня'
  if (s === tomorrow) return 'Завтра'
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(localDate())

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/lead-tasks', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-tasks'] }); onClose() },
  })

  const save = () => {
    if (!title.trim() || !dueDate) return
    createMut.mutate({ title: title.trim(), dueDate })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Новая задача</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="label">Задача <span className="text-red-500">*</span></label>
          <textarea
            autoFocus
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
            disabled={!title.trim() || !dueDate || createMut.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> Создать
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CloserTasksPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'active' | 'done'>('active')
  const [showCreate, setShowCreate] = useState(false)

  const tasksQ = useQuery({
    queryKey: ['closer-tasks', tab],
    queryFn: () => api.get(`/lead-tasks?completed=${tab === 'done'}`).then(r => r.data),
    refetchInterval: 30000,
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.put(`/lead-tasks/${id}`, { completed }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-tasks'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/lead-tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['closer-tasks'] }),
  })

  const tasks: LeadTask[] = tasksQ.data || []

  const today = localDate()
  const overdueTasks = tasks.filter(t => !t.completed && isOverdue(t.dueDate))
  const todayTasks = tasks.filter(t => !t.completed && t.dueDate === today)
  const upcomingTasks = tasks.filter(t => !t.completed && !isOverdue(t.dueDate) && t.dueDate !== today)

  const sections = tab === 'active'
    ? [
        { label: 'Просрочено', tasks: overdueTasks, color: 'text-red-600', bgColor: 'border-red-200 bg-red-50/40', icon: AlertCircle },
        { label: 'Сегодня', tasks: todayTasks, color: 'text-blue-600', bgColor: 'border-blue-200 bg-blue-50/40', icon: Clock },
        { label: 'Предстоящие', tasks: upcomingTasks, color: 'text-gray-600', bgColor: 'border-gray-200', icon: CheckSquare },
      ].filter(s => s.tasks.length > 0)
    : [{ label: 'Выполненные', tasks, color: 'text-gray-400', bgColor: 'border-gray-100', icon: CheckSquare }]

  return (
    <div className="space-y-5">
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
          <p className="text-sm text-gray-400 mt-0.5">Напоминания по заявкам</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Создать задачу
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-red-500">{overdueTasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Просрочено</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{todayTasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">На сегодня</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-gray-600">{upcomingTasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Предстоит</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
          Активные
          {(overdueTasks.length + todayTasks.length) > 0 && (
            <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">
              {overdueTasks.length + todayTasks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('done')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'done' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          Выполненные
        </button>
      </div>

      {/* Content */}
      {tasksQ.isLoading && <div className="card text-center text-gray-400 py-12">Загрузка...</div>}

      {!tasksQ.isLoading && tasks.length === 0 && (
        <div className="card text-center py-14">
          <CheckSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {tab === 'active' ? 'Нет активных задач' : 'Нет выполненных задач'}
          </p>
          {tab === 'active' && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 text-sm text-blue-500 hover:underline"
            >
              + Создать задачу
            </button>
          )}
        </div>
      )}

      {!tasksQ.isLoading && sections.length > 0 && (
        <div className="space-y-5">
          {sections.map(section => (
            <div key={section.label}>
              <div className="flex items-center gap-2 mb-3">
                <section.icon className={`w-4 h-4 ${section.color}`} />
                <h3 className={`text-sm font-semibold ${section.color}`}>{section.label}</h3>
                <span className="text-xs text-gray-400">({section.tasks.length})</span>
              </div>
              <div className="space-y-2">
                {section.tasks.map(task => {
                  const overdue = !task.completed && isOverdue(task.dueDate)
                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                        task.completed ? 'border-gray-100 bg-gray-50/50 opacity-60' :
                        overdue ? section.bgColor : 'border-gray-100 bg-white hover:bg-gray-50/60'
                      }`}
                    >
                      <button
                        onClick={() => toggleMut.mutate({ id: task.id, completed: !task.completed })}
                        className={`mt-0.5 shrink-0 transition-colors ${task.completed ? 'text-green-500' : overdue ? 'text-red-400 hover:text-red-600' : 'text-gray-300 hover:text-blue-500'}`}
                      >
                        {task.completed
                          ? <CheckSquare className="w-5 h-5" />
                          : <Circle className="w-5 h-5" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${task.completed ? 'line-through text-gray-400' : overdue ? 'text-red-700' : 'text-gray-900'}`}>
                          {task.title}
                        </p>
                        {task.lead ? (
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                            <span className="font-medium text-gray-600">{task.lead.clientName}</span>
                            <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{task.lead.phone}</span>
                            {task.lead.salesChannel && <span>{task.lead.salesChannel.name}</span>}
                          </div>
                        ) : task.createdBy ? (
                          <p className="text-xs text-gray-400 mt-1">От: {task.createdBy.name}</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right flex flex-col items-end gap-1">
                        <p className={`text-xs font-semibold ${overdue && !task.completed ? 'text-red-500' : 'text-gray-400'}`}>
                          {fmtDate(task.dueDate)}
                        </p>
                        {!task.completed && (
                          <button
                            onClick={() => { if (confirm('Удалить задачу?')) deleteMut.mutate(task.id) }}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
