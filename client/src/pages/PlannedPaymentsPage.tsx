import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useT } from '../i18n'
import { Banknote, Phone, Check, X, CalendarClock, Trash2, RotateCcw, AlertCircle, Clock, Calendar, ChevronRight, MessageSquare } from 'lucide-react'

type PaymentTask = {
  id: string
  title: string
  dueDate: string
  paymentAmount: number
  completed: boolean
  comment: string | null
  lead: { id: string; clientName: string; phone: string } | null
  user: { id: string; name: string } | null
}

function localDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isOverdue(dueDate: string) { return dueDate < localDate() }

function fmtDate(s: string) {
  if (!s) return ''
  const today = localDate()
  const d = new Date(s + 'T12:00:00')
  const tm = new Date(); tm.setDate(tm.getDate() + 1)
  const tomorrow = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, '0')}-${String(tm.getDate()).padStart(2, '0')}`
  if (s === today) return 'Сегодня'
  if (s === tomorrow) return 'Завтра'
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtMonth(s: string) {
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('ru', { month: 'long', year: 'numeric' })
}

function sameMonth(dueDate: string, refDate: Date) {
  const d = new Date(dueDate + 'T12:00:00')
  return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear()
}

function TaskModal({ task, onClose }: { task: PaymentTask; onClose: () => void }) {
  const qc = useQueryClient()
  const { t } = useT()
  const [comment, setComment] = useState(task.comment || '')
  const [postponeDate, setPostponeDate] = useState('')
  const [showPostpone, setShowPostpone] = useState(false)

  const updateMut = useMutation({
    mutationFn: (data: any) => api.put(`/lead-tasks/${task.id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['planned-payments'] }); onClose() },
  })
  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/lead-tasks/${task.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['planned-payments'] }); onClose() },
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
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-purple-500 shrink-0" />
              <p className="font-semibold text-sm text-gray-900">
                ₸ {(task.paymentAmount ?? 0).toLocaleString('ru')}
              </p>
            </div>
            {task.lead && (
              <div className="flex items-center gap-2 text-xs text-gray-600 ml-6 flex-wrap">
                <span className="font-medium">{task.lead.clientName}</span>
                <span className="flex items-center gap-0.5 text-gray-400"><Phone className="w-3 h-3" />{task.lead.phone}</span>
              </div>
            )}
            {task.user && (
              <p className="text-xs text-gray-400 ml-6 mt-0.5">{task.user.name}</p>
            )}
            <p className={`text-xs mt-1 ml-6 font-medium ${isOverdue(task.dueDate) ? 'text-red-500' : 'text-gray-400'}`}>
              {fmtDate(task.dueDate)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {t('tasks.expanded.comment')}
            </label>
            <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
              placeholder={t('tasks.expanded.commentPlaceholder')}
              className={`w-full text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 resize-none text-gray-700 placeholder-gray-400 ${!hasComment ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-purple-400'}`}
            />
            {!hasComment && <p className="text-xs text-red-500 mt-0.5">{t('tasks.commentRequired')}</p>}
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

        <div className="flex flex-wrap gap-2 px-5 pb-5">
          <button onClick={markClosed} disabled={updateMut.isPending || !hasComment}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Check className="w-3 h-3" /> Оплата получена
          </button>
          <button onClick={() => setShowPostpone(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors ${showPostpone ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-orange-300 text-orange-700 hover:bg-orange-50'}`}>
            <CalendarClock className="w-3 h-3" /> {t('tasks.expanded.postpone')}
          </button>
          <button onClick={() => { if (confirm(t('tasks.deleteConfirm'))) deleteMut.mutate() }} disabled={deleteMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors ml-auto disabled:opacity-50">
            <Trash2 className="w-3 h-3" /> {t('tasks.expanded.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PlannedPaymentsPage() {
  const { t } = useT()
  const [modalTask, setModalTask] = useState<PaymentTask | null>(null)

  const tasksQ = useQuery({
    queryKey: ['planned-payments'],
    queryFn: () => api.get('/lead-tasks/planned-payments').then(r => r.data),
    refetchInterval: 30000,
  })

  const tasks: PaymentTask[] = tasksQ.data || []

  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const overdue  = tasks.filter(t => isOverdue(t.dueDate))
  const thisMonth = tasks.filter(t => !isOverdue(t.dueDate) && sameMonth(t.dueDate, now))
  const nxtMonth  = tasks.filter(t => !isOverdue(t.dueDate) && sameMonth(t.dueDate, nextMonth))
  const later     = tasks.filter(t => {
    const d = new Date(t.dueDate + 'T12:00:00')
    return !isOverdue(t.dueDate) && !sameMonth(t.dueDate, now) && !sameMonth(t.dueDate, nextMonth)
  })

  const totalAmount = tasks.reduce((s, t) => s + (t.paymentAmount ?? 0), 0)

  const sections = [
    { label: 'Просроченные', tasks: overdue, color: 'text-red-600', bg: 'border-red-200 bg-red-50/40', icon: AlertCircle, dot: 'bg-red-500' },
    { label: fmtMonth(now.toISOString().slice(0,10)), tasks: thisMonth, color: 'text-blue-700', bg: 'border-blue-200 bg-blue-50/40', icon: Clock, dot: 'bg-blue-500' },
    { label: fmtMonth(nextMonth.toISOString().slice(0,10)), tasks: nxtMonth, color: 'text-purple-700', bg: 'border-purple-100 bg-purple-50/30', icon: Calendar, dot: 'bg-purple-500' },
    { label: 'Позже', tasks: later, color: 'text-gray-600', bg: 'border-gray-100 bg-gray-50/30', icon: Calendar, dot: 'bg-gray-400' },
  ].filter(s => s.tasks.length > 0)

  return (
    <div className="space-y-5 px-4 md:px-6 py-2 md:py-4">
      {modalTask && <TaskModal task={modalTask} onClose={() => setModalTask(null)} />}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dash.plannedPayments')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Ожидаемые платежи от клиентов по частичным оплатам</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card py-4 text-center">
          <p className="text-2xl font-bold text-purple-600">₸ {totalAmount.toLocaleString('ru')}</p>
          <p className="text-xs text-gray-400 mt-0.5">Общая сумма</p>
        </div>
        <div className="card py-4 text-center">
          <p className="text-2xl font-bold text-gray-700">{tasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Напоминаний</p>
          {overdue.length > 0 && (
            <p className="text-xs text-red-500 font-semibold mt-0.5">{overdue.length} просрочено</p>
          )}
        </div>
      </div>

      {/* Loading */}
      {tasksQ.isLoading && (
        <div className="card text-center text-gray-400 py-12">{t('common.loading')}</div>
      )}

      {/* Empty */}
      {!tasksQ.isLoading && tasks.length === 0 && (
        <div className="card text-center py-14">
          <Banknote className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Нет запланированных доплат</p>
          <p className="text-xs text-gray-300 mt-1">Доплаты появятся здесь, когда вы зарегистрируете частичную оплату в продаже</p>
        </div>
      )}

      {/* Sections */}
      {!tasksQ.isLoading && sections.map(section => (
        <div key={section.label}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${section.dot}`} />
            <section.icon className={`w-4 h-4 ${section.color}`} />
            <h3 className={`text-sm font-semibold ${section.color} capitalize`}>{section.label}</h3>
            <span className="text-xs text-gray-400">({section.tasks.length})</span>
            <span className="ml-auto text-xs font-semibold text-gray-500">
              ₸ {section.tasks.reduce((s, t) => s + (t.paymentAmount ?? 0), 0).toLocaleString('ru')}
            </span>
          </div>
          <div className="space-y-2">
            {section.tasks.map(task => {
              const overdueTsk = isOverdue(task.dueDate)
              return (
                <div
                  key={task.id}
                  onClick={() => setModalTask(task)}
                  className={`rounded-xl border transition-colors cursor-pointer flex items-center gap-3 p-4 ${
                    overdueTsk ? section.bg + ' hover:brightness-95' : 'border-gray-100 bg-white hover:bg-gray-50/60'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${overdueTsk ? 'bg-red-100' : 'bg-purple-50'}`}>
                    <Banknote className={`w-4 h-4 ${overdueTsk ? 'text-red-500' : 'text-purple-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${overdueTsk ? 'text-red-700' : 'text-gray-900'}`}>
                        ₸ {(task.paymentAmount ?? 0).toLocaleString('ru')}
                      </p>
                      {overdueTsk && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Просрочено</span>
                      )}
                    </div>
                    {task.lead && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        <span className="font-medium">{task.lead.clientName}</span>
                        <span className="text-gray-400 ml-1.5 inline-flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" />{task.lead.phone}
                        </span>
                      </p>
                    )}
                    {task.user && (
                      <p className="text-xs text-gray-400 mt-0.5">{task.user.name}</p>
                    )}
                    {task.comment && (
                      <p className="text-xs text-gray-400 mt-0.5 italic line-clamp-1">{task.comment}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-semibold ${overdueTsk ? 'text-red-500' : 'text-gray-400'}`}>
                      {fmtDate(task.dueDate)}
                    </p>
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-auto mt-1" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
