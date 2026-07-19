import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'

const SPHERES = ['Образование', 'Медицинский центр', 'Недвижимость', 'IT и технологии', 'Розничная торговля', 'Услуги', 'Строительство', 'Другое']

interface Step1 { companyName: string }
interface Step2 { sphere: string }
interface Step3 { deptCount: number }
interface Step4 { structure: 'closers_only' | 'liders_and_closers' }
interface Step5 { liders: number; closers: number; rops: number }

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [s1, setS1] = useState<Step1>({ companyName: '' })
  const [s2, setS2] = useState<Step2>({ sphere: '' })
  const [s3, setS3] = useState<Step3>({ deptCount: 1 })
  const [s4, setS4] = useState<Step4>({ structure: 'closers_only' })
  const [s5, setS5] = useState<Step5>({ liders: 0, closers: 3, rops: 1 })
  const [loading, setLoading] = useState(false)

  const steps = ['Компания', 'Сфера', 'Отделы', 'Структура', 'Сотрудники']

  const finish = async () => {
    setLoading(true)

    try { await api.put('/company', { name: s1.companyName || 'Моя компания', businessSphere: s2.sphere }) }
    catch (e) { console.error('company:', e) }

    try {
      for (let i = 0; i < s3.deptCount; i++) {
        const dept = await api.post('/company/departments', {
          name: s3.deptCount === 1 ? 'Отдел продаж' : `Отдел продаж №${i + 1}`,
          type: 'SALES',
          hasLiders: s4.structure === 'liders_and_closers',
        })
        const period = new Date().toISOString().slice(0, 7)
        await api.post('/plans/bulk', {
          period,
          plans: [
            { type: 'SALES_AMOUNT', value: 1000000, departmentId: dept.data.id },
            { type: 'SALES_COUNT', value: 20, departmentId: dept.data.id },
            { type: 'AVG_CHECK', value: 50000, departmentId: dept.data.id },
          ],
        }).catch(console.error)
      }
    } catch (e) { console.error('sales dept:', e) }

    try {
      const mktDept = await api.post('/company/departments', { name: 'Маркетинг', type: 'MARKETING', hasLiders: false })
      const period = new Date().toISOString().slice(0, 7)
      await api.post('/plans/bulk', {
        period,
        plans: [
          { type: 'LEADS', value: 200, departmentId: mktDept.data.id },
          { type: 'QUALIFIED_LEADS', value: 80, departmentId: mktDept.data.id },
          { type: 'BUDGET', value: 200000, departmentId: mktDept.data.id },
        ],
      }).catch(console.error)
    } catch (e) { console.error('marketing:', e) }

    setLoading(false)
    navigate('/dashboard/owner')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-1 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i + 1 < step ? 'bg-green-500 text-white' : i + 1 === step ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {i + 1 < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i + 1 < step ? 'bg-green-400' : 'bg-gray-100'}`} />}
            </div>
          ))}
        </div>

        <div className="min-h-48">
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Название компании</h2>
              <p className="text-gray-500 text-sm mb-5">Как называется ваша компания?</p>
              <input className="input" placeholder="ООО «Моя компания»" value={s1.companyName} onChange={e => setS1({ companyName: e.target.value })} />
            </div>
          )}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Сфера бизнеса</h2>
              <p className="text-gray-500 text-sm mb-5">Выберите вашу отрасль</p>
              <div className="grid grid-cols-2 gap-2">
                {SPHERES.map(s => (
                  <button key={s} onClick={() => setS2({ sphere: s })} className={`p-3 rounded-lg border text-sm text-left transition-colors ${s2.sphere === s ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Количество отделов продаж</h2>
              <p className="text-gray-500 text-sm mb-5">Сколько отделов продаж в вашей компании?</p>
              <div className="flex gap-3">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setS3({ deptCount: n })} className={`flex-1 py-4 rounded-xl border-2 text-xl font-bold transition-colors ${s3.deptCount === n ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Структура отдела</h2>
              <p className="text-gray-500 text-sm mb-5">Есть ли разделение менеджеров по ролям?</p>
              <div className="space-y-3">
                <button onClick={() => setS4({ structure: 'closers_only' })} className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${s4.structure === 'closers_only' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="font-medium">Только клоузеры</p>
                  <p className="text-sm text-gray-500 mt-0.5">Все менеджеры закрывают сделки</p>
                </button>
                <button onClick={() => setS4({ structure: 'liders_and_closers' })} className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${s4.structure === 'liders_and_closers' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="font-medium">Лидорубы + Клоузеры</p>
                  <p className="text-sm text-gray-500 mt-0.5">Разделение: одни обрабатывают лиды, другие закрывают</p>
                </button>
              </div>
            </div>
          )}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Количество сотрудников</h2>
              <p className="text-gray-500 text-sm mb-5">Укажите численность команды</p>
              <div className="space-y-4">
                <div>
                  <label className="label">РОПов</label>
                  <input type="number" className="input" min={1} value={s5.rops} onChange={e => setS5(f => ({ ...f, rops: +e.target.value }))} />
                </div>
                {s4.structure === 'liders_and_closers' && (
                  <div>
                    <label className="label">Лидорубов</label>
                    <input type="number" className="input" min={0} value={s5.liders} onChange={e => setS5(f => ({ ...f, liders: +e.target.value }))} />
                  </div>
                )}
                <div>
                  <label className="label">Клоузеров</label>
                  <input type="number" className="input" min={1} value={s5.closers} onChange={e => setS5(f => ({ ...f, closers: +e.target.value }))} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} className="btn-secondary flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Назад
            </button>
          ) : <div />}
          {step < 5 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !s1.companyName}
              className="btn-primary flex items-center gap-1"
            >
              Далее <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={finish} disabled={loading} className="btn-primary flex items-center gap-2">
              <Check className="w-4 h-4" />
              {loading ? 'Настраиваем...' : 'Завершить настройку'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
