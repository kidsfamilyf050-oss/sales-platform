import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart2, TrendingUp, Users, Target, CheckCircle, ArrowRight,
  Zap, BarChart, XCircle, ChevronDown, ChevronRight,
  AlertTriangle, Phone, MessageSquare, X, Check,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { useT } from '../i18n'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

// ── Dashboard Mockup ────────────────────────────────────────────────────────
function DashboardMockup() {
  const { t } = useT()
  const periods = [t('mock.period.today' as any), t('mock.period.week' as any), t('mock.period.month' as any)]
  const kpis = [
    { label: t('mock.kpi.sales' as any), value: '₸18.4 млн', sub: t('mock.kpi.sales.sub' as any), vc: 'text-emerald-600' },
    { label: t('mock.kpi.conv' as any),  value: '34%',        sub: t('mock.kpi.conv.sub' as any),  vc: 'text-blue-600' },
    { label: t('mock.kpi.check' as any), value: '₸460К',      sub: t('mock.kpi.check.sub' as any), vc: 'text-purple-600' },
    { label: t('mock.kpi.lead' as any),  value: '₸12 800',    sub: t('mock.kpi.lead.sub' as any),  vc: 'text-amber-600' },
  ]
  const funnel = [
    { label: t('mock.funnel.leads' as any), val: 144, pct: 100, color: 'bg-purple-500' },
    { label: t('mock.funnel.qual' as any),  val: 98,  pct: 68,  color: 'bg-blue-500' },
    { label: t('mock.funnel.meet' as any),  val: 61,  pct: 42,  color: 'bg-blue-400' },
    { label: t('mock.funnel.sales' as any), val: 40,  pct: 28,  color: 'bg-emerald-500' },
  ]
  const managers = [
    { rank: 1, name: 'Айгерим К.', dept: t('mock.dept.a' as any), sales: '₸5.2М', pct: 104, deals: 21, trend: '+12%', pctBar: 100, tc: 'text-emerald-600', bg: 'bg-emerald-500', rankBg: 'bg-emerald-100 text-emerald-700' },
    { rank: 2, name: 'Данияр М.',  dept: t('mock.dept.a' as any), sales: '₸4.8М', pct: 96,  deals: 18, trend: '+5%',  pctBar: 92,  tc: 'text-blue-600',   bg: 'bg-blue-500',   rankBg: 'bg-blue-100 text-blue-700' },
    { rank: 3, name: 'Асель Н.',   dept: t('mock.dept.b' as any), sales: '₸3.9М', pct: 78,  deals: 14, trend: '-3%',  pctBar: 75,  tc: 'text-amber-600',  bg: 'bg-amber-500',  rankBg: 'bg-amber-100 text-amber-700' },
  ]
  const bars = [
    {v:2.1},{v:2.9},{v:1.7},{v:3.6},{v:2.5},{v:3.2},{v:1.9},{v:4.0},
    {v:3.0},{v:3.7},{v:2.2},{v:3.1},{v:4.2},{v:2.7},
  ]
  const maxBar = 4.2

  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-2xl shadow-blue-100 border border-gray-200 bg-white select-none">
      <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <span className="flex-1 text-center text-xs text-gray-400 mx-4">{t('mock.dashboard.tab' as any)}</span>
      </div>
      <div className="flex">
        <div className="w-14 bg-white border-r border-gray-100 py-4 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-white" />
          </div>
          {[BarChart2, Users, Target, TrendingUp, BarChart].map((Icon, i) => (
            <div key={i} className={`w-9 h-9 rounded-xl flex items-center justify-center ${i === 0 ? 'bg-blue-50' : ''}`}>
              <Icon className={`w-4 h-4 ${i === 0 ? 'text-blue-600' : 'text-gray-300'}`} />
            </div>
          ))}
        </div>
        <div className="flex-1 p-4 space-y-3 min-w-0 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">{t('mock.dashboard.title' as any)}</div>
              <div className="text-xs text-gray-400">{t('mock.dashboard.period' as any)}</div>
            </div>
            <div className="flex gap-2 pointer-events-none">
              {periods.map((l, i) => (
                <span key={i} className={`text-xs px-2.5 py-1 rounded-lg ${i === 2 ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>{l}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {kpis.map(c => (
              <div key={c.label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                <div className="text-[10px] text-gray-400 mb-1">{c.label}</div>
                <div className={`text-sm font-bold ${c.vc}`}>{c.value}</div>
                <div className="text-[10px] text-gray-400">{c.sub}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-2 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
              <div className="text-[10px] text-gray-500 font-medium mb-2">{t('mock.funnel.title' as any)}</div>
              {funnel.map(f => (
                <div key={f.label} className="flex items-center gap-2 mb-1.5">
                  <div className="text-[9px] text-gray-400 w-11 text-right shrink-0">{f.label}</div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${f.color} rounded-full`} style={{ width: `${f.pct}%` }} />
                  </div>
                  <div className="text-[9px] text-gray-500 w-5 shrink-0">{f.val}</div>
                </div>
              ))}
            </div>
            <div className="col-span-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-gray-500 font-medium">{t('mock.chart.title' as any)}</div>
                <div className="text-[9px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full">↑ +18%</div>
              </div>
              <div className="flex items-end gap-1" style={{ height: 60 }}>
                {bars.map((b, i) => {
                  const isToday = i === 12
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                      {isToday && <div className="text-[7px] font-bold text-blue-600 leading-none">₸{b.v}М</div>}
                      <div className={`w-full rounded-t-sm ${isToday ? 'bg-blue-600' : 'bg-blue-200'}`} style={{ height: `${Math.round((b.v / maxBar) * 52)}px` }} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <div className="text-[10px] font-semibold text-gray-600">{t('mock.rating.title' as any)}</div>
              <div className="text-[9px] text-blue-600 font-medium">{t('mock.rating.period' as any)}</div>
            </div>
            {managers.map(m => (
              <div key={m.rank} className="px-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-lg text-[9px] font-bold flex items-center justify-center flex-none ${m.rankBg}`}>{m.rank}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-gray-800">{m.name}</span>
                      <span className="text-[8px] text-gray-400">{m.dept}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${m.bg} rounded-full`} style={{ width: `${m.pctBar}%` }} />
                      </div>
                      <span className={`text-[9px] font-bold ${m.tc}`}>{m.pct}%</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold text-gray-800">{m.sales}</div>
                    <div className="text-[8px] text-gray-400">{m.deals} {t('mock.deals' as any)}</div>
                  </div>
                  <div className="text-right shrink-0 w-10">
                    <div className={`text-[8px] font-semibold ${m.trend.startsWith('+') ? 'text-emerald-500' : 'text-red-400'}`}>{m.trend}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ROPMockup() {
  const { t } = useT()
  const funnelItems = [
    { label: t('mock.rop.f1' as any), v: 144 },
    { label: t('mock.rop.f2' as any), v: 98 },
    { label: t('mock.rop.f3' as any), v: 72 },
    { label: t('mock.rop.f4' as any), v: 61 },
    { label: t('mock.rop.f5' as any), v: 40 },
  ]
  const colors = ['bg-purple-500', 'bg-blue-500', 'bg-blue-400', 'bg-indigo-400', 'bg-emerald-500']
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-lg select-none">
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="text-[10px] text-gray-400 ml-2">{t('mock.rop.tab' as any)}</span>
      </div>
      <div className="p-3 space-y-2 bg-gray-50/50">
        <div className="text-[11px] font-semibold text-gray-700 mb-1">{t('mock.rop.funnel' as any)}</div>
        {funnelItems.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`${colors[i]} rounded-lg flex items-center justify-between px-2 h-7 text-white`}
              style={{ width: `${(f.v / funnelItems[0].v) * 100}%`, minWidth: '60%' }}
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

function ManagerMockup() {
  const { t } = useT()
  const metrics = [
    { l: t('mock.mgr.m1' as any), v: '₸4.8М', c: 'text-emerald-600' },
    { l: t('mock.mgr.m2' as any), v: '96%',    c: 'text-blue-600' },
    { l: t('mock.mgr.m3' as any), v: '18',      c: 'text-purple-600' },
    { l: t('mock.mgr.m4' as any), v: '38%',     c: 'text-amber-600' },
  ]
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-lg select-none">
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="text-[10px] text-gray-400 ml-2">{t('mock.mgr.tab' as any)}</span>
      </div>
      <div className="p-3 space-y-2 bg-gray-50/50">
        <div className="text-[11px] font-semibold text-gray-700">{t('mock.mgr.title' as any)}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {metrics.map(m => (
            <div key={m.l} className="bg-white rounded-xl p-2 border border-gray-100 shadow-sm">
              <div className="text-[9px] text-gray-400">{m.l}</div>
              <div className={`text-sm font-bold ${m.c}`}>{m.v}</div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl p-2 border border-gray-100 shadow-sm">
          <div className="flex justify-between text-[9px] text-gray-400 mb-1.5">
            <span>{t('mock.mgr.plan' as any)} ₸5 000 000</span><span>96%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '96%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── FAQ Accordion ───────────────────────────────────────────────────────────
function FAQ({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="font-semibold text-gray-900 text-sm pr-4">{item.q}</span>
            <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && (
            <div className="px-6 pb-5 text-gray-500 text-sm leading-relaxed border-t border-gray-100 pt-4">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function LandingPage() {
  const user = useAuthStore(s => s.user)
  const { t } = useT()

  const features = [
    { icon: BarChart2,  titleKey: 'landing.features.f1.title', descKey: 'landing.features.f1.desc' },
    { icon: Users,      titleKey: 'landing.features.f2.title', descKey: 'landing.features.f2.desc' },
    { icon: Target,     titleKey: 'landing.features.f3.title', descKey: 'landing.features.f3.desc' },
    { icon: TrendingUp, titleKey: 'landing.features.f4.title', descKey: 'landing.features.f4.desc' },
  ]

  const plans = [
    {
      nameKey: 'landing.pricing.trial.name',
      price: t('landing.pricing.trial.price'),
      periodKey: 'landing.pricing.trial.period',
      highlight: false,
      featKeys: ['landing.pricing.trial.f1','landing.pricing.trial.f2','landing.pricing.trial.f3','landing.pricing.trial.f4'],
    },
    {
      nameKey: 'landing.pricing.starter.name',
      price: '₸59 900',
      periodKey: 'landing.pricing.starter.period',
      highlight: true,
      badgeKey: 'landing.pricing.starter.badge',
      featKeys: ['landing.pricing.starter.f1','landing.pricing.starter.f2','landing.pricing.starter.f3','landing.pricing.starter.f4'],
    },
    {
      nameKey: 'landing.pricing.pro.name',
      price: '₸99 900',
      periodKey: 'landing.pricing.pro.period',
      highlight: false,
      featKeys: ['landing.pricing.pro.f1','landing.pricing.pro.f2','landing.pricing.pro.f3','landing.pricing.pro.f4'],
    },
  ]

  const painScenarios = [
    { icon: Phone,          bg: 'bg-red-50',    border: 'border-red-100',    ic: 'text-red-500',
      scene: t('landing.pain.s1.scene' as any), result: t('landing.pain.s1.result' as any) },
    { icon: MessageSquare,  bg: 'bg-amber-50',  border: 'border-amber-100',  ic: 'text-amber-500',
      scene: t('landing.pain.s2.scene' as any), result: t('landing.pain.s2.result' as any) },
    { icon: AlertTriangle,  bg: 'bg-orange-50', border: 'border-orange-100', ic: 'text-orange-500',
      scene: t('landing.pain.s3.scene' as any), result: t('landing.pain.s3.result' as any) },
    { icon: XCircle,        bg: 'bg-purple-50', border: 'border-purple-100', ic: 'text-purple-500',
      scene: t('landing.pain.s4.scene' as any), result: t('landing.pain.s4.result' as any) },
  ]

  const compareRows = [
    { b: t('landing.compare.r1.b' as any), a: t('landing.compare.r1.a' as any) },
    { b: t('landing.compare.r2.b' as any), a: t('landing.compare.r2.a' as any) },
    { b: t('landing.compare.r3.b' as any), a: t('landing.compare.r3.a' as any) },
    { b: t('landing.compare.r4.b' as any), a: t('landing.compare.r4.a' as any) },
    { b: t('landing.compare.r5.b' as any), a: t('landing.compare.r5.a' as any) },
  ]

  const testimonials = [
    { text: t('landing.social.t1.text' as any), name: t('landing.social.t1.name' as any), role: t('landing.social.t1.role' as any) },
    { text: t('landing.social.t2.text' as any), name: t('landing.social.t2.name' as any), role: t('landing.social.t2.role' as any) },
    { text: t('landing.social.t3.text' as any), name: t('landing.social.t3.name' as any), role: t('landing.social.t3.role' as any) },
  ]

  const faqItems = [
    { q: t('landing.faq.q1' as any), a: t('landing.faq.a1' as any) },
    { q: t('landing.faq.q2' as any), a: t('landing.faq.a2' as any) },
    { q: t('landing.faq.q3' as any), a: t('landing.faq.a3' as any) },
    { q: t('landing.faq.q4' as any), a: t('landing.faq.a4' as any) },
    { q: t('landing.faq.q5' as any), a: t('landing.faq.a5' as any) },
    { q: t('landing.faq.q6' as any), a: t('landing.faq.a6' as any) },
  ]

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">Sirius Track</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            {user ? (
              <Link to="/app" className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                {t('landing.nav.goToSystem')} <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors hidden sm:block">
                  {t('landing.nav.login')}
                </Link>
                <Link to="/register" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                  {t('landing.nav.startFree')}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-0 px-6 bg-gradient-to-b from-blue-50/60 to-white overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-sm font-semibold mb-8">
            <Zap className="w-3.5 h-3.5" />
            {t('landing.notcrm')}
          </div>
          <h1 className="text-6xl sm:text-7xl font-extrabold text-gray-900 leading-[1.05] mb-3">
            {t('landing.hero.title')}
          </h1>
          <h2 className="text-6xl sm:text-7xl font-extrabold text-blue-600 leading-[1.05] mb-8">
            {t('landing.hero.subtitle')}
          </h2>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('landing.hero.desc')}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-5">
            <Link to="/register" className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5">
              {t('landing.cta.btn' as any)} <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-8 py-4 rounded-xl text-base font-semibold hover:bg-gray-50 transition-colors">
              {t('landing.hero.login')}
            </Link>
          </div>
          <p className="text-sm text-gray-400 mb-16">{t('landing.hero.regNote')}</p>
          <div className="relative mx-auto max-w-5xl">
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-blue-200/50 blur-3xl rounded-full" />
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-3xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { value: '50+',    labelKey: 'landing.stats.companies' },
            { value: '1 день', labelKey: 'landing.stats.launch' },
            { value: '+35%',   labelKey: 'landing.stats.conversion' },
          ].map(s => (
            <div key={s.labelKey}>
              <div className="text-4xl font-extrabold text-blue-600 mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{t(s.labelKey as any)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pain - сценарии */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('landing.pain.title')}</h2>
            <p className="text-gray-500 leading-relaxed">{t('landing.pain.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {painScenarios.map((p, i) => (
              <div key={i} className={`bg-white border ${p.border} rounded-2xl p-6 flex gap-4 shadow-sm`}>
                <div className={`w-10 h-10 ${p.bg} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <p.icon className={`w-5 h-5 ${p.ic}`} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">{p.scene}</div>
                  <div className="text-sm text-gray-400">{p.result}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-center gap-5">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 mb-1">{t('landing.pain.callout' as any)}</div>
              <div className="text-sm text-gray-500">{t('landing.pain.callout.sub' as any)}</div>
            </div>
            <Link to="/register" className="ml-auto flex-shrink-0 flex items-center gap-1.5 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap">
              {t('landing.hero.startFree')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-xl mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('landing.compare.title' as any)}</h2>
          </div>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="grid grid-cols-2 bg-gray-900">
              <div className="px-6 py-4 flex items-center gap-2">
                <X className="w-4 h-4 text-red-400" />
                <span className="font-semibold text-gray-300 text-sm">{t('landing.compare.before' as any)}</span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2 bg-blue-600">
                <Check className="w-4 h-4 text-white" />
                <span className="font-semibold text-white text-sm">{t('landing.compare.after' as any)}</span>
              </div>
            </div>
            {compareRows.map((row, i) => (
              <div key={i} className={`grid grid-cols-2 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <div className="px-6 py-4 flex items-start gap-3 border-r border-gray-100">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-500">{row.b}</span>
                </div>
                <div className="px-6 py-4 flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-gray-800">{row.a}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-xl mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('landing.how.title')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {[
              { num: '01', titleKey: 'landing.how.s1.title', descKey: 'landing.how.s1.desc', color: 'bg-blue-600' },
              { num: '02', titleKey: 'landing.how.s2.title', descKey: 'landing.how.s2.desc', color: 'bg-blue-500' },
              { num: '03', titleKey: 'landing.how.s3.title', descKey: 'landing.how.s3.desc', color: 'bg-blue-400' },
            ].map(step => (
              <div key={step.titleKey}>
                <div className={`w-12 h-12 rounded-2xl ${step.color} flex items-center justify-center mb-5 shadow-md`}>
                  <span className="text-white font-extrabold">{step.num}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{t(step.titleKey as any)}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{t(step.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles + mockups */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('landing.roles.title')}</h2>
            <p className="text-gray-500">{t('landing.roles.sub' as any)}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            <div className="lg:col-span-2 space-y-3">
              {[
                { roleKey: 'role.OWNER', color: 'bg-purple-100 text-purple-700', descKey: 'landing.roles.owner.desc' },
                { roleKey: 'role.ROP',   color: 'bg-blue-100 text-blue-700',     descKey: 'landing.roles.rop.desc' },
                { roleKey: 'role.closer',color: 'bg-green-100 text-green-700',   descKey: 'landing.roles.closer.desc' },
                { roleKey: 'role.lider', color: 'bg-orange-100 text-orange-700', descKey: 'landing.roles.lider.desc' },
              ].map(r => (
                <div key={r.roleKey} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ${r.color}`}>
                    {t(r.roleKey as any)}
                  </span>
                  <p className="text-sm text-gray-500 leading-relaxed">{t(r.descKey as any)}</p>
                </div>
              ))}
            </div>
            <div className="lg:col-span-3 space-y-4">
              <ROPMockup />
              <ManagerMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('landing.features.title')}</h2>
            <p className="text-gray-500">{t('landing.features.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map(f => (
              <div key={f.titleKey} className="group bg-white border border-gray-100 rounded-2xl p-7 shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
                <div className="w-11 h-11 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center mb-5 transition-colors">
                  <f.icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{t(f.titleKey as any)}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{t(f.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('landing.social.title' as any)}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-7 shadow-sm flex flex-col">
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, s) => (
                    <svg key={s} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-6">"{item.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-xl mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('landing.pricing.title')}</h2>
            <p className="text-gray-500">{t('landing.pricing.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {plans.map(p => (
              <div key={p.nameKey} className={`rounded-2xl p-7 relative border-2 ${p.highlight ? 'border-blue-500 bg-blue-600 text-white shadow-xl shadow-blue-200' : 'border-gray-100 bg-white shadow-sm'}`}>
                {p.badgeKey && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                    {t(p.badgeKey as any)}
                  </div>
                )}
                <div className="mb-6">
                  <div className={`text-sm font-semibold mb-1 ${p.highlight ? 'text-blue-100' : 'text-gray-400'}`}>{t(p.nameKey as any)}</div>
                  <div className={`text-3xl font-extrabold ${p.highlight ? 'text-white' : 'text-gray-900'}`}>{p.price}</div>
                  <div className={`text-sm ${p.highlight ? 'text-blue-100' : 'text-gray-400'}`}>{t(p.periodKey as any)}</div>
                </div>
                <ul className="space-y-3 mb-7">
                  {p.featKeys.map(fk => (
                    <li key={fk} className={`flex items-start gap-2.5 text-sm ${p.highlight ? 'text-blue-50' : 'text-gray-600'}`}>
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${p.highlight ? 'text-blue-200' : 'text-emerald-500'}`} />
                      {t(fk as any)}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                    p.highlight ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {p.nameKey === 'landing.pricing.trial.name' ? t('landing.pricing.startFree') : t('landing.pricing.choose')}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-6">{t('landing.pricing.note' as any)}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('landing.faq.title' as any)}</h2>
          </div>
          <FAQ items={faqItems} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">{t('landing.cta.title' as any)}</h2>
          <p className="text-blue-100 mb-10 leading-relaxed text-lg">{t('landing.cta.desc' as any)}</p>
          <div className="flex items-center justify-center gap-3 mb-10 flex-wrap">
            {[
              t('landing.cta.step1' as any),
              t('landing.cta.step2' as any),
              t('landing.cta.step3' as any),
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
                  <span className="w-6 h-6 bg-white text-blue-600 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-white text-sm font-medium">{step}</span>
                </div>
                {i < 2 && <ChevronRight className="w-4 h-4 text-blue-300 flex-shrink-0 hidden sm:block" />}
              </div>
            ))}
          </div>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-10 py-4 rounded-xl hover:bg-blue-50 transition-all shadow-xl hover:-translate-y-0.5 text-base">
            {t('landing.cta.btn' as any)} <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-sm text-blue-200/70 mt-5">{t('landing.hero.regNote')}</p>
        </div>
      </section>

      {/* SEO Text Block */}
      <section className="py-16 px-6 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Держите руку на пульсе вашего отдела продаж
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-gray-500 text-sm leading-relaxed">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Что такое «Рука на пульсе» в продажах?</h3>
              <p>
                «Рука на пульсе» — это когда руководитель отдела продаж (РОП) и собственник бизнеса видят
                все ключевые показатели в реальном времени: количество лидов, воронку, план vs факт,
                рейтинг менеджеров. Sirius Track создан именно для этого — не CRM, а живая аналитика.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Управление отделом продаж в Казахстане</h3>
              <p>
                Платформа для управления отделом продаж малого и среднего бизнеса в Казахстане.
                Контроль менеджеров, лидорубов и клоузеров. Аналитика каналов привлечения,
                стоимость лида, конверсия — всё в одном дашборде.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Замена таблицам Excel для отдела продаж</h3>
              <p>
                Многие компании ведут учёт продаж в Excel или Google Sheets. Sirius Track —
                это современная замена: автоматические отчёты, дашборды вместо таблиц,
                мгновенный доступ с любого устройства.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">CRM или платформа аналитики продаж?</h3>
              <p>
                Sirius Track — не CRM. Это инструмент для руководителя: держать руку на пульсе
                без погружения в карточки клиентов. Если нужен контроль показателей отдела продаж —
                это решение для вас.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <BarChart className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-700">Sirius Track</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400 flex-wrap">
            <Link to="/login"    className="hover:text-gray-700 transition-colors">{t('landing.footer.login')}</Link>
            <Link to="/register" className="hover:text-gray-700 transition-colors">{t('landing.footer.register')}</Link>
            <Link to="/oferta"   className="hover:text-gray-700 transition-colors">{t('landing.footer.oferta')}</Link>
            <Link to="/privacy"  className="hover:text-gray-700 transition-colors">{t('landing.footer.privacy')}</Link>
          </div>
          <div className="text-sm text-gray-400">© {new Date().getFullYear()} Sirius Track. {t('landing.footer.rights')}</div>
        </div>
      </footer>
    </div>
  )
}
