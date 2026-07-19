import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Save, Target, Users, TrendingUp, DollarSign, CheckCircle, ChevronLeft, ChevronRight, Info, Building2, UserCircle, Megaphone } from 'lucide-react'

// ─── Plan configs ────────────────────────────────────────────────────────────

const DEPT_SALES_PLANS = [
  { type: 'SALES_AMOUNT', label: 'Сумма продаж', unit: '₸', hint: 'Общий план продаж отдела за месяц' },
  { type: 'SALES_COUNT', label: 'Количество сделок', unit: 'шт', hint: 'Сколько сделок должен закрыть отдел' },
  { type: 'AVG_CHECK', label: 'Средний чек', unit: '₸', hint: 'Целевая средняя сумма одной сделки' },
  { type: 'CONVERSION', label: 'Конверсия лид→продажа', unit: '%', hint: 'Целевой процент конверсии из лидов в сделки' },
]

const DEPT_LIDER_PLANS = [
  { type: 'LEADS', label: 'Входящих лидов', unit: 'шт', hint: 'Сколько новых лидов должно быть обработано' },
  { type: 'QUALIFIED_LEADS', label: 'Квалифицированных лидов', unit: 'шт', hint: 'Сколько лидов должно пройти квалификацию' },
  { type: 'MEETINGS_SCHEDULED', label: 'Записано на встречу', unit: 'шт', hint: 'Сколько клиентов должно записаться на встречу' },
  { type: 'MEETINGS_ATTENDED', label: 'Пришло на встречу', unit: 'шт', hint: 'Сколько клиентов должно прийти на встречу' },
]

const MANAGER_CLOSER_PLANS = [
  { type: 'SALES_AMOUNT', label: 'Сумма продаж', unit: '₸', hint: 'Личный план продаж' },
  { type: 'SALES_COUNT', label: 'Количество сделок', unit: 'шт', hint: 'Личный план по количеству сделок' },
  { type: 'AVG_CHECK', label: 'Средний чек', unit: '₸', hint: 'Целевой средний чек' },
]

const MANAGER_LIDER_PLANS = [
  { type: 'LEADS', label: 'Лидов', unit: 'шт', hint: 'Личный план по лидам' },
  { type: 'QUALIFIED_LEADS', label: 'Квалифиц. лидов', unit: 'шт', hint: 'Личный план по квалификации' },
  { type: 'MEETINGS_SCHEDULED', label: 'Записано', unit: 'шт', hint: 'Личный план по записям на встречу' },
]

