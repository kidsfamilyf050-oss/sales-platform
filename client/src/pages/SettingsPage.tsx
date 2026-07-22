import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Save, Pencil, Check, X, Trash2, AlertTriangle } from 'lucide-react'
import { useT, getSpheres } from '../i18n'
import { useAuthStore } from '../store/auth'

function DeptRenameRow({ dept }: { dept: any }) {
  const qc = useQueryClient()
  const { t } = useT()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(dept.name)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isEmpty = (dept.users?.length || 0) === 0

  const save = async () => {
    if (!name.trim() || name === dept.name) { setEditing(false); return }
    setSaving(true)
    try {
      await api.put(`/company/departments/${dept.id}`, { name: name.trim() })
      qc.invalidateQueries({ queryKey: ['departments'] })
      setEditing(false)
    } catch {
      alert(t('settings.renameError'))
    } finally {
      setSaving(false)
    }
  }

  const deleteDept = async () => {
    if (!window.confirm(`${t('settings.deleteConfirm')} "${dept.name}"?`)) return
    setDeleting(true)
    try {
      await api.delete(`/company/departments/${dept.id}`)
      qc.invalidateQueries({ queryKey: ['departments'] })
    } catch (e: any) {
      alert(e?.response?.data?.error || t('settings.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dept.type === 'SALES' ? 'bg-blue-500' : 'bg-orange-500'}`} />
      {editing ? (
        <>
          <input
            autoFocus
            className="flex-1 border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(dept.name); setEditing(false) } }}
          />
          <button onClick={save} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => { setName(dept.name); setEditing(false) }} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-gray-800">{dept.name}</span>
          <span className="text-xs text-gray-400">
            {dept.type === 'SALES' ? t('settings.sales') : t('nav.marketing')} · {dept.users?.length || 0} {t('users.active')}
          </span>
          <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={t('common.rename')}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {isEmpty && (
            <button onClick={deleteDept} disabled={deleting} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title={t('common.delete')}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useT()
  const { user } = useAuthStore()
  const isOwner = user?.role === 'OWNER'
  const [saved, setSaved] = useState(false)
  const [resetting, setResetting] = useState(false)
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: () => api.get('/company').then(r => r.data) })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/company/departments').then(r => r.data) })
  const [form, setForm] = useState({ name: '', businessSphere: '', reportingStart: 1 })
  const spheres = getSpheres(t)

  if (company && !form.name && company.name !== 'Моя компания') {
    setForm({ name: company.name, businessSphere: company.businessSphere || '', reportingStart: company.reportingStart || 1 })
  }

  const save = useMutation({
    mutationFn: () => api.put('/company', form),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) },
    onError: () => alert(t('settings.saveError')),
  })

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>

      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900">{t('settings.basicInfo')}</h3>
        <div>
          <label className="label">{t('settings.companyName')}</label>
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ООО «Компания»" />
        </div>
        <div>
          <label className="label">{t('settings.businessSphere')}</label>
          <select className="input" value={form.businessSphere} onChange={e => setForm(f => ({ ...f, businessSphere: e.target.value }))}>
            <option value="">{t('common.choose')}</option>
            {spheres.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('settings.reportingStart')}</label>
          <input type="number" className="input" min={1} max={28} value={form.reportingStart} onChange={e => setForm(f => ({ ...f, reportingStart: +e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1">{t('settings.reportingNote')}</p>
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saved ? t('common.saved') : t('common.save')}
        </button>
      </div>

      {departments.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-1">{t('settings.deptNames')}</h3>
          <p className="text-xs text-gray-400 mb-4">{t('settings.deptNamesNote')}</p>
          {departments.map((d: any) => <DeptRenameRow key={d.id} dept={d} />)}
        </div>
      )}

      {isOwner && (
        <div className="card border-red-100 bg-red-50/30">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-700">Сброс данных</h3>
              <p className="text-xs text-red-500 mt-1">
                Удалит все продажи, отчёты и CRM-ссылки. Планы, пользователи и заявки останутся.
                Действие необратимо.
              </p>
            </div>
          </div>
          <button
            disabled={resetting}
            onClick={async () => {
              if (!window.confirm('Удалить все продажи и отчёты? Это необратимо.')) return
              if (!window.confirm('Вы уверены? Данные будут удалены навсегда.')) return
              setResetting(true)
              try {
                const res = await api.post('/company/reset-data', { confirm: 'RESET' })
                alert(`Удалено: продаж ${res.data.deleted.sales}, отчётов ${res.data.deleted.reports}, CRM-ссылок ${res.data.deleted.dealLinks}`)
              } catch (e: any) {
                alert(e?.response?.data?.error || 'Ошибка при сбросе')
              } finally {
                setResetting(false)
              }
            }}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
          >
            {resetting ? 'Удаление...' : 'Сбросить данные'}
          </button>
        </div>
      )}
    </div>
  )
}
