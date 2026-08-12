import { Link } from 'react-router-dom'
import {
  BarChart2, TrendingUp, Users, Target, CheckCircle, ArrowRight,
  Zap, Shield, BarChart, Clock, Eye, XCircle,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { useT } from '../i18n'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

// ── Inline dashboard mockup ─────────────────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10 bg-[#0f1117] text-white select-none">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-[#1a1d27] border-b border-white/5">
        <span className="w-3 h-3 rounded-full bg-red-500/70" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <span className="w-3 h-3 rounded-full bg-green-500/70" />
        <span className="flex-1 mx-4 text-center text-xs text-white/30">SalesPlatform — Дашборд собственника</span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-14 bg-[#13151f] border-r border-white/5 py-4 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-white" />
          </div>
          {[BarChart2, Users, Target, TrendingUp, BarChart].map((Icon, i) => (
            <div key={i} className={`w-9 h-9 rounded-xl flex items-center justify-center ${i === 0 ? 'bg-blue-600/20' : 'hover:bg-white/5'}`}>
              <Icon className={`w-4 h-4 ${i === 0 ? 'text-blue-400' : 'text-white/30'}`} />
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 space-y-3 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Дашборд собственника</div>
              <div className="text-xs text-white/40">Август 2026</div>
            </div>
            <div className="flex gap-2">
              {['Сегодня','Неделя','Месяц'].map((l, i) => (
                <span key={l} className={`text-xs px-2.5 py-1 rounded-lg ${i === 2 ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40'}`}>{l}</span>
              ))}
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Факт продаж', value: '₸18.4 млн', sub: '73% от плана', color: 'text-emerald-400', sub_color: 'text-emerald-400/70' },
              { label: 'Конверсия', value: '34%', sub: '+4% к прошлому', color: 'text-blue-400', sub_color: 'text-blue-400/70' },
              { label: 'Ср. чек', value: '₸460К', sub: '40 сделок', color: 'text-purple-400', sub_color: 'text-purple-400/70' },
              { label: 'Стоим. лида', value: '₸12 800', sub: '144 лида', color: 'text-amber-400', sub_color: 'text-amber-400/70' },
            ].map(c => (
              <div key={c.label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-white/40 mb-1">{c.label}</div>
                <div className={`text-sm font-bold ${c.color}`}>{c.value}</div>
                <div className={`text-[10px] ${c.sub_color}`}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-5 gap-2">
            {/* Funnel */}
            <div className="col-span-2 bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/40 mb-2">Воронка продаж</div>
              {[
                { label: 'Лиды', val: 144, pct: 100, color: 'bg-purple-500' },
                { label: 'Квалиф.', val: 98, pct: 68, color: 'bg-blue-500' },
                { label: 'Встречи', val: 61, pct: 42, color: 'bg-blue-400' },
                { label: 'Продажи', val: 40, pct: 28, color: 'bg-emerald-500' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-2 mb-1.5">
                  <div className="text-[9px] text-white/30 w-11 text-right shrink-0">{f.label}</div>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${f.color} rounded-full`} style={{ width: `${f.pct}%` }} />
                  </div>
                  <div className="text-[9px] text-white/50 w-5 text-right shrink-0">{f.val}</div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div className="col-span-3 bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/40 mb-2">Продажи по дням</div>
              <div className="flex items-end gap-1 h-16">
                {[55, 72, 48, 91, 63, 80, 45, 95, 70, 88, 55, 73, 92, 68].map((h, i) => (
                  <div key={i} className="flex-1 flex items-end">
                    <div
                      className={`w-full rounded-sm ${i === 13 ? 'bg-blue-500' : 'bg-blue-600/40'}`}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Manager table */}
          <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
            <div className="flex text-[9px] text-white/30 px-3 py-2 border-b border-white/5">
              <span className="flex-1">Клоузер</span>
              <span className="w-16 text-right">Продажи</span>
              <span className="w-16 text-right">Выполн.</span>
              <span className="w-16 text-right">Конверсия</span>
            </div>
            {[
              { name: 'Айгерим К.', sales: '₸5.2М', pct: 104, conv: '42%', color: 'text-emerald-400' },
              { name: 'Данияр М.', sales: '₸4.8М', pct: 96, conv: '38%', color: 'text-blue-400' },
              { name: 'Асель Н.', sales: '₸3.9М', pct: 78, conv: '31%', color: 'text-amber-400' },
            ].map((m, i) => (
              <div key={i} className="flex items-center px-3 py-2 text-[10px] border-b border-white/5 last:border-0">
                <span className="flex-1 text-white/70">{m.name}</span>
                <span className="w-16 text-right text-white/60">{m.sales}</span>
                <span className={`w-16 text-right font-semibold ${m.color}`}>{m.pct}%</span>
                <span className="w-16 text-right text-white/50">{m.conv}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ROP mockup ──────────────────────────────────────────────────────────────
function ROPMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0f1117] shadow-xl shadow-black/30 select-none">
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#1a1d27] border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <span className="text-[10px] text-white/30 ml-2">Кабинет РОПа</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="text-[11px] font-semibold text-white/70">Воронка отдела</div>
        {[
          { label: 'Лидов получено', v: 144, color: 'bg-purple-500' },
          { label: 'Квалифицировано', v: 98, color: 'bg-blue-500' },
          { label: 'Передано клоузеру', v: 72, color: 'bg-blue-400' },
          { label: 'В работе', v: 61, color: 'bg-indigo-400' },
          { label: 'Продажи', v: 40, color: 'bg-emerald-500' },
        ].map((f, i, arr) => (
          <div key={f.label} className="flex items-center gap-2">
            <div
              className={`${f.color} rounded-lg flex items-center justify-between px-2 h-7 text-white`}
              style={{ width: `${(f.v / arr[0].v) * 100}%`, minWidth: '60%' }}
            >
              <span className="text-[9px] font-medium truncate">{f.label}</span>
              <span className="text-[9px] font-bold ml-1 shrink-0">{f.v}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Manager mockup ──────────────────────────────────────────────────────────
function ManagerMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0f1117] shadow-xl shadow-black/30 select-none">
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#1a1d27] border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <span className="text-[10px] text-white/30 ml-2">Мой кабинет — Данияр</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="text-[11px] font-semibold text-white/70">Мои показатели</div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { l: 'Продажи', v: '₸4.8М', c: 'text-emerald-400' },
            { l: 'Выполн.', v: '96%', c: 'text-blue-400' },
            { l: 'Сделок', v: '18', c: 'text-purple-400' },
            { l: 'Конверсия', v: '38%', c: 'text-amber-400' },
          ].map(m => (
            <div key={m.l} className="bg-white/5 rounded-xl p-2 border border-white/5">
              <div className="text-[9px] text-white/30">{m.l}</div>
              <div className={`text-sm font-bold ${m.c}`}>{m.v}</div>
            </div>
          ))}
        </div>
        {/* Plan progress */}
        <div className="bg-white/5 rounded-xl p-2 border border-white/5">
          <div className="flex justify-between text-[9px] text-white/40 mb-1.5">
            <span>План: ₸5 000 000</span><span>96%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '96%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const user = useAuthStore(s => s.user)
  const { t } = useT()

  const features = [
    { icon: BarChart2,   titleKey: 'landing.features.f1.title', descKey: 'landing.features.f1.desc' },
    { icon: Users,       titleKey: 'landing.features.f2.title', descKey: 'landing.features.f2.desc' },
    { icon: Target,      titleKey: 'landing.features.f3.title', descKey: 'landing.features.f3.desc' },
    { icon: TrendingUp,  titleKey: 'landing.features.f4.title', descKey: 'landing.features.f4.desc' },
  ]

  const plans = [
    {
      nameKey: 'landing.pricing.trial.name',
      price: t('landing.pricing.trial.price'),
      periodKey: 'landing.pricing.trial.period',
      color: 'border-white/10 bg-white/5',
      textColor: 'text-white',
      featKeys: ['landing.pricing.trial.f1','landing.pricing.trial.f2','landing.pricing.trial.f3','landing.pricing.trial.f4'],
    },
    {
      nameKey: 'landing.pricing.starter.name',
      price: '₸59 900',
      periodKey: 'landing.pricing.starter.period',
      color: 'border-blue-500 bg-blue-600',
      textColor: 'text-white',
      badgeKey: 'landing.pricing.starter.badge',
      featKeys: ['landing.pricing.starter.f1','landing.pricing.starter.f2','landing.pricing.starter.f3','landing.pricing.starter.f4'],
    },
    {
      nameKey: 'landing.pricing.pro.name',
      price: '₸99 900',
      periodKey: 'landing.pricing.pro.period',
      color: 'border-white/10 bg-white/5',
      textColor: 'text-white',
      featKeys: ['landing.pricing.pro.f1','landing.pricing.pro.f2','landing.pricing.pro.f3','landing.pricing.pro.f4'],
    },
  ]

  return (
    <div className="min-h-screen bg-[#080a10] text-white">

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#080a10]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">SalesPlatform</span>
          </div>
          <div className="flex items-center gap-5">
            <LanguageSwitcher />
            {user ? (
              <Link to="/app" className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                {t('landing.nav.goToSystem')} <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-white/50 hover:text-white text-sm font-medium transition-colors hidden sm:block">
                  {t('landing.nav.login')}
                </Link>
                <Link to="/register" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50">
                  {t('landing.nav.startFree')}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-0 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-purple-600/5 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-8">
            <Zap className="w-3.5 h-3.5" />
            {t('landing.notcrm')}
          </div>

          <h1 className="text-6xl sm:text-7xl font-extrabold text-white leading-[1.05] mb-4">
            {t('landing.hero.title')}
          </h1>
          <h2 className="text-6xl sm:text-7xl font-extrabold leading-[1.05] mb-8 bg-gradient-to-r from-blue-400 via-blue-300 to-purple-400 bg-clip-text text-transparent">
            {t('landing.hero.subtitle')}
          </h2>
          <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('landing.hero.desc')}
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap mb-4">
            <Link to="/register" className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-blue-500 transition-all shadow-2xl shadow-blue-900/50 hover:shadow-blue-700/40">
              {t('landing.hero.startFree')} <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="flex items-center gap-2 border border-white/10 text-white/70 px-8 py-4 rounded-xl text-base font-semibold hover:bg-white/5 hover:border-white/20 transition-all">
              {t('landing.hero.login')}
            </Link>
          </div>
          <p className="text-sm text-white/30 mb-16">{t('landing.hero.regNote')}</p>

          {/* Dashboard mockup */}
          <div className="relative mx-auto max-w-5xl">
            {/* Glow under mockup */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-blue-600/20 blur-3xl rounded-full" />
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────────── */}
      <section className="py-16 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { value: '50+',    labelKey: 'landing.stats.companies' },
            { value: '10 000+',labelKey: 'landing.stats.reports' },
            { value: '+35%',   labelKey: 'landing.stats.conversion' },
          ].map(s => (
            <div key={s.labelKey}>
              <div className="text-4xl font-extrabold text-white mb-1">{s.value}</div>
              <div className="text-sm text-white/40">{t(s.labelKey as any)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pain points ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold uppercase tracking-widest text-red-400 mb-4">Боли собственника</div>
            <h2 className="text-4xl font-bold text-white mb-4">{t('landing.pain.title')}</h2>
            <p className="text-white/40 max-w-xl mx-auto">{t('landing.pain.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: Clock,
                iconBg: 'bg-red-500/10',
                iconColor: 'text-red-400',
                titleKey: 'landing.pain.p1.title',
                descKey: 'landing.pain.p1.desc',
                border: 'border-red-500/10',
              },
              {
                icon: XCircle,
                iconBg: 'bg-amber-500/10',
                iconColor: 'text-amber-400',
                titleKey: 'landing.pain.p2.title',
                descKey: 'landing.pain.p2.desc',
                border: 'border-amber-500/10',
              },
              {
                icon: Eye,
                iconBg: 'bg-purple-500/10',
                iconColor: 'text-purple-400',
                titleKey: 'landing.pain.p3.title',
                descKey: 'landing.pain.p3.desc',
                border: 'border-purple-500/10',
              },
            ].map(p => (
              <div key={p.titleKey} className={`bg-white/[0.03] border ${p.border} rounded-2xl p-7`}>
                <div className={`w-11 h-11 ${p.iconBg} rounded-xl flex items-center justify-center mb-5`}>
                  <p.icon className={`w-5 h-5 ${p.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{t(p.titleKey as any)}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{t(p.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution: role mockups ────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-400 mb-4">Решение</div>
            <h2 className="text-4xl font-bold text-white mb-4">{t('landing.roles.title')}</h2>
            <p className="text-white/40 max-w-xl mx-auto">Каждая роль видит именно то, что нужно ей. Не больше, не меньше.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Owner + label */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 mb-3">
                  {t('role.OWNER')}
                </span>
                <p className="text-sm text-white/50 leading-relaxed">{t('landing.roles.owner.desc')}</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 mb-3">
                  {t('role.ROP')}
                </span>
                <p className="text-sm text-white/50 leading-relaxed">{t('landing.roles.rop.desc')}</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 mb-3">
                  {t('role.closer')}
                </span>
                <p className="text-sm text-white/50 leading-relaxed">{t('landing.roles.closer.desc')}</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 mb-3">
                  {t('role.lider')}
                </span>
                <p className="text-sm text-white/50 leading-relaxed">{t('landing.roles.lider.desc')}</p>
              </div>
            </div>

            {/* Mockups stacked */}
            <div className="lg:col-span-2 space-y-4">
              <ROPMockup />
              <ManagerMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-400 mb-4">{t('landing.how.badge')}</div>
            <h2 className="text-4xl font-bold text-white">{t('landing.how.title')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            {/* Connector */}
            <div className="hidden sm:block absolute top-8 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

            {[
              { num: '01', titleKey: 'landing.how.s1.title', descKey: 'landing.how.s1.desc', color: 'from-blue-600 to-blue-500' },
              { num: '02', titleKey: 'landing.how.s2.title', descKey: 'landing.how.s2.desc', color: 'from-blue-500 to-purple-500' },
              { num: '03', titleKey: 'landing.how.s3.title', descKey: 'landing.how.s3.desc', color: 'from-purple-500 to-purple-400' },
            ].map(step => (
              <div key={step.titleKey} className="relative text-center sm:text-left">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5 mx-auto sm:mx-0 shadow-lg`}>
                  <span className="text-white font-extrabold text-base">{step.num}</span>
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{t(step.titleKey as any)}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{t(step.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-400 mb-4">Возможности</div>
            <h2 className="text-4xl font-bold text-white mb-4">{t('landing.features.title')}</h2>
            <p className="text-white/40 max-w-xl mx-auto">{t('landing.features.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map(f => (
              <div key={f.titleKey} className="group bg-white/[0.03] border border-white/8 rounded-2xl p-7 hover:border-blue-500/30 hover:bg-blue-600/5 transition-all">
                <div className="w-11 h-11 bg-blue-600/10 group-hover:bg-blue-600/20 rounded-xl flex items-center justify-center mb-5 transition-colors">
                  <f.icon className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{t(f.titleKey as any)}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{t(f.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-400 mb-4">Тарифы</div>
            <h2 className="text-4xl font-bold text-white mb-4">{t('landing.pricing.title')}</h2>
            <p className="text-white/40">{t('landing.pricing.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {plans.map(p => (
              <div key={p.nameKey} className={`border-2 rounded-2xl p-7 relative ${p.color}`}>
                {p.badgeKey && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white text-blue-600 text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap shadow-lg">
                    {t(p.badgeKey as any)}
                  </div>
                )}
                <div className="mb-6">
                  <div className="text-sm font-semibold text-white/50 mb-1">{t(p.nameKey as any)}</div>
                  <div className="text-3xl font-extrabold text-white">{p.price}</div>
                  <div className="text-sm text-white/40">{t(p.periodKey as any)}</div>
                </div>
                <ul className="space-y-3 mb-7">
                  {p.featKeys.map(fk => (
                    <li key={fk} className="flex items-start gap-2.5 text-sm text-white/60">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {t(fk as any)}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                    p.badgeKey
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'border border-white/20 text-white hover:bg-white/10'
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
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-7 h-7 text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">{t('landing.trust.title')}</h2>
          <p className="text-white/40 mb-10 leading-relaxed max-w-xl mx-auto">{t('landing.trust.desc')}</p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-blue-500 transition-all shadow-2xl shadow-blue-900/50"
          >
            {t('landing.trust.btn')} <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-sm text-white/25 mt-5">{t('landing.hero.regNote')}</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
                <BarChart className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-white">SalesPlatform</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-white/30 flex-wrap">
              <Link to="/login" className="hover:text-white transition-colors">{t('landing.footer.login')}</Link>
              <Link to="/register" className="hover:text-white transition-colors">{t('landing.footer.register')}</Link>
              <Link to="/oferta" className="hover:text-white transition-colors">{t('landing.footer.oferta')}</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">{t('landing.footer.privacy')}</Link>
            </div>

            <div className="text-sm text-white/20">
              © {new Date().getFullYear()} SalesPlatform. {t('landing.footer.rights')}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
