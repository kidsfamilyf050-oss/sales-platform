import { Link } from 'react-router-dom'
import {
  BarChart2, TrendingUp, Users, Target, CheckCircle, ArrowRight,
  Zap, Shield, BarChart, AlertCircle, RefreshCw, Eye,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { useT } from '../i18n'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function LandingPage() {
  const user = useAuthStore(s => s.user)
  const { t } = useT()

  const features = [
    { icon: BarChart2,   titleKey: 'landing.features.f1.title', descKey: 'landing.features.f1.desc' },
    { icon: Users,       titleKey: 'landing.features.f2.title', descKey: 'landing.features.f2.desc' },
    { icon: Target,      titleKey: 'landing.features.f3.title', descKey: 'landing.features.f3.desc' },
    { icon: TrendingUp,  titleKey: 'landing.features.f4.title', descKey: 'landing.features.f4.desc' },
  ]

  const painPoints = [
    { icon: AlertCircle, color: 'text-red-500',    bg: 'bg-red-50',    titleKey: 'landing.pain.p1.title', descKey: 'landing.pain.p1.desc' },
    { icon: RefreshCw,   color: 'text-amber-500',  bg: 'bg-amber-50',  titleKey: 'landing.pain.p2.title', descKey: 'landing.pain.p2.desc' },
    { icon: Eye,         color: 'text-purple-500', bg: 'bg-purple-50', titleKey: 'landing.pain.p3.title', descKey: 'landing.pain.p3.desc' },
  ]

  const howSteps = [
    { num: '01', titleKey: 'landing.how.s1.title', descKey: 'landing.how.s1.desc' },
    { num: '02', titleKey: 'landing.how.s2.title', descKey: 'landing.how.s2.desc' },
    { num: '03', titleKey: 'landing.how.s3.title', descKey: 'landing.how.s3.desc' },
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

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
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
                <Link to="/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors hidden sm:block">
                  {t('landing.nav.login')}
                </Link>
                <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  {t('landing.nav.startFree')}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          {/* "Not CRM" badge */}
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <Zap className="w-3.5 h-3.5" />
            {t('landing.notcrm')}
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-[1.1] mb-2">
            {t('landing.hero.title')}
          </h1>
          <h2 className="text-5xl sm:text-6xl font-extrabold text-blue-600 leading-[1.1] mb-8">
            {t('landing.hero.subtitle')}
          </h2>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('landing.hero.desc')}
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/register" className="flex items-center gap-2 bg-blue-600 text-white px-7 py-3.5 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
              {t('landing.hero.startFree')} <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-7 py-3.5 rounded-xl text-base font-semibold hover:bg-gray-50 transition-colors">
              {t('landing.hero.login')}
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-5">{t('landing.hero.regNote')}</p>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="py-10 bg-white border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { value: '50+',    labelKey: 'landing.stats.companies' },
            { value: '10 000+',labelKey: 'landing.stats.reports' },
            { value: '+35%',   labelKey: 'landing.stats.conversion' },
          ].map(s => (
            <div key={s.labelKey}>
              <div className="text-3xl font-extrabold text-blue-600 mb-0.5">{s.value}</div>
              <div className="text-sm text-gray-500">{t(s.labelKey as any)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pain Points ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">{t('landing.pain.title')}</h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">{t('landing.pain.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {painPoints.map(p => (
              <div key={p.titleKey} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className={`w-10 h-10 ${p.bg} rounded-xl flex items-center justify-center mb-4`}>
                  <p.icon className={`w-5 h-5 ${p.color}`} />
                </div>
                <h3 className="font-bold text-white mb-2 text-base">{t(p.titleKey as any)}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t(p.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-blue-600">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-500 text-blue-100 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <Zap className="w-3.5 h-3.5" />
              {t('landing.how.badge')}
            </div>
            <h2 className="text-3xl font-bold text-white">{t('landing.how.title')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {howSteps.map((step, i) => (
              <div key={step.titleKey} className="relative">
                {/* Connector line */}
                {i < howSteps.length - 1 && (
                  <div className="hidden sm:block absolute top-6 left-full w-full h-px bg-blue-400/50 z-0" style={{ width: 'calc(100% - 48px)', left: 'calc(50% + 24px)' }} />
                )}
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-white/20 border border-white/30 rounded-2xl flex items-center justify-center mb-4 mx-auto sm:mx-0">
                    <span className="text-white font-bold text-sm">{step.num}</span>
                  </div>
                  <h3 className="font-bold text-white mb-2">{t(step.titleKey as any)}</h3>
                  <p className="text-blue-100 text-sm leading-relaxed">{t(step.descKey as any)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('landing.features.title')}</h2>
            <p className="text-gray-500 max-w-xl mx-auto">{t('landing.features.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map(f => (
              <div key={f.titleKey} className="group bg-white border border-gray-100 rounded-2xl p-6 hover:border-blue-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center mb-4 transition-colors">
                  <f.icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{t(f.titleKey as any)}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{t(f.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ────────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('landing.roles.title')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { roleKey: 'role.OWNER', color: 'bg-purple-100 text-purple-700', border: 'border-purple-100', descKey: 'landing.roles.owner.desc' },
              { roleKey: 'role.ROP',   color: 'bg-blue-100 text-blue-700',     border: 'border-blue-100',   descKey: 'landing.roles.rop.desc' },
              { roleKey: 'role.closer',color: 'bg-green-100 text-green-700',   border: 'border-green-100',  descKey: 'landing.roles.closer.desc' },
              { roleKey: 'role.lider', color: 'bg-orange-100 text-orange-700', border: 'border-orange-100', descKey: 'landing.roles.lider.desc' },
            ].map(r => (
              <div key={r.roleKey} className={`bg-white border ${r.border} rounded-2xl p-5`}>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${r.color}`}>
                  {t(r.roleKey as any)}
                </span>
                <p className="text-sm text-gray-600 leading-relaxed">{t(r.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
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
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {t(p.badgeKey as any)}
                  </div>
                )}
                <div className="mb-5">
                  <div className="text-sm font-semibold text-gray-500 mb-1">{t(p.nameKey as any)}</div>
                  <div className="text-2xl font-extrabold text-gray-900">{p.price}</div>
                  <div className="text-sm text-gray-400">{t(p.periodKey as any)}</div>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {p.featKeys.map(fk => (
                    <li key={fk} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
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

      {/* ── Trust CTA ────────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-gray-950">
        <div className="max-w-3xl mx-auto text-center">
          <Shield className="w-10 h-10 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">{t('landing.trust.title')}</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">{t('landing.trust.desc')}</p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-blue-700 transition-colors"
          >
            {t('landing.trust.btn')} <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-sm text-gray-500 mt-4">{t('landing.hero.regNote')}</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
                <BarChart className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-gray-700">SalesPlatform</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-400 flex-wrap">
              <Link to="/login" className="hover:text-gray-700 transition-colors">{t('landing.footer.login')}</Link>
              <Link to="/register" className="hover:text-gray-700 transition-colors">{t('landing.footer.register')}</Link>
              <Link to="/oferta" className="hover:text-gray-700 transition-colors">{t('landing.footer.oferta')}</Link>
              <Link to="/privacy" className="hover:text-gray-700 transition-colors">{t('landing.footer.privacy')}</Link>
            </div>

            <div className="text-sm text-gray-400">
              © {new Date().getFullYear()} SalesPlatform. {t('landing.footer.rights')}
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
