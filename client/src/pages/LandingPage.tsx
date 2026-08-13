import { Link } from 'react-router-dom'
import {
  BarChart2, TrendingUp, Users, Target, CheckCircle, ArrowRight,
  Zap, Shield, BarChart, Clock, Eye, XCircle,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { useT } from '../i18n'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

// ── Owner Dashboard mockup (light) ─────────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-2xl shadow-blue-100 border border-gray-200 bg-white select-none">
      {/* Title bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <span className="flex-1 text-center text-xs text-gray-400 mx-4">SalesPlatform — Дашборд собственника</span>
      </div>
      <div className="flex">
        {/* Sidebar */}
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
        {/* Main */}
        <div className="flex-1 p-4 space-y-3 min-w-0 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">Дашборд собственника</div>
              <div className="text-xs text-gray-400">Август 2026</div>
            </div>
            <div className="flex gap-2 pointer-events-none">
              {['Сегодня','Неделя','Месяц'].map((l, i) => (
                <span key={l} className={`text-xs px-2.5 py-1 rounded-lg ${i === 2 ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>{l}</span>
              ))}
            </div>
          </div>
          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Факт продаж', value: '₸18.4 млн', sub: '73% от плана', vc: 'text-emerald-600' },
              { label: 'Конверсия',   value: '34%',        sub: '+4% к прошлому', vc: 'text-blue-600' },
              { label: 'Ср. чек',     value: '₸460К',      sub: '40 сделок', vc: 'text-purple-600' },
              { label: 'Стоим. лида', value: '₸12 800',    sub: '144 лида', vc: 'text-amber-600' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                <div className="text-[10px] text-gray-400 mb-1">{c.label}</div>
                <div className={`text-sm font-bold ${c.vc}`}>{c.value}</div>
                <div className="text-[10px] text-gray-400">{c.sub}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {/* Funnel */}
            <div className="col-span-2 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
              <div className="text-[10px] text-gray-500 font-medium mb-2">Воронка продаж</div>
              {[
                { label: 'Лиды', val: 144, pct: 100, color: 'bg-purple-500' },
                { label: 'Квалиф.', val: 98, pct: 68, color: 'bg-blue-500' },
                { label: 'Встречи', val: 61, pct: 42, color: 'bg-blue-400' },
                { label: 'Продажи', val: 40, pct: 28, color: 'bg-emerald-500' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-2 mb-1.5">
                  <div className="text-[9px] text-gray-400 w-11 text-right shrink-0">{f.label}</div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${f.color} rounded-full`} style={{ width: `${f.pct}%` }} />
                  </div>
                  <div className="text-[9px] text-gray-500 w-5 shrink-0">{f.val}</div>
                </div>
              ))}
            </div>
            {/* Bar chart */}
            <div className="col-span-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-gray-500 font-medium">Продажи по дням, ₸млн</div>
                <div className="text-[9px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full">↑ +18%</div>
              </div>
              <div className="flex items-end gap-0.5 h-14 px-0.5">
                {[
                  {h:42,v:'2.1'},{h:58,v:'2.9'},{h:35,v:'1.7'},{h:72,v:'3.6'},
                  {h:51,v:'2.5'},{h:65,v:'3.2'},{h:38,v:'1.9'},{h:80,v:'4.0'},
                  {h:60,v:'3.0'},{h:74,v:'3.7'},{h:45,v:'2.2'},{h:62,v:'3.1'},
                  {h:85,v:'4.2'},{h:55,v:'2.7'},
                ].map(({h,v}, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group">
                    <div
                      className={`w-full rounded-t-sm transition-all ${i===12?'bg-blue-600':'bg-blue-400/70 group-hover:bg-blue-500'}`}
                      style={{ height:`${h}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-gray-300">1 авг</span>
                <span className="text-[8px] text-gray-300">14 авг</span>
              </div>
            </div>
          </div>
          {/* Manager table — rich version */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <div className="text-[10px] font-semibold text-gray-600">Рейтинг клоузеров</div>
              <div className="text-[9px] text-blue-600 font-medium">Август 2026</div>
            </div>
            {[
              { rank:1, name:'Айгерим К.', dept:'Отдел А', sales:'₸5.2М', plan:'₸5.0М', pct:104, conv:'42%', deals:21, trend:'+12%', pctBar:100, tc:'text-emerald-600', bg:'bg-emerald-500', rankBg:'bg-emerald-100 text-emerald-700' },
              { rank:2, name:'Данияр М.',  dept:'Отдел А', sales:'₸4.8М', plan:'₸5.0М', pct:96,  conv:'38%', deals:18, trend:'+5%',  pctBar:92,  tc:'text-blue-600',   bg:'bg-blue-500',   rankBg:'bg-blue-100 text-blue-700' },
              { rank:3, name:'Асель Н.',   dept:'Отдел Б', sales:'₸3.9М', plan:'₸5.0М', pct:78,  conv:'31%', deals:14, trend:'-3%',  pctBar:75,  tc:'text-amber-600',  bg:'bg-amber-500',  rankBg:'bg-amber-100 text-amber-700' },
            ].map((m) => (
              <div key={m.rank} className="px-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-lg text-[9px] font-bold flex items-center justify-center flex-none ${m.rankBg}`}>{m.rank}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-gray-800">{m.name}</span>
                      <span className="text-[8px] text-gray-400">{m.dept}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${m.bg} rounded-full`} style={{ width:`${m.pctBar}%` }} />
                      </div>
                      <span className={`text-[9px] font-bold ${m.tc}`}>{m.pct}%</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold text-gray-800">{m.sales}</div>
                    <div className="text-[8px] text-gray-400">{m.deals} сделок</div>
                  </div>
                  <div className="text-right shrink-0 w-10">
                    <div className="text-[9px] text-gray-500">{m.conv}</div>
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
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-lg select-none">
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="text-[10px] text-gray-400 ml-2">Кабинет РОПа</span>
      </div>
      <div className="p-3 space-y-2 bg-gray-50/50">
        <div className="text-[11px] font-semibold text-gray-700 mb-1">Воронка отдела</div>
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
              style={{ width: `${(f.v/arr[0].v)*100}%`, minWidth: '60%' }}
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
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-lg select-none">
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="text-[10px] text-gray-400 ml-2">Мой кабинет — Данияр</span>
      </div>
      <div className="p-3 space-y-2 bg-gray-50/50">
        <div className="text-[11px] font-semibold text-gray-700">Мои показатели</div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { l:'Продажи', v:'₸4.8М', c:'text-emerald-600' },
            { l:'Выполн.', v:'96%', c:'text-blue-600' },
            { l:'Сделок', v:'18', c:'text-purple-600' },
            { l:'Конверсия', v:'38%', c:'text-amber-600' },
          ].map(m => (
            <div key={m.l} className="bg-white rounded-xl p-2 border border-gray-100 shadow-sm">
              <div className="text-[9px] text-gray-400">{m.l}</div>
              <div className={`text-sm font-bold ${m.c}`}>{m.v}</div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl p-2 border border-gray-100 shadow-sm">
          <div className="flex justify-between text-[9px] text-gray-400 mb-1.5">
            <span>План: ₸5 000 000</span><span>96%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width:'96%' }} />
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

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
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

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
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
            <Link to="/register" className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
              {t('landing.hero.startFree')} <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-8 py-4 rounded-xl text-base font-semibold hover:bg-gray-50 transition-colors">
              {t('landing.hero.login')}
            </Link>
          </div>
          <p className="text-sm text-gray-400 mb-16">{t('landing.hero.regNote')}</p>

          {/* Dashboard mockup */}
          <div className="relative mx-auto max-w-5xl">
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-blue-200/50 blur-3xl rounded-full" />
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="py-14 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-3xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { value: '50+',     labelKey: 'landing.stats.companies' },
            { value: '10 000+', labelKey: 'landing.stats.reports' },
            { value: '+35%',    labelKey: 'landing.stats.conversion' },
          ].map(s => (
            <div key={s.labelKey}>
              <div className="text-4xl font-extrabold text-blue-600 mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{t(s.labelKey as any)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pain points ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('landing.pain.title')}</h2>
            <p className="text-gray-500 leading-relaxed">{t('landing.pain.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: Clock,   bg: 'bg-red-50',    ic: 'text-red-500',    border: 'border-red-100',    titleKey: 'landing.pain.p1.title', descKey: 'landing.pain.p1.desc' },
              { icon: XCircle, bg: 'bg-amber-50',  ic: 'text-amber-500',  border: 'border-amber-100',  titleKey: 'landing.pain.p2.title', descKey: 'landing.pain.p2.desc' },
              { icon: Eye,     bg: 'bg-purple-50', ic: 'text-purple-500', border: 'border-purple-100', titleKey: 'landing.pain.p3.title', descKey: 'landing.pain.p3.desc' },
            ].map(p => (
              <div key={p.titleKey} className={`bg-white border ${p.border} rounded-2xl p-7 shadow-sm`}>
                <div className={`w-11 h-11 ${p.bg} rounded-xl flex items-center justify-center mb-5`}>
                  <p.icon className={`w-5 h-5 ${p.ic}`} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{t(p.titleKey as any)}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{t(p.descKey as any)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles + mockups ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('landing.roles.title')}</h2>
            <p className="text-gray-500">Каждая роль видит именно то, что нужно. Не больше, не меньше.</p>
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

      {/* ── How it works ─────────────────────────────────────────────────────── */}
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

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-50">
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

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
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
                    p.highlight
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
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
      <section className="py-24 px-6 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <Shield className="w-12 h-12 text-blue-200 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">{t('landing.trust.title')}</h2>
          <p className="text-blue-100 mb-10 leading-relaxed">{t('landing.trust.desc')}</p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors shadow-lg">
            {t('landing.trust.btn')} <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-sm text-blue-200/60 mt-5">{t('landing.hero.regNote')}</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <BarChart className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-700">SalesPlatform</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400 flex-wrap">
            <Link to="/login"   className="hover:text-gray-700 transition-colors">{t('landing.footer.login')}</Link>
            <Link to="/register"className="hover:text-gray-700 transition-colors">{t('landing.footer.register')}</Link>
            <Link to="/oferta"  className="hover:text-gray-700 transition-colors">{t('landing.footer.oferta')}</Link>
            <Link to="/privacy" className="hover:text-gray-700 transition-colors">{t('landing.footer.privacy')}</Link>
          </div>
          <div className="text-sm text-gray-400">© {new Date().getFullYear()} SalesPlatform. {t('landing.footer.rights')}</div>
        </div>
      </footer>
    </div>
  )
}
