import { Link } from 'react-router-dom'
import { BarChart2, TrendingUp, Users, Target, CheckCircle, ArrowRight, Zap, Shield, BarChart } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { useT } from '../i18n'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function LandingPage() {
  const user = useAuthStore(s => s.user)
  const { t } = useT()

  const features = [
    { icon: BarChart2, titleKey: 'landing.features.f1.title', descKey: 'landing.features.f1.desc' },
    { icon: Users,     titleKey: 'landing.features.f2.title', descKey: 'landing.features.f2.desc' },
    { icon: Target,    titleKey: 'landing.features.f3.title', descKey: 'landing.features.f3.desc' },
    { icon: TrendingUp,titleKey: 'landing.features.f4.title', descKey: 'landing.features.f4.desc' },
  ]

  const plans = [
    {
      nameKey: 'landing.pricing.trial.name',
      price: t('landing.pricing.trial.price'),
      periodKey: 'landing.pricing.trial.period',
      color: 'border-gray-200',
      featKeys: ['landing.pricing.trial.f1','landing.pricing.trial.f2','landing.pricing.trial.f3','landing.pricing.trial.f4'],
    },
    {
      nameKey: 'landing.pricing.starter.name',
      price: '₸29 900',
      periodKey: 'landing.pricing.starter.period',
      color: 'border-blue-500 ring-2 ring-blue-500',
      badgeKey: 'landing.pricing.starter.badge',
      featKeys: ['landing.pricing.starter.f1','landing.pricing.starter.f2','landing.pricing.starter.f3','landing.pricing.starter.f4'],
    },
    {
      nameKey: 'landing.pricing.pro.name',
      price: '₸59 900',
      periodKey: 'landing.pricing.pro.period',
      color: 'border-gray-200',
      featKeys: ['landing.pricing.pro.f1','landing.pricing.pro.f2','landing.pricing.pro.f3','landing.pricing.pro.f4'],
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
            <LanguageSwitcher />
            {user ? (
              <Link to="/app" className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                {t('landing.nav.goToSystem')} <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">{t('landing.nav.login')}</Link>
                <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  {t('landing.nav.startFree')}
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
            {t('landing.badge')}
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            {t('landing.hero.title')}<br />
            <span className="text-blue-600">{t('landing.hero.subtitle')}</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            {t('landing.hero.desc')}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/register" className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
              {t('landing.hero.startFree')} <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-xl text-base font-semibold hover:bg-gray-50 transition-colors">
              {t('landing.hero.login')}
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-4">{t('landing.hero.regNote')}</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { labelKey: 'landing.stats.companies', value: '50+' },
            { labelKey: 'landing.stats.reports', value: '10 000+' },
            { labelKey: 'landing.stats.conversion', value: t('landing.stats.conversion') === 'Рост конверсии' ? 'до +35%' : '+35%-ға дейін' },
          ].map(s => (
            <div key={s.labelKey}>
              <div className="text-3xl font-extrabold text-blue-600 mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{t(s.labelKey as any)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('landing.features.title')}</h2>
            <p className="text-gray-500 max-w-xl mx-auto">{t('landing.features.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map(f => (
              <div key={f.titleKey} className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{t(f.titleKey as any)}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{t(f.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('landing.roles.title')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { roleKey: 'role.OWNER', color: 'bg-purple-100 text-purple-700', descKey: 'landing.roles.owner.desc' },
              { roleKey: 'role.ROP',   color: 'bg-blue-100 text-blue-700',   descKey: 'landing.roles.rop.desc' },
              { roleKey: 'role.closer',color: 'bg-green-100 text-green-700', descKey: 'landing.roles.closer.desc' },
              { roleKey: 'role.lider', color: 'bg-orange-100 text-orange-700',descKey: 'landing.roles.lider.desc' },
            ].map(r => (
              <div key={r.roleKey} className="bg-white border border-gray-200 rounded-2xl p-5">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${r.color}`}>{t(r.roleKey as any)}</span>
                <p className="text-sm text-gray-600">{t(r.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('landing.pricing.title')}</h2>
            <p className="text-gray-500">{t('landing.pricing.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {plans.map(p => (
              <div key={p.nameKey} className={`bg-white border-2 rounded-2xl p-6 relative ${p.color}`}>
                {p.badgeKey && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t(p.badgeKey as any)}
                  </div>
                )}
                <div className="mb-4">
                  <div className="text-sm font-semibold text-gray-500 mb-1">{t(p.nameKey as any)}</div>
                  <div className="text-2xl font-extrabold text-gray-900">{p.price}</div>
                  <div className="text-sm text-gray-400">{t(p.periodKey as any)}</div>
                </div>
                <ul className="space-y-2 mb-6">
                  {p.featKeys.map(fk => (
                    <li key={fk} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {t(fk as any)}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    p.badgeKey ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {p.nameKey === 'landing.pricing.trial.name' ? t('landing.pricing.startFree') : t('landing.pricing.choose')}
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
          <h2 className="text-2xl font-bold text-white mb-3">{t('landing.trust.title')}</h2>
          <p className="text-blue-100 mb-8">{t('landing.trust.desc')}</p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors">
            {t('landing.trust.btn')} <ArrowRight className="w-4 h-4" />
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
            <Link to="/login" className="hover:text-gray-700 transition-colors">{t('landing.footer.login')}</Link>
            <Link to="/register" className="hover:text-gray-700 transition-colors">{t('landing.footer.register')}</Link>
          </div>
          <div>© {new Date().getFullYear()} SalesPlatform. {t('landing.footer.rights')}</div>
        </div>
      </footer>
    </div>
  )
}
