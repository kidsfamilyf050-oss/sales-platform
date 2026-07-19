import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../api/client'
import { Save } from 'lucide-react'

const SPHERES = ['Образование', 'Медицинский центр', 'Недвижимость', 'IT и технологии', 'Розничная торговля', 'Услуги', 'Строительство', 'Другое']

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: () => api.get('/company').then(r => r.data) })
  const [form, setForm] = useState({ name: '', businessSphere: '', reportingStart: 1 })

  if (company && !form.name && company.name !== 'Моя компания') {
    setForm({ name: company.name, businessSphere: company.businessSphere || '', reportingStart: company.reportingStart || 1 })
  }

  const save = useMutation({
    mutationFn: () => api.put('/company', form),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Настройки компании</h1>

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
    </div>
  )
}
