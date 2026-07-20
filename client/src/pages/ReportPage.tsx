import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { CheckCircle } from 'lucide-react'
import { useT } from '../i18n'

export default function ReportPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Closer: only daily stats (sales are entered separately via dashboard)
  const [closer, setCloser] = useState({ clientsReceived: '', consultations: '', refusals: '', comment: '' })
  const [lider, setLider] = useState({ leadsReceived: '', processed: '', qualifiedLeads: '', transferredToCloser: '', comment: '' })
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

      await api.post('/reports', { date: todayStr, type, data, comment: data.comment, departmentId: user?.departmentId })
      setDone(true)
      setTimeout(() => navigate(-1), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || t('report.error'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="text-xl font-bold text-gray-900">{t('report.done')}</h2>
        <p className="text-gray-500">{t('report.redirect')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('report.title')}</h1>
      <p className="text-gray-500 text-sm mb-6">{t('report.date')} {today.toLocaleDateString('ru')}</p>

      <form onSubmit={submit} className="card space-y-4">
        {/* CLOSER — only stats, sales are entered directly from dashboard */}
        {isCloser && (
          <>
            <p className="text-xs text-gray-400 bg-blue-50 rounded-lg px-3 py-2">
              💡 Продажи вносятся отдельно прямо из кабинета — кнопка «+ Продажа». Здесь только статистика дня.
            </p>
            <div><label className="label">{t('report.closer.clients')}</label>
              <input type="number" className="input" min="0" value={closer.clientsReceived}
                onChange={e => setCloser(f => ({ ...f, clientsReceived: e.target.value }))} required /></div>
            <div><label className="label">{t('report.closer.consultations')}</label>
              <input type="number" className="input" min="0" value={closer.consultations}
                onChange={e => setCloser(f => ({ ...f, consultations: e.target.value }))} /></div>
            <div><label className="label">{t('report.closer.refusals')}</label>
              <input type="number" className="input" min="0" value={closer.refusals}
                onChange={e => setCloser(f => ({ ...f, refusals: e.target.value }))} /></div>
            <div><label className="label">{t('common.comment')}</label>
              <textarea className="input" rows={3} value={closer.comment}
                onChange={e => setCloser(f => ({ ...f, comment: e.target.value }))}
                placeholder={t('report.closer.commentPlaceholder')} /></div>
          </>
        )}

        {isLider && (
          <>
            <div><label className="label">{t('report.lider.leadsReceived')}</label><input type="number" className="input" min="0" value={lider.leadsReceived} onChange={e => setLider(f => ({ ...f, leadsReceived: e.target.value }))} required /></div>
            <div><label className="label">{t('report.lider.processed')}</label><input type="number" className="input" min="0" value={lider.processed} onChange={e => setLider(f => ({ ...f, processed: e.target.value }))} /></div>
            <div><label className="label">{t('report.lider.qualified')}</label><input type="number" className="input" min="0" value={lider.qualifiedLeads} onChange={e => setLider(f => ({ ...f, qualifiedLeads: e.target.value }))} required /></div>
            <div><label className="label">{t('report.lider.transferred')}</label><input type="number" className="input" min="0" value={lider.transferredToCloser} onChange={e => setLider(f => ({ ...f, transferredToCloser: e.target.value }))} /></div>
            <div><label className="label">{t('common.comment')}</label><textarea className="input" rows={3} value={lider.comment} onChange={e => setLider(f => ({ ...f, comment: e.target.value }))} placeholder={t('report.lider.commentPlaceholder')} /></div>
          </>
        )}

        {isMarketer && (
          <>
            <div><label className="label">{t('report.marketer.budget')}</label><input type="number" className="input" min="0" value={marketer.adBudget} onChange={e => setMarketer(f => ({ ...f, adBudget: e.target.value }))} required /></div>
            <div><label className="label">{t('report.marketer.leads')}</label><input type="number" className="input" min="0" value={marketer.leadsCount} onChange={e => setMarketer(f => ({ ...f, leadsCount: e.target.value }))} required /></div>
            <div><label className="label">{t('report.marketer.qualified')}</label><input type="number" className="input" min="0" value={marketer.qualifiedLeads} onChange={e => setMarketer(f => ({ ...f, qualifiedLeads: e.target.value }))} /></div>
            <div><label className="label">{t('common.comment')}</label><textarea className="input" rows={3} value={marketer.comment} onChange={e => setMarketer(f => ({ ...f, comment: e.target.value }))} placeholder={t('report.marketer.commentPlaceholder')} /></div>
          </>
        )}

        {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? t('report.submitting') : t('report.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
