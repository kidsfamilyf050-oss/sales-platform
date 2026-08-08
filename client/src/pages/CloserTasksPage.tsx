import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useT } from '../i18n'
import { CheckSquare, Circle, Phone, AlertCircle, Clock, Plus, X, Check, MessageSquare, CalendarClock, Trash2, RotateCcw } from 'lucide-react'

type LeadTask = {
  id: string
  title: string
  dueDate: string
  completed: boolean
  comment: string | null
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

function fmtDate(s: string, fmtToday: string, fmtTomorrow: string) {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  const today = localDate()
  const tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1)
  const tomorrow = `${tomorrowD.getFullYear()}-${String(tomorrowD.getMonth() + 1).padStart(2, '0')}-${String(tomorrowD.getDate()).padStart(2, '0')}`
  if (s === today) return fmtToday
  if (s === tomorrow) return fmtTomorrow
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { t } = useT()
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
          <h3 className="text-lg font-semibold text-gray-900">{t('tasks.modal.newTitle')}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="label">{t('tasks.modal.taskLabel')} <span className="text-red-500">*</span></label>
          <textarea
            autoFocus
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
            disabled={!title.trim() || !dueDate || createMut.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> {t('tasks.modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskModal({ task, onClose }: { task: LeadTask; onClose: () => void }) {
  const qc = useQueryClient()
  const { t } = useT()
  const [comment, setComment] = useState(task.comment || '')
  const [postponeDate, setPostponeDate] = useState('')
  const [showPostpone, setShowPostpone] = useState(false)

  const updateMut = useMutation({
    mutationFn: (data: any) => api.put(`/lead-tasks/${task.id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-tasks'] }); onClose() },
  })
  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/lead-tasks/${task.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['closer-tasks'] }); onClose() },
  })

  const hasComment = comment.trim().length > 0
  const markClosed = () => {
    if (!hasComment) return
    updateMut.mutate({ completed: true, comment: comment.trim() })
  }
  const markReopened = () => updateMut.mutate({ completed: false })
  const markPostponed = () => {
    if (!postponeDate) return
    updateMut.mutate({ dueDate: postponeDate, comment: comment.trim() || task.comment || null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 mb-1`}>
              {task.completed
                ? <CheckSquare className="w-4 h-4 text-green-500 shrink-0" />
                : <Circle className="w-4 h-4 text-gray-300 shrink-0" />}
              <p className={`font-semibold text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {task.title}
              </p>
            </div>
            {task.lead && (
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap ml-6">
                <span className="font-medium">{task.lead.clientName}</span>
                <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{task.lead.phone}</span>
              </div>
            )}
            <p className={`text-xs mt-1 ml-6 font-medium ${!task.completed && isOverdue(task.dueDate) ? 'text-red-500' : 'text-gray-400'}`}>
              {fmtDate(task.dueDate, t('tasks.fmtToday'), t('tasks.fmtTomorrow'))}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {t('tasks.expanded.comment')}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t('tasks.expanded.commentPlaceholder')}
              className={`w-full text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 resize-none text-gray-700 placeholder-gray-400 ${!hasComment && !task.completed ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-blue-400'}`}
            />
            {!hasComment && !task.completed && (
              <p className="text-xs text-red-500 mt-0.5">{t('tasks.commentRequired')}</p>
            )}
          </div>
          {showPostpone && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
              <CalendarClock className="w-4 h-4 text-orange-500 shrink-0" />
              <input type="date" value={postponeDate} min={localDate()}
                onChange={e => setPostponeDate(e.target.value)}
                className="text-sm border border-orange-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white flex-1" />
              <button onClick={markPostponed} disabled={!postponeDate || updateMut.isPending}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors">
                {t('tasks.expanded.postpone')}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {task.completed ? (
            <button onClick={markReopened} disabled={updateMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
              <RotateCcw className="w-3 h-3" /> {t('tasks.expanded.reopen')}
            </button>
          ) : (
            <>
              <button onClick={markClosed} disabled={updateMut.isPending || !hasComment}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Check className="w-3 h-3" /> {t('tasks.expanded.close')}
              </button>
              <button onClick={() => setShowPostpone(p => !p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors ${showPostpone ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-orange-300 text-orange-700 hover:bg-orange-50'}`}>
                <CalendarClock className="w-3 h-3" /> {t('tasks.expanded.postpone')}
              </button>
            </>
          )}
          <button onClick={() => { if (confirm(t('tasks.deleteConfirm'))) deleteMut.mutate() }} disabled={deleteMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors ml-auto disabled:opacity-50">
            <Trash2 className="w-3 h-3" /> {t('tasks.expanded.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CloserTasksPage() {
  const qc = useQueryClient()
  const { t } = useT()
  const [tab, setTab] = useState<'active' | 'done'>('active')
  const [showCreate, setShowCreate] = useState(false)
  const [modalTask, setModalTask] = useState<LeadTask | null>(null)

  const tasksQ = useQuery({
    queryKey: ['closer-tasks', tab],
    queryFn: () => api.get(`/lead-tasks?completed=${tab === 'done'}`).then(r => r.data),
    refetchInterval: 30000,
  })

  const tasks: LeadTask[] = tasksQ.data || []

  const today = localDate()
  const overdueTasks = tasks.filter(t => !t.completed && isOverdue(t.dueDate))
  const todayTasks = tasks.filter(t => !t.completed && t.dueDate === today)
  const upcomingTasks = tasks.filter(t => !t.completed && !isOverdue(t.dueDate) && t.dueDate !== today)

  const sections = tab === 'active'
    ? [
        { label: t('tasks.sectionOverdue'), tasks: overdueTasks, color: 'text-red-600', bgColor: 'border-red-200 bg-red-50/40', icon: AlertCircle },
        { label: t('tasks.sectionToday'), tasks: todayTasks, color: 'text-blue-600', bgColor: 'border-blue-200 bg-blue-50/40', icon: Clock },
        { label: t('tasks.sectionUpcoming'), tasks: upcomingTasks, color: 'text-gray-600', bgColor: 'border-gray-200', icon: CheckSquare },
      ].filter(s => s.tasks.length > 0)
    : [{ label: t('tasks.sectionDone'), tasks, color: 'text-gray-400', bgColor: 'border-gray-100', icon: CheckSquare }]

  return (
    <div className="space-y-5 px-4 md:px-6 py-2 md:py-4">
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      {modalTask && <TaskModal task={modalTask} onClose={() => setModalTask(null)} />}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('tasks.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('tasks.subtitle.closer')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> {t('tasks.createBtn')}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-red-500">{overdueTasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('tasks.overdue')}</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{todayTasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('tasks.today')}</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-gray-600">{upcomingTasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('tasks.upcoming')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
          {t('tasks.tabActive')}
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
          {t('tasks.tabDone')}
        </button>
      </div>

      {/* Content */}
      {tasksQ.isLoading && <div className="card text-center text-gray-400 py-12">{t('common.loading')}</div>}

      {!tasksQ.isLoading && tasks.length === 0 && (
        <div className="card text-center py-14">
          <CheckSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {tab === 'active' ? t('tasks.emptyActive') : t('tasks.emptyDone')}
          </p>
          {tab === 'active' && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 text-sm text-blue-500 hover:underline"
            >
              {t('tasks.createLink')}
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
                      onClick={() => setModalTask(task)}
                      className={`rounded-xl border transition-colors cursor-pointer ${
                        task.completed ? 'border-gray-100 bg-gray-50/50 opacity-70 hover:opacity-90' :
                        overdue ? section.bgColor + ' hover:brightness-95' : 'border-gray-100 bg-white hover:bg-gray-50/60'
                      }`}
                    >
                      <div className="flex items-start gap-3 p-4">
                        <div className={`mt-0.5 shrink-0 ${task.completed ? 'text-green-500' : overdue ? 'text-red-400' : 'text-gray-300'}`}>
                          {task.completed ? <CheckSquare className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        </div>
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
                            <p className="text-xs text-gray-400 mt-1">{t('tasks.expanded.from')} {task.createdBy.name}</p>
                          ) : null}
                          {task.comment && (
                            <p className="text-xs text-gray-500 mt-1.5 italic line-clamp-1">
                              <MessageSquare className="w-3 h-3 inline mr-1" />{task.comment}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-xs font-semibold ${overdue && !task.completed ? 'text-red-500' : 'text-gray-400'}`}>
                            {fmtDate(task.dueDate, t('tasks.fmtToday'), t('tasks.fmtTomorrow'))}
                          </p>
                        </div>
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