const MARKETING_PLANS = [
  { type: 'LEADS', label: 'Плановых лидов', unit: 'шт', hint: 'Сколько лидов должен привести маркетинг' },
  { type: 'QUALIFIED_LEADS', label: 'Квалифиц. лидов', unit: 'шт', hint: 'Целевое количество квалифицированных лидов' },
  { type: 'BUDGET', label: 'Рекламный бюджет', unit: '₸', hint: 'Плановый бюджет на рекламу' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPeriod(date: Date) {
  return date.toISOString().slice(0, 7)
}

function formatPeriod(period: string) {
  const [year, month] = period.split('-')
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  return `${months[parseInt(month) - 1]} ${year}`
}

function shiftMonth(period: string, delta: number) {
  const [year, month] = period.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return getPeriod(d)
}

// ─── Input with hint ────────────────────────────────────────────────────────

function PlanInput({ label, unit, hint, value, onChange }: {
  label: string; unit: string; hint: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="group relative cursor-help">
          <Info className="w-3.5 h-3.5 text-gray-400" />
          <span className="absolute left-5 top-0 z-10 w-48 rounded-lg bg-gray-800 text-white text-xs px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            {hint}
          </span>
        </span>
      </div>
      <div className="relative">
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">{unit}</span>
      </div>
    </div>
  )
}

// ─── Section card ────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, icon: Icon, iconColor, children }: {
  title: string; subtitle?: string; icon: any; iconColor: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`flex items-center gap-3 px-5 py-4 border-b border-gray-100 ${iconColor}`}>
        <div className="p-2 bg-white/70 rounded-lg">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Manager row ────────────────────────────────────────────────────────────

function ManagerRow({ name, role, plans, values, onChange }: {
  name: string; role: string; plans: typeof MANAGER_CLOSER_PLANS;
  values: Record<string, string>; onChange: (type: string, val: string) => void
}) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <UserCircle className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm">{name}</p>
          <p className="text-xs text-gray-400">{role}</p>
        </div>
      </div>
      <div className={`grid gap-3 ${plans.length <= 2 ? 'grid-cols-2' : plans.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {plans.map(p => (
          <PlanInput key={p.type} label={p.label} unit={p.unit} hint={p.hint}
            value={values[p.type] || ''} onChange={v => onChange(p.type, v)} />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function PlansPage() {
  const qc = useQueryClient()
  const [period, setPeriod] = useState(getPeriod(new Date()))
  const [saved, setSaved] = useState(false)

  // values[`${type}__dept_${deptId}`] = department plan
  // values[`${type}__user_${userId}`] = manager plan
  const [values, setValues] = useState<Record<string, string>>({})

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/company/departments').then(r => r.data),
  })

  // Reset local edits when period changes
  useEffect(() => { setValues({}) }, [period])

  const { data: plans = [] } = useQuery({
    queryKey: ['plans', period],
    queryFn: () => api.get(`/plans?period=${period}`).then(r => r.data),
  })

  const getVal = (type: string, scope: { deptId?: string; userId?: string }) => {
    const key = scope.userId ? `${type}__user_${scope.userId}` : `${type}__dept_${scope.deptId}`
    if (values[key] !== undefined) return values[key]
    const existing = plans.find((p: any) =>
      p.type === type &&
      (p.departmentId || '') === (scope.deptId || '') &&
      (p.userId || '') === (scope.userId || '')
    )
    return existing?.value?.toString() || ''
  }

  const setVal = (type: string, value: string, scope: { deptId?: string; userId?: string }) => {
    const key = scope.userId ? `${type}__user_${scope.userId}` : `${type}__dept_${scope.deptId}`
    setValues(v => ({ ...v, [key]: value }))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const plansList: any[] = []
      for (const [key, value] of Object.entries(values)) {
        if (!value || value === '') continue
        const [type, scopeRaw] = key.split('__')
        if (!type || !scopeRaw) continue
        const numVal = parseFloat(value)
        if (isNaN(numVal)) continue
        if (scopeRaw.startsWith('dept_')) {
          const departmentId = scopeRaw.replace('dept_', '')
          plansList.push({ type, value: numVal, departmentId })
        } else if (scopeRaw.startsWith('user_')) {
          const userId = scopeRaw.replace('user_', '')
          plansList.push({ type, value: numVal, userId })
        }
      }
      if (plansList.length === 0) throw new Error('Нечего сохранять')
      await api.post('/plans/bulk', { period, plans: plansList })
    },
    onSuccess: () => {
      setValues({}) // clear local edits → inputs reload from DB
      qc.invalidateQueries({ queryKey: ['plans'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (e: any) => {
      alert('Ошибка сохранения: ' + (e?.response?.data?.error || e?.message || 'Попробуйте ещё раз'))
    },
  })

  const salesDepts = departments.filter((d: any) => d.type === 'SALES')
  const marketingDepts = departments.filter((d: any) => d.type === 'MARKETING')

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Плановые показатели</h1>
          <p className="text-gray-500 text-sm mt-0.5">Установите цели для отделов и каждого менеджера</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period picker */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setPeriod(p => shiftMonth(p, -1))} className="p-1.5 hover:bg-white rounded-md transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="px-2 text-sm font-medium text-gray-800 min-w-[120px] text-center">{formatPeriod(period)}</span>
            <button onClick={() => setPeriod(p => shiftMonth(p, 1))} className="p-1.5 hover:bg-white rounded-md transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          {/* Save */}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || Object.keys(values).length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              saved ? 'bg-green-500 text-white' :
              Object.keys(values).length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
              'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Сохранено ✓' : saveMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {departments.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Нет отделов</p>
          <p className="text-sm">Сначала завершите настройку компании</p>
        </div>
      )}

      {/* Sales departments */}
      {salesDepts.map((dept: any, idx: number) => {
        const liders = dept.users.filter((u: any) => u.managerType === 'LIDER')
        const closers = dept.users.filter((u: any) => u.managerType === 'CLOSER' || (!u.managerType && u.role === 'MANAGER'))
        const deptLabel = salesDepts.length > 1 ? `${dept.name} №${idx + 1}` : dept.name

        return (
          <div key={dept.id} className="space-y-4">
            {/* Department section header */}
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-gray-800 text-lg">{deptLabel}</h2>
              {dept.hasLiders && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Лидорубы + Клоузеры</span>
              )}
            </div>

            {/* Department-level plan */}
            <SectionCard
              title="План отдела (общий)"
              subtitle="Цели для всего отдела продаж в целом"
              icon={Target}
              iconColor="bg-blue-50"
            >
              <div className="grid grid-cols-2 gap-4">
                {DEPT_SALES_PLANS.map(p => (
                  <PlanInput key={p.type} label={p.label} unit={p.unit} hint={p.hint}
                    value={getVal(p.type, { deptId: dept.id })}
                    onChange={v => setVal(p.type, v, { deptId: dept.id })} />
                ))}
                {dept.hasLiders && DEPT_LIDER_PLANS.map(p => (
                  <PlanInput key={p.type} label={p.label} unit={p.unit} hint={p.hint}
                    value={getVal(p.type, { deptId: dept.id })}
                    onChange={v => setVal(p.type, v, { deptId: dept.id })} />
                ))}
              </div>
            </SectionCard>

            {/* Closers */}
            {closers.length > 0 && (
              <SectionCard
                title={`Клоузеры (${closers.length} чел.)`}
                subtitle="Личные планы по каждому клоузеру"
                icon={TrendingUp}
                iconColor="bg-green-50"
              >
                <div className="space-y-3">
                  {closers.map((u: any) => (
                    <ManagerRow
                      key={u.id}
                      name={u.name}
                      role="Клоузер"
                      plans={MANAGER_CLOSER_PLANS}
                      values={MANAGER_CLOSER_PLANS.reduce((acc, p) => ({
                        ...acc, [p.type]: getVal(p.type, { userId: u.id })
                      }), {})}
                      onChange={(type, val) => setVal(type, val, { userId: u.id })}
                    />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Liders */}
            {liders.length > 0 && (
              <SectionCard
                title={`Лидорубы (${liders.length} чел.)`}
                subtitle="Личные планы по каждому лидорубу"
                icon={Users}
                iconColor="bg-purple-50"
              >
                <div className="space-y-3">
                  {liders.map((u: any) => (
                    <ManagerRow
                      key={u.id}
                      name={u.name}
                      role="Лидоруб"
                      plans={MANAGER_LIDER_PLANS}
                      values={MANAGER_LIDER_PLANS.reduce((acc, p) => ({
                        ...acc, [p.type]: getVal(p.type, { userId: u.id })
                      }), {})}
                      onChange={(type, val) => setVal(type, val, { userId: u.id })}
                    />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* No managers yet */}
            {closers.length === 0 && liders.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>В этом отделе пока нет сотрудников. Добавьте менеджеров в разделе «Сотрудники», чтобы установить им личные планы.</span>
              </div>
            )}
          </div>
        )
      })}

      {/* Marketing */}
      {marketingDepts.map((dept: any) => {
        const marketers = dept.users.filter((u: any) => u.role === 'MARKETER')
        return (
          <div key={dept.id} className="space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-orange-500" />
              <h2 className="font-bold text-gray-800 text-lg">Маркетинг</h2>
            </div>

            <SectionCard
              title="План маркетинга"
              subtitle="Цели по лидогенерации и рекламному бюджету"
              icon={Megaphone}
              iconColor="bg-orange-50"
            >
              <div className="grid grid-cols-2 gap-4">
                {MARKETING_PLANS.map(p => (
                  <PlanInput key={p.type} label={p.label} unit={p.unit} hint={p.hint}
                    value={getVal(p.type, { deptId: dept.id })}
                    onChange={v => setVal(p.type, v, { deptId: dept.id })} />
                ))}
              </div>
            </SectionCard>

            {marketers.length > 0 && (
              <SectionCard
                title={`Маркетологи (${marketers.length} чел.)`}
                subtitle="Личные планы по каждому маркетологу"
                icon={Users}
                iconColor="bg-orange-50"
              >
                <div className="space-y-3">
                  {marketers.map((u: any) => (
                    <ManagerRow
                      key={u.id}
                      name={u.name}
                      role="Маркетолог"
                      plans={[
                        { type: 'LEADS', label: 'Лидов', unit: 'шт', hint: 'Личный план по лидам' },
                        { type: 'BUDGET', label: 'Бюджет', unit: '₸', hint: 'Личный план по рекламному бюджету' },
                      ]}
                      values={{
                        LEADS: getVal('LEADS', { userId: u.id }),
                        BUDGET: getVal('BUDGET', { userId: u.id }),
                      }}
                      onChange={(type, val) => setVal(type, val, { userId: u.id })}
                    />
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )
      })}
    </div>
  )
}
