import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Save } from 'lucide-react'

const planLabels: Record<string, string> = {
  SALES_AMOUNT: 'План продаж (₸)',
  SALES_COUNT: 'Количество продаж',
  AVG_CHECK: 'Средний чек (₸)',
  CONVERSION: 'Конверсия (%)',
  LEADS: 'Количество лидов',
  QUALIFIED_LEADS: 'Квалиф. лидов',
  MEETINGS_SCHEDULED: 'Записано на встречу',
  MEETINGS_ATTENDED: 'Пришло на встречу',
  BUDGET: 'Рекламный бюджет (₸)',
}

export default function PlansPage() {
  const qc = useQueryClient()
  const period = new Date().toISOString().slice(0, 7)
  const [saved, setSaved] = useState(false)

  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/company/departments').then(r => r.data) })
  const { data: plans = [] } = useQuery({ queryKey: ['plans', period], queryFn: () => api.get(`/plans?period=${period}`).then(r => r.data) })

  const [values, setValues] = useState<Record<string, string>>({})

  const getPlanValue = (type: string, departmentId?: string) => {
    const key = `${type}_${departmentId || ''}`
    if (values[key] !== undefined) return values[key]
    const existing = plans.find((p: any) => p.type === type && (p.departmentId || '') === (departmentId || ''))
    return existing?.value?.toString() || ''
  }

  const setPlanValue = (type: string, value: string, departmentId?: string) => {
    const key = `${type}_${departmentId || ''}`
    setValues(v => ({ ...v, [key]: value }))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const plansList: any[] = []
      for (const [key, value] of Object.entries(values)) {
        if (!value) continue
        const [type, departmentId] = key.split('_')
        plansList.push({ type, value: parseFloat(value), departmentId: departmentId || undefined })
      }
      await api.post('/plans/bulk', { period, plans: plansList })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Плановые показатели</h1>
          <p className="text-gray-500 text-sm mt-0.5">Период: {period}</p>
        </div>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saved ? 'Сохранено ✓' : 'Сохранить'}
        </button>
      </div>

      {departments.map((dept: any) => (
        <div key={dept.id} className="card">
          <h3 className="font-semibold text-gray-900 mb-4">{dept.name}</h3>
          <div className="grid grid-cols-2 gap-4">
            {dept.type === 'SALES' && (
              <>
                {['SALES_AMOUNT', 'SALES_COUNT', 'AVG_CHECK', 'CONVERSION'].map(type => (
                  <div key={type}>
                    <label className="label">{planLabels[type]}</label>
                    <input type="number" className="input" min="0" value={getPlanValue(type, dept.id)} onChange={e => setPlanValue(type, e.target.value, dept.id)} />
                  </div>
                ))}
                {dept.hasLiders && ['LEADS', 'QUALIFIED_LEADS', 'MEETINGS_SCHEDULED', 'MEETINGS_ATTENDED'].map(type => (
                  <div key={type}>
                    <label className="label">{planLabels[type]}</label>
                    <input type="number" className="input" min="0" value={getPlanValue(type, dept.id)} onChange={e => setPlanValue(type, e.target.value, dept.id)} />
                  </div>
                ))}
              </>
            )}
            {dept.type === 'MARKETING' && (
              <>
                {['LEADS', 'QUALIFIED_LEADS', 'BUDGET'].map(type => (
                  <div key={type}>
                    <label className="label">{planLabels[type]}</label>
                    <input type="number" className="input" min="0" value={getPlanValue(type, dept.id)} onChange={e => setPlanValue(type, e.target.value, dept.id)} />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
