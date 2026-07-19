import { Link } from 'react-router-dom'
import { BarChart2, TrendingUp, Users, Target, CheckCircle, ArrowRight, Zap, Shield, BarChart } from 'lucide-react'
import { useAuthStore } from '../store/auth'

export default function LandingPage() {
  const user = useAuthStore(s => s.user)

  const features = [
    { icon: BarChart2, title: 'Дашборд в реальном времени', desc: 'Все показатели компании в одном окне — продажи, лиды, выполнение плана по каждому менеджеру.' },
    { icon: Users, title: 'Управление командой', desc: 'Клоузеры, лидорубы и маркетологи в одной системе. Каждый видит только своё, РОП — всё.' },
    { icon: Target, title: 'Планирование и контроль', desc: 'Устанавливайте планы по продажам, лидам, встречам. Следите за выполнением по дням.' },
    { icon: TrendingUp, title: 'Маркетинговая воронка', desc: 'Лиды → квалификация → встречи → продажи. Видите узкое место и стоимость лида.' },
  ]

  const plans = [
    {
      name: 'Триал',
      price: 'Бесплатно',
      period: '14 дней',
      color: 'border-gray-200',
      features: ['До 5 пользователей', 'Все основные функции', 'Дашборды и отчёты', 'Email поддержка'],
    },
    {
      name: 'Стартер',
      price: '₸29 900',
      period: 'в месяц',
      color: 'border-blue-500 ring-2 ring-blue-500',
      badge: 'Популярный',
      features: ['До 15 пользователей', 'Все функции триала', 'Маркетинговая аналитика', 'Приоритетная поддержка'],
    },
    {
      name: 'Pro',
      price: '₸59 900',
      period: 'в месяц',
      color: 'border-gray-200',
      features: ['Неограничено пользователей', 'Все функции Стартера', 'API доступ', 'Выделенный менеджер'],
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">SalesPlatform</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/app" className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Перейти в систему <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Войти</Link>
                <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  Начать бесплатно
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            14 дней бесплатно — без карты
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            CRM для отделов продаж<br />
            <span className="text-blue-600">с умной аналитикой</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            Контролируйте клоузеров, лидорубов и маркетологов в одной системе.
            Видите воронку, план и факт — всё в реальном времени.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/register" className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
              Начать бесплатно <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-xl text-base font-semibold hover:bg-gray-50 transition-colors">
              Войти в систему
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-4">Регистрация занимает 1 минуту · Без привязки карты</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { label: 'Компаний доверяют', value: '50+' },
            { label: 'Отчётов в системе', value: '10 000+' },
            { label: 'Рост конверсии', value: 'до +35%' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold text-blue-600 mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Всё для управления продажами</h2>
            <p className="text-gray-500 max-w-xl mx-auto">От ввода ежедневных результатов до сводного дашборда собственника</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map(f => (
              <div key={f.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Для каждой роли — своё рабочее пространство</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: 'Собственник', color: 'bg-purple-100 text-purple-700', desc: 'Видит всю компанию: продажи, маркетинг, рейтинги, конверсию' },
              { role: 'РОП', color: 'bg-blue-100 text-blue-700', desc: 'Управляет отделом, вводит данные, видит динамику по дням' },
              { role: 'Клоузер', color: 'bg-green-100 text-green-700', desc: 'Вводит свои продажи, видит личный план и прогресс' },
              { role: 'Лидоруб', color: 'bg-orange-100 text-orange-700', desc: 'Ведёт лиды, квалификацию, встречи. Видит свою воронку' },
            ].map(r => (
              <div key={r.role} className="bg-white border border-gray-200 rounded-2xl p-5">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${r.color}`}>{r.role}</span>
                <p className="text-sm text-gray-600">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Простые и понятные тарифы</h2>
            <p className="text-gray-500">Начните бесплатно, масштабируйтесь по мере роста</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {plans.map(p => (
              <div key={p.name} className={`bg-white border-2 rounded-2xl p-6 relative ${p.color}`}>
                {p.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {p.badge}
                  </div>
                )}
                <div className="mb-4">
                  <div className="text-sm font-semibold text-gray-500 mb-1">{p.name}</div>
                  <div className="text-2xl font-extrabold text-gray-900">{p.price}</div>
                  <div className="text-sm text-gray-400">{p.period}</div>
                </div>
                <ul className="space-y-2 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    p.badge ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {p.name === 'Триал' ? 'Начать бесплатно' : 'Выбрать тариф'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 px-6 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <Shield className="w-10 h-10 text-blue-200 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">Надёжно и безопасно</h2>
          <p className="text-blue-100 mb-8">Данные хранятся в защищённом облаке. Регулярные резервные копии. Доступ только авторизованным пользователям.</p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors">
            Зарегистрироваться <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <BarChart className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-700">SalesPlatform</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-gray-700 transition-colors">Войти</Link>
            <Link to="/register" className="hover:text-gray-700 transition-colors">Регистрация</Link>
          </div>
          <div>© {new Date().getFullYear()} SalesPlatform. Все права защищены.</div>
        </div>
      </footer>
    </div>
  )
}
