import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Save, Pencil, Check, X } from 'lucide-react'

const SPHERES = ['Образование', 'Медицинский центр', 'Недвижимость', 'IT и технологии', 'Розничная торговля', 'Услуги', 'Строительство', 'Другое']

function DeptRenameRow({ dept }: { dept: any }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(dept.name)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim() || name === dept.name) { setEditing(false); return }
    setSaving(true)
    try {
      await api.put(`/company/departments/${dept.id}`, { name: name.trim() })
      qc.invalidateQueries({ queryKey: ['departments'] })
      setEditing(false)
    } catch {
      alert('Не удалось переименовать')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className={`w-2 h-2 rounded-full ${dept.type === 'SALES' ? 'bg-blue-500' : 'bg-orange-500'}`} />
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
          <span className="text-xs text-gray-400">{dept.type === 'SALES' ? 'Продажи' : 'Маркетинг'} · {dept.users?.length || 0} чел.</span>
          <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: () => api.get('/company').then(r => r.data) })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/company/departments').then(r => r.data) })
  const [form, setForm] = useState({ name: '', businessSphere: '', reportingStart: 1 })

  if (company && !form.name && company.name !== 'Моя компания') {
    setForm({ name: company.name, businessSphere: company.businessSphere || '', reportingStart: company.reportingStart || 1 })
  }

  const save = useMutation({
    mutationFn: () => api.put('/company', form),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) },
    onError: () => alert('Не удалось сохранить'),
  })

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Настройки компании</h1>

      {/* Company info */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900">Основная информация</h3>
        <div>
          <label className="label">Название компании</label>
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ООО «Компания»" />
        </div>
        <div>
          <label className="label">Сфера бизнеса</label>
          <select className="input" value={form.businessSphere} onChange={e => setForm(f => ({ ...f, businessSphere: e.target.value }))}>
            <option value="">— выберите —</option>
            {SPHERES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Начало отчётного месяца (день)</label>
          <input type="number" className="input" min={1} max={28} value={form.reportingStart} onChange={e => setForm(f => ({ ...f, reportingStart: +e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1">По умолчанию — 1-е число. Можно изменить, например на 16-е.</p>
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saved ? 'Сохранено ✓' : 'Сохранить'}
        </button>
      </div>

      {/* Department names */}
      {departments.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-1">Названия отделов</h3>
          <p className="text-xs text-gray-400 mb-4">Нажмите карандаш чтобы переименовать, Enter для сохранения</p>
          {departments.map((d: any) => <DeptRenameRow key={d.id} dept={d} />)}
        </div>
      )}
    </div>
  )
}
