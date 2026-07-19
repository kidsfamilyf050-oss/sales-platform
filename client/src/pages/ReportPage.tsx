import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { CheckCircle } from 'lucide-react'

export default function ReportPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  // Closer form
  const [closer, setCloser] = useState({ clientsReceived: '', consultations: '', salesCount: '', salesAmount: '', refusals: '', comment: '' })
  // Lider form
  const [lider, setLider] = useState({ leadsReceived: '', processed: '', qualifiedLeads: '', transferredToCloser: '', comment: '' })
  // Marketer form
  const [marketer, setMarketer] = useState({ adBudget: '', leadsCount: '', qualifiedLeads: '', comment: '' })

  const isCloser = user?.managerType === 'CLOSER'
  const isLider = user?.managerType === 'LIDER'
  const isMarketer = user?.role === 'MARKETER'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let type: string, data: any
      if (isCloser) { type = 'CLOSER'; data = { ...closer } }
      else if (isLider) { type = 'LIDER'; data = { ...lider } }
      else { type = 'MARKETER'; data = { ...marketer } }

      await api.post('/reports', { date: today, type, data, comment: data.comment, departmentId: user?.departmentId })
      setDone(true)
      setTimeout(() => navigate(-1), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="text-xl font-bold text-gray-900">Отчёт сохранён!</h2>
        <p className="text-gray-500">Перенаправляем обратно...</p>
      </div>
    )
  }

  const inputClass = "input"

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Ежедневный отчёт</h1>
      <p className="text-gray-500 text-sm mb-6">Дата: {new Date().toLocaleDateString('ru')}</p>

      <form onSubmit={submit} className="card space-y-4">
        {isCloser && (
          <>
            <div><label className="label">Получено клиентов</label><input type="number" className={inputClass} min="0" value={closer.clientsReceived} onChange={e => setCloser(f => ({ ...f, clientsReceived: e.target.value }))} required /></div>
            <div><label className="label">Проведено консультаций</label><input type="number" className={inputClass} min="0" value={closer.consultations} onChange={e => setCloser(f => ({ ...f, consultations: e.target.value }))} /></div>
            <div><label className="label">Количество продаж</label><input type="number" className={inputClass} min="0" value={closer.salesCount} onChange={e => setCloser(f => ({ ...f, salesCount: e.target.value }))} required /></div>
            <div><label className="label">Сумма продаж (₸)</label><input type="number" className={inputClass} min="0" value={closer.salesAmount} onChange={e => setCloser(f => ({ ...f, salesAmount: e.target.value }))} required /></div>
            <div><label className="label">Количество отказов</label><input type="number" className={inputClass} min="0" value={closer.refusals} onChange={e => setCloser(f => ({ ...f, refusals: e.target.value }))} /></div>
            <div><label className="label">Комментарий</label><textarea className={inputClass} rows={3} value={closer.comment} onChange={e => setCloser(f => ({ ...f, comment: e.target.value }))} placeholder="Что мешало? Какие сложности?" /></div>
          </>
        )}
        {isLider && (
          <>
            <div><label className="label">Получено новых лидов</label><input type="number" className={inputClass} min="0" value={lider.leadsReceived} onChange={e => setLider(f => ({ ...f, leadsReceived: e.target.value }))} required /></div>
            <div><label className="label">Обработано лидов</label><input type="number" className={inputClass} min="0" value={lider.processed} onChange={e => setLider(f => ({ ...f, processed: e.target.value }))} /></div>
            <div><label className="label">Квалифицировано</label><input type="number" className={inputClass} min="0" value={lider.qualifiedLeads} onChange={e => setLider(f => ({ ...f, qualifiedLeads: e.target.value }))} required /></div>
            <div><label className="label">Передано клоузеру</label><input type="number" className={inputClass} min="0" value={lider.transferredToCloser} onChange={e => setLider(f => ({ ...f, transferredToCloser: e.target.value }))} /></div>
            <div><label className="label">Комментарий</label><textarea className={inputClass} rows={3} value={lider.comment} onChange={e => setLider(f => ({ ...f, comment: e.target.value }))} placeholder="Качество лидов, источники..." /></div>
          </>
        )}
        {isMarketer && (
          <>
            <div><label className="label">Рекламный бюджет за день (₸)</label><input type="number" className={inputClass} min="0" value={marketer.adBudget} onChange={e => setMarketer(f => ({ ...f, adBudget: e.target.value }))} required /></div>
            <div><label className="label">Количество лидов</label><input type="number" className={inputClass} min="0" value={marketer.leadsCount} onChange={e => setMarketer(f => ({ ...f, leadsCount: e.target.value }))} required /></div>
            <div><label className="label">Квалифицированных лидов</label><input type="number" className={inputClass} min="0" value={marketer.qualifiedLeads} onChange={e => setMarketer(f => ({ ...f, qualifiedLeads: e.target.value }))} /></div>
            <div><label className="label">Комментарий</label><textarea className={inputClass} rows={3} value={marketer.comment} onChange={e => setMarketer(f => ({ ...f, comment: e.target.value }))} placeholder="Источники, аномалии, замечания..." /></div>
          </>
        )}

        {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Сохраняем...' : 'Сохранить отчёт'}
          </button>
        </div>
      </form>
    </div>
  )
}
