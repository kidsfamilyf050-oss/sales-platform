import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { CheckCircle, Calendar, Plus, Trash2 } from 'lucide-react'
import { useT } from '../i18n'

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type DealLinkItem = { id?: string; link: string; note: string }

export default function ReportPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const todayStr = localDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [existingReport, setExistingReport] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  const isCloser = user?.managerType === 'CLOSER'
  const isLider = user?.managerType === 'LIDER'
  const isMarketer = user?.role === 'MARKETER'

  const [closer, setCloser] = useState({ consultations: '', refusals: '', comment: '' })
  const [lider, setLider] = useState({ leadsReceived: '', processed: '', qualifiedLeads: '', meetingsScheduled: '', meetingsAttended: '', comment: '' })
  const [marketer, setMarketer] = useState({ adBudget: '', leadsCount: '', qualifiedLeads: '', comment: '' })

  // CRM links state — separate from report loading so they don't flicker
  const [refusalLinks, setRefusalLinks] = useState<DealLinkItem[]>([])
  const [inWorkLinks, setInWorkLinks] = useState<DealLinkItem[]>([])
  const [deletedLinkIds, setDeletedLinkIds] = useState<string[]>([])
  const [linksLoading, setLinksLoading] = useState(false)

  // Load report when date changes
  useEffect(() => {
    if (!selectedDate) return
    setLoadingReport(true)
    setExistingReport(null)

    api.get(`/reports/my?from=${selectedDate}&to=${selectedDate}`)
      .then(r => {
        const reports: any[] = r.data
        const myType = isCloser ? 'CLOSER' : isLider ? 'LIDER' : 'MARKETER'
        const found = reports.find((rep: any) => rep.type === myType)
        if (found) {
          setExistingReport(found)
          const d = found.data as any
          if (isCloser) setCloser({
            consultations: String(d.consultations || ''),
            refusals: String(d.refusals || ''),
            comment: d.comment || found.comment || '',
          })
          else if (isLider) setLider({
            leadsReceived: String(d.leadsReceived || d.leads || ''),
            processed: String(d.processed || ''),
            qualifiedLeads: String(d.qualifiedLeads || ''),
            meetingsScheduled: String(d.meetingsScheduled || ''),
            meetingsAttended: String(d.meetingsAttended || ''),
            comment: d.comment || found.comment || '',
          })
          else setMarketer({
            adBudget: String(d.adBudget || ''),
            leadsCount: String(d.leadsCount || ''),
            qualifiedLeads: String(d.qualifiedLeads || ''),
            comment: d.comment || found.comment || '',
          })
        } else {
          setCloser({ consultations: '', refusals: '', comment: '' })
          setLider({ leadsReceived: '', processed: '', qualifiedLeads: '', meetingsScheduled: '', meetingsAttended: '', comment: '' })
          setMarketer({ adBudget: '', leadsCount: '', qualifiedLeads: '', comment: '' })
        }
      })
      .catch(() => {})
      .finally(() => setLoadingReport(false))
  }, [selectedDate])

  // Load CRM links separately (closer only) — independent of report loading to avoid flickering
  useEffect(() => {
    if (!isCloser || !selectedDate) return
    setLinksLoading(true)
    setDeletedLinkIds([])
    api.get(`/deal-links?from=${selectedDate}&to=${selectedDate}`)
      .then(r => {
        const all: any[] = r.data
        setRefusalLinks(all.filter(l => l.type === 'REFUSAL').map(l => ({ id: l.id, link: l.link, note: l.note || '' })))
        setInWorkLinks(all.filter(l => l.type === 'IN_WORK').map(l => ({ id: l.id, link: l.link, note: l.note || '' })))
      })
      .catch(() => {})
      .finally(() => setLinksLoading(false))
  }, [selectedDate, isCloser])

  // CRM link helpers
  const addLink = (type: 'REFUSAL' | 'IN_WORK') => {
    const setter = type === 'REFUSAL' ? setRefusalLinks : setInWorkLinks
    setter(prev => [...prev, { link: '', note: '' }])
  }

  const removeLink = (type: 'REFUSAL' | 'IN_WORK', idx: number) => {
    const items = type === 'REFUSAL' ? refusalLinks : inWorkLinks
    const setter = type === 'REFUSAL' ? setRefusalLinks : setInWorkLinks
    const item = items[idx]
    if (item.id) setDeletedLinkIds(prev => [...prev, item.id!])
    setter(prev => prev.filter((_, i) => i !== idx))
  }

  const updateLink = (type: 'REFUSAL' | 'IN_WORK', idx: number, field: 'link' | 'note', val: string) => {
    const setter = type === 'REFUSAL' ? setRefusalLinks : setInWorkLinks
    setter(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let type: string, data: any
      if (isCloser) { type = 'CLOSER'; data = { ...closer } }
      else if (isLider) { type = 'LIDER'; data = { ...lider } }
      else { type = 'MARKETER'; data = { ...marketer } }

      // Save report
      await api.post('/reports', { date: selectedDate, type, data, comment: data.comment, departmentId: user?.departmentId })

      // Save CRM links together with the report (closer only)
      if (isCloser) {
        const newRefusals = refusalLinks.filter(l => !l.id && l.link.trim())
        const newInWork = inWorkLinks.filter(l => !l.id && l.link.trim())
        await Promise.all([
          ...newRefusals.map(l => api.post('/deal-links', { type: 'REFUSAL', link: l.link.trim(), note: l.note.trim() || null, date: selectedDate })),
          ...newInWork.map(l => api.post('/deal-links', { type: 'IN_WORK', link: l.link.trim(), note: l.note.trim() || null, date: selectedDate })),
          ...deletedLinkIds.map(id => api.delete(`/deal-links/${id}`)),
        ])
      }

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

  const isToday = selectedDate === todayStr
  const dateLabel = isToday
    ? `Сегодня, ${new Date().toLocaleDateString('ru', { day: 'numeric', month: 'long' })}`
    : new Date(selectedDate + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })

  // CRM links section renderer
  const renderLinkSection = (
    type: 'REFUSAL' | 'IN_WORK',
    items: DealLinkItem[],
    label: string,
    colorClass: string
  ) => (
    <div className={`rounded-xl border p-3 space-y-2 ${colorClass}`}>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      {linksLoading ? (
        <p className="text-xs text-gray-400 py-1">Загрузка...</p>
      ) : (
        <>
          {items.map((l, i) => (
            <div key={l.id || `new-${type}-${i}`} className="bg-white rounded-lg border border-gray-100 p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  className="input text-sm py-1.5 flex-1"
                  placeholder="https://crm.example.com/deal/..."
                  value={l.link}
                  onChange={e => updateLink(type, i, 'link', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeLink(type, i)}
                  className="p-1.5 rounded text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                className="input text-sm py-1.5"
                placeholder="Заметка (имя клиента, статус...)"
                value={l.note}
                onChange={e => updateLink(type, i, 'note', e.target.value)}
              />
              {l.id && <p className="text-[10px] text-gray-300">Сохранено ранее · будет обновлено при сохранении отчёта</p>}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addLink(type)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 py-0.5"
          >
            <Plus className="w-3.5 h-3.5" /> Добавить ссылку
          </button>
        </>
      )}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">{t('report.title')}</h1>

      {/* Date selector */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 flex-1 min-w-0">
          <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm text-blue-700 font-medium truncate">{dateLabel}</span>
          {existingReport && (
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0 whitespace-nowrap">
              Редактирование
            </span>
          )}
        </div>
        <input
          type="date"
          className="input w-auto text-sm shrink-0"
          value={selectedDate}
          max={todayStr}
          onChange={e => setSelectedDate(e.target.value)}
        />
      </div>

      {/* Main report form */}
      {loadingReport ? (
        <div className="card text-center text-gray-400 py-8">Загрузка данных...</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {existingReport && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              ✏️ Редактирование отчёта за {dateLabel}. Данные обновятся.
            </p>
          )}

          {isCloser && (
            <div className="card space-y-4">
              <p className="text-xs text-gray-400 bg-blue-50 rounded-lg px-3 py-2">
                💡 Продажи вносятся отдельно — кнопка «+ Продажа» в кабинете. Здесь только статистика дня.
              </p>
              <div>
                <label className="label">{t('report.closer.consultations')}</label>
                <input type="number" className="input" min="0" value={closer.consultations}
                  onChange={e => setCloser(f => ({ ...f, consultations: e.target.value }))} required />
              </div>
              <div>
                <label className="label">{t('report.closer.refusals')}</label>
                <input type="number" className="input" min="0" value={closer.refusals}
                  onChange={e => setCloser(f => ({ ...f, refusals: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t('common.comment')}</label>
                <textarea className="input" rows={3} value={closer.comment}
                  onChange={e => setCloser(f => ({ ...f, comment: e.target.value }))}
                  placeholder={t('report.closer.commentPlaceholder')} />
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">{t('common.cancel')}</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? t('report.submitting') : existingReport ? 'Сохранить изменения' : t('report.submit')}
                </button>
              </div>
            </div>
          )}

          {isLider && (
            <div className="card space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('report.lider.leadsReceived')}</label>
                  <input type="number" className="input" min="0" value={lider.leadsReceived} onChange={e => setLider(f => ({ ...f, leadsReceived: e.target.value }))} required /></div>
                <div><label className="label">{t('report.lider.processed')}</label>
                  <input type="number" className="input" min="0" value={lider.processed} onChange={e => setLider(f => ({ ...f, processed: e.target.value }))} /></div>
                <div><label className="label">{t('report.lider.qualified')}</label>
                  <input type="number" className="input" min="0" value={lider.qualifiedLeads} onChange={e => setLider(f => ({ ...f, qualifiedLeads: e.target.value }))} required /></div>
                <div><label className="label">Записано на встречу</label>
                  <input type="number" className="input" min="0" value={lider.meetingsScheduled} onChange={e => setLider(f => ({ ...f, meetingsScheduled: e.target.value }))} /></div>
                <div><label className="label">Проведено консультаций</label>
                  <input type="number" className="input" min="0" value={lider.meetingsAttended} onChange={e => setLider(f => ({ ...f, meetingsAttended: e.target.value }))} /></div>
              </div>
              <div><label className="label">{t('common.comment')}</label>
                <textarea className="input" rows={3} value={lider.comment} onChange={e => setLider(f => ({ ...f, comment: e.target.value }))} placeholder={t('report.lider.commentPlaceholder')} /></div>

              {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">{t('common.cancel')}</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? t('report.submitting') : existingReport ? 'Сохранить изменения' : t('report.submit')}
                </button>
              </div>
            </div>
          )}

          {isMarketer && (
            <div className="card space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('report.marketer.budget')}</label>
                  <input type="number" className="input" min="0" value={marketer.adBudget} onChange={e => setMarketer(f => ({ ...f, adBudget: e.target.value }))} required /></div>
                <div><label className="label">{t('report.marketer.leads')}</label>
                  <input type="number" className="input" min="0" value={marketer.leadsCount} onChange={e => setMarketer(f => ({ ...f, leadsCount: e.target.value }))} required /></div>
                <div className="col-span-2"><label className="label">{t('report.marketer.qualified')}</label>
                  <input type="number" className="input" min="0" value={marketer.qualifiedLeads} onChange={e => setMarketer(f => ({ ...f, qualifiedLeads: e.target.value }))} /></div>
              </div>
              <div><label className="label">{t('common.comment')}</label>
                <textarea className="input" rows={3} value={marketer.comment} onChange={e => setMarketer(f => ({ ...f, comment: e.target.value }))} placeholder={t('report.marketer.commentPlaceholder')} /></div>

              {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">{t('common.cancel')}</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? t('report.submitting') : existingReport ? 'Сохранить изменения' : t('report.submit')}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* CRM link sections — ALWAYS visible for closer, independent of report loading */}
      {isCloser && (
        <div className="space-y-3 mt-4">
          {renderLinkSection(
            'REFUSAL',
            refusalLinks,
            '❌ CRM-ссылки отказников',
            'bg-red-50/60 border-red-100'
          )}
          {renderLinkSection(
            'IN_WORK',
            inWorkLinks,
            '🕐 CRM-ссылки сделок в работе',
            'bg-amber-50/60 border-amber-100'
          )}
          <p className="text-xs text-gray-400 text-center pb-2">
            Ссылки сохраняются вместе с отчётом при нажатии «Сохранить отчёт»
          </p>
        </div>
      )}
    </div>
  )
}
