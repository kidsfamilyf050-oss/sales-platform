import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'
import ExcelJS from 'exceljs'

const router = Router()
const prisma = new PrismaClient()

// ── Translation dictionary ─────────────────────────────────────────────────

const LABELS = {
  ru: {
    period: {
      today: 'Сегодня', yesterday: 'Вчера',
      week: 'Последние 7 дней', month: 'Текущий месяц',
    },
    months: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    total: 'ИТОГО',
    days: 'дней',
    deals: 'сделок',
    // Sheet names
    sheet: {
      summary:      'Сводка',
      daily:        'Отчёты по дням',
      sales:        'Продажи',
      allSales:     'Все продажи',
      closers:      'Клоузеры',
      liders:       'Лидорубы',
      monthly:      'По месяцам',
      channels:     'По каналам',
      leads:        'Все лиды',
      dailyReports: 'Ежедневные отчёты',
      data:         'Данные по дням',
    },
    // Column headers
    col: {
      date:        'Дата',
      leads:       'Лидов',
      qual:        'Квалиф.',
      scheduled:   'Записано на встречу',
      attended:    'Пришло на встречу',
      comment:     'Комментарий',
      clients:     'Клиентов',
      consults:    'Консультаций',
      refusals:    'Отказов',
      amount:      'Сумма',
      amountRub:   'Сумма (₸)',
      type:        'Тип',
      method:      'Способ оплаты',
      bank:        'Банк',
      months:      'Месяцев',
      manager:     'Менеджер',
      plan:        'План (₸)',
      completion:  'Выполнение %',
      conversion:  'Конверсия %',
      avgCheck:    'Средний чек (₸)',
      inWork:      'В работе',
      lider:       'Лидоруб',
      attendedFact:'Пришло (факт)',
      meetingPlan: 'План встреч',
      qualPct:     '% квал.',
      receivedAt:  'Дата поступления',
      clientName:  'Клиент',
      phone:       'Телефон',
      link:        'Ссылка',
      channel:     'Рекламный канал',
      kts:         'Квал / Не квал',
      sub:         'Записан / Отказ',
      apptDate:    'Дата записи',
      apptTime:    'Время',
      closer:      'Клоузер',
      consultStatus:'Статус встречи',
      postponed:   'Перенос на',
      budget:      'Рекл. бюджет (₸)',
      leadCost:    'Стоим. лида (₸)',
      share:       'Доля от всех',
      happenedPct: '% пришло от записанных',
      planExecCol: 'Вып. плана встреч',
      qualPctCol:  '% квал',
      month:       'Месяц',
    },
    // Section sub-headers
    hdr: {
      closerStats: 'Показатели продаж',
      liderStats:  'Показатели лидоруба',
      salesHdr:    'Продажи',
      clientFlow:  'Клиентский поток',
      liderFunnel: 'Воронка лидорубов',
      leadFunnel:  'Воронка лидов',
      planExec:    'Выполнение планов',
      topChannels: 'Топ каналов по лидам',
      leadsHdr:    'Лиды',
      budgetHdr:   'Бюджет',
    },
    // Summary row labels
    sum: {
      salesAmount:     'Продажи (сумма)',
      dealsCount:      'Кол-во сделок',
      salesPlan:       'План продаж',
      planCompletion:  'Выполнение плана',
      conversion:      'Конверсия (клиенты → сделки)',
      avgCheck:        'Средний чек',
      clientsReceived: 'Клиентов получено',
      consultations:   'Консультаций',
      refusals:        'Отказов',
      inWork:          'В работе',
      meetingsHappened:'Проведено встреч (пришло)',
      meetingsPlan:    'План встреч',
      meetingsScheduled:'Записано на встречу',
      leadsReceived:   'Лидов получено',
      leadsplan:       'План по лидам',
      qualified:       'Квалифицировано',
      qualPct:         '% квалификации',
      salesVolume:     'Объём продаж',
      totalLeads:      'Лидов получено',
      adBudgetFact:    'Рекламный бюджет (факт)',
      budgetPlan:      'Бюджетный план',
      leadCost:        'Стоимость лида',
      qualLeadCost:    'Стоимость квал. лида',
    },
    // Title strings
    title: {
      manager:  (name: string) => `Отчёт — ${name}`,
      rop:      'Отчёт РОПа — Сводные показатели',
      marketer: (name: string) => `Отчёт маркетолога — ${name}`,
      lider:    (name: string) => `📊 Отчёт лидоруба — ${name}`,
    },
    // Role labels
    role: { closer: 'Клоузер', lider: 'Лидоруб' },
    // Payment
    payType:   { new_sale: 'Новая продажа', additional: 'Доплата' },
    payMethod: { cash: 'Наличные', card: 'Безналичный', credit: 'Кредит', installment: 'Рассрочка' },
    // Lead status
    status: {
      scheduled: 'Записан', refused: 'Отказ', thinking: 'Думает',
      in_work_kc: 'В работе КЦ', happened: 'Состоялась',
      not_happened: 'Не состоялась', postponed: 'Перенос',
    },
    kts: { qual: 'Квал', qualCloser: 'Квал (клоузер)', unqual: 'Не квал', inWork: 'В работе КЦ' },
    // Misc
    misc: {
      period:       'Период',
      role:         'Роль',
      filters:      'Применены фильтры',
      plan:         'план',
      fact:         'факт',
      fromScheduled:'% от записанных',
      fromQual:     '% от квал',
      fromLeads:    '% от лидов',
      noChannel:    '— без канала —',
      leadsTotal:   (n: number) => `Итого: ${n} лидов`,
      qualTotal:    (n: number) => `Квал: ${n}`,
      scheduledTotal:(n: number) => `Записано: ${n}`,
      happenedTotal: (n: number) => `Пришло: ${n}`,
      meetPlanLbl:  'Выполнение плана по встречам',
      leadPlanLbl:  'Выполнение плана по лидам',
      factMeetings: '  Факт встреч',
      planMeetings: '  План встреч',
      factLeads:    '  Факт лидов',
      planLeads:    '  План по лидам',
      dealsTotal:   (n: number) => `${n} сделок`,
    },
  },
  kk: {
    period: {
      today: 'Бүгін', yesterday: 'Кеше',
      week: 'Соңғы 7 күн', month: 'Ағымдағы ай',
    },
    months: ['Қаңтар','Ақпан','Наурыз','Сәуір','Мамыр','Маусым','Шілде','Тамыз','Қыркүйек','Қазан','Қараша','Желтоқсан'],
    total: 'БАРЛЫҒЫ',
    days: 'күн',
    deals: 'мәміле',
    sheet: {
      summary:      'Қорытынды',
      daily:        'Күнделікті есептер',
      sales:        'Сатылымдар',
      allSales:     'Барлық сатылымдар',
      closers:      'Клоузерлер',
      liders:       'Лидорубтар',
      monthly:      'Айлар бойынша',
      channels:     'Каналдар бойынша',
      leads:        'Барлық лидтер',
      dailyReports: 'Күнделікті есептер',
      data:         'Күнделікті деректер',
    },
    col: {
      date:        'Күн',
      leads:       'Лидтер',
      qual:        'Саралды.',
      scheduled:   'Жазылды (кездесу)',
      attended:    'Кездесуге келді',
      comment:     'Пікір',
      clients:     'Клиенттер',
      consults:    'Кеңестер',
      refusals:    'Бас тарту',
      amount:      'Сома',
      amountRub:   'Сома (₸)',
      type:        'Түрі',
      method:      'Төлем тәсілі',
      bank:        'Банк',
      months:      'Айлар',
      manager:     'Менеджер',
      plan:        'Жоспар (₸)',
      completion:  'Орындалуы %',
      conversion:  'Конверсия %',
      avgCheck:    'Орт. чек (₸)',
      inWork:      'Жұмыста',
      lider:       'Лидоруб',
      attendedFact:'Келді (нақты)',
      meetingPlan: 'Кездесу жоспары',
      qualPct:     '% сарал.',
      receivedAt:  'Келіп түскен күн',
      clientName:  'Клиент',
      phone:       'Телефон',
      link:        'Сілтеме',
      channel:     'Жарнама каналы',
      kts:         'Сарал / Сараланбаған',
      sub:         'Жазылды / Бас тарту',
      apptDate:    'Жазылу күні',
      apptTime:    'Уақыты',
      closer:      'Клоузер',
      consultStatus:'Кездесу мәртебесі',
      postponed:   'Ауыстырылды',
      budget:      'Жарн. бюджет (₸)',
      leadCost:    'Лид бағасы (₸)',
      share:       'Үлесі',
      happenedPct: '% жазылғандардан',
      planExecCol: 'Жоспар орынд.',
      qualPctCol:  '% сарал',
      month:       'Ай',
    },
    hdr: {
      closerStats: 'Сату көрсеткіштері',
      liderStats:  'Лидоруб көрсеткіштері',
      salesHdr:    'Сатылымдар',
      clientFlow:  'Клиент ағыны',
      liderFunnel: 'Лидорубтар воронкасы',
      leadFunnel:  'Лидтер воронкасы',
      planExec:    'Жоспарды орындау',
      topChannels: 'Лидтер бойынша үздік каналдар',
      leadsHdr:    'Лидтер',
      budgetHdr:   'Бюджет',
    },
    sum: {
      salesAmount:     'Сатылым (сома)',
      dealsCount:      'Мәмілелер саны',
      salesPlan:       'Сату жоспары',
      planCompletion:  'Жоспарды орындау',
      conversion:      'Конверсия (клиенттер → мәмілелер)',
      avgCheck:        'Орташа чек',
      clientsReceived: 'Клиенттер алынды',
      consultations:   'Кеңестер',
      refusals:        'Бас тартулар',
      inWork:          'Жұмыста',
      meetingsHappened:'Өткен кездесулер (келді)',
      meetingsPlan:    'Кездесу жоспары',
      meetingsScheduled:'Кездесуге жазылды',
      leadsReceived:   'Лидтер алынды',
      leadsplan:       'Лидтер жоспары',
      qualified:       'Сараланды',
      qualPct:         '% сараланды',
      salesVolume:     'Сату көлемі',
      totalLeads:      'Лидтер алынды',
      adBudgetFact:    'Жарнама бюджеті (нақты)',
      budgetPlan:      'Бюджет жоспары',
      leadCost:        'Лид бағасы',
      qualLeadCost:    'Сараланған лид бағасы',
    },
    title: {
      manager:  (name: string) => `Есеп — ${name}`,
      rop:      'РОП есебі — Жалпы көрсеткіштер',
      marketer: (name: string) => `Маркетолог есебі — ${name}`,
      lider:    (name: string) => `📊 Лидоруб есебі — ${name}`,
    },
    role: { closer: 'Клоузер', lider: 'Лидоруб' },
    payType:   { new_sale: 'Жаңа сатылым', additional: 'Қосымша' },
    payMethod: { cash: 'Қолма-қол', card: 'Қолма-қолсыз', credit: 'Кредит', installment: 'Бөліп төлеу' },
    status: {
      scheduled: 'Жазылды', refused: 'Бас тарту', thinking: 'Ойлануда',
      in_work_kc: 'КЦ жұмысында', happened: 'Өтті',
      not_happened: 'Өтпеді', postponed: 'Ауыстыру',
    },
    kts: { qual: 'Сараланды', qualCloser: 'Сараланды (клоузер)', unqual: 'Сараланбады', inWork: 'КЦ жұмысында' },
    misc: {
      period:       'Кезең',
      role:         'Рөлі',
      filters:      'Сүзгілер қолданылды',
      plan:         'жоспар',
      fact:         'нақты',
      fromScheduled:'% жазылғандардан',
      fromQual:     '% сараланғандардан',
      fromLeads:    '% лидтерден',
      noChannel:    '— канал жоқ —',
      leadsTotal:   (n: number) => `Барлығы: ${n} лид`,
      qualTotal:    (n: number) => `Сарал: ${n}`,
      scheduledTotal:(n: number) => `Жазылды: ${n}`,
      happenedTotal: (n: number) => `Келді: ${n}`,
      meetPlanLbl:  'Кездесулер жоспарын орындау',
      leadPlanLbl:  'Лидтер жоспарын орындау',
      factMeetings: '  Нақты кездесулер',
      planMeetings: '  Жоспар бойынша кездесу',
      factLeads:    '  Нақты лидтер',
      planLeads:    '  Лидтер жоспары',
      dealsTotal:   (n: number) => `${n} мәміле`,
    },
  },
} as const

type LabelSet = typeof LABELS.ru
function getL(lang?: string): LabelSet {
  return lang === 'kk' ? (LABELS.kk as unknown as LabelSet) : LABELS.ru
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPeriodDates(period: string, from?: string, to?: string) {
  if (from && to) {
    const s = new Date(from); s.setHours(0, 0, 0, 0)
    const e = new Date(to); e.setHours(23, 59, 59, 999)
    return { start: s, end: e }
  }
  const now = new Date()
  if (period === 'today') {
    const s = new Date(now); s.setHours(0, 0, 0, 0)
    const e = new Date(now); e.setHours(23, 59, 59, 999)
    return { start: s, end: e }
  }
  if (period === 'yesterday') {
    const s = new Date(now); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0)
    const e = new Date(s); e.setHours(23, 59, 59, 999)
    return { start: s, end: e }
  }
  if (period === 'week') {
    const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0)
    const e = new Date(now); e.setHours(23, 59, 59, 999)
    return { start: s, end: e }
  }
  // month (default)
  const s = new Date(now.getFullYear(), now.getMonth(), 1)
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start: s, end: e }
}

function dateToStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sumField(arr: any[], field: string) {
  return arr.reduce((acc, r) => acc + (Number((r.data as any)[field]) || 0), 0)
}

function sumLiderLeads(reports: any[]) {
  return reports.reduce((acc, r) => {
    const d = r.data as any
    return acc + (Number(d.leadsReceived) || Number(d.leads) || 0)
  }, 0)
}

function pctOneDecimal(a: number, b: number) {
  if (b === 0) return 0
  return Math.round((a / b) * 1000) / 10
}

function getMonthKeys(start: Date, end: Date): string[] {
  const keys: string[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cur <= last) {
    keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return keys
}

function totalPlan(plans: any[], type: string, userId?: string | null, deptId?: string | null): number {
  return plans
    .filter(p => {
      if (p.type !== type) return false
      if (userId !== undefined && p.userId !== userId) return false
      if (deptId !== undefined && p.departmentId !== deptId) return false
      return true
    })
    .reduce((s, p) => s + (Number(p.value) || 0), 0)
}

function planForMonth(plans: any[], monthKey: string, type: string, userId?: string | null, deptId?: string | null): number {
  const found = plans.find(p =>
    p.period === monthKey && p.type === type &&
    (userId === undefined || p.userId === userId) &&
    (deptId === undefined || p.departmentId === deptId)
  )
  return found ? Number(found.value) : 0
}

function fmtDate(d: string | Date) {
  const date = typeof d === 'string' ? new Date(d + 'T12:00:00') : d
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtMoney(n: number) {
  return `₸ ${n.toLocaleString('ru-RU')}`
}

function periodLabel(period: string, L: LabelSet, from?: string, to?: string) {
  if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`
  return (L.period as any)[period] || period
}

// ── Excel style constants ──────────────────────────────────────────────────

const C_BLUE_DARK   = 'FF1E40AF'
const C_BLUE_MID    = 'FF2563EB'
const C_BLUE_LIGHT  = 'FFDBEAFE'
const C_WHITE       = 'FFFFFFFF'
const C_GRAY_HDR    = 'FFF1F5F9'
const C_GREEN_LIGHT = 'FFD1FAE5'
const C_RED_LIGHT   = 'FFFEE2E2'
const C_AMBER_LIGHT = 'FFFEF3C7'
const C_GREEN_TEXT  = 'FF15803D'
const C_RED_TEXT    = 'FFB91C1C'
const C_AMBER_TEXT  = 'FFB45309'

type WS = ExcelJS.Worksheet

function styleHeaderRow(ws: WS, rowNum: number, cols: number) {
  const row = ws.getRow(rowNum)
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c)
    cell.font = { bold: true, color: { argb: C_WHITE }, size: 10, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_BLUE_DARK } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      bottom: { style: 'medium', color: { argb: C_BLUE_MID } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }
  }
  row.height = 30
}

function styleTitleRow(ws: WS, rowNum: number, cols: number) {
  const row = ws.getRow(rowNum)
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c)
    cell.font = { bold: true, color: { argb: C_BLUE_MID }, size: 14, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_WHITE } }
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
  }
  row.height = 36
}

function styleSubHeader(ws: WS, rowNum: number, cols: number) {
  const row = ws.getRow(rowNum)
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c)
    cell.font = { bold: true, color: { argb: C_BLUE_DARK }, size: 10, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
  }
  row.height = 22
}

function styleDataRow(ws: WS, rowNum: number, cols: number, isAlt: boolean) {
  const row = ws.getRow(rowNum)
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c)
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: isAlt ? C_BLUE_LIGHT : C_WHITE },
    }
    cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFF1F5F9' } },
    }
    cell.alignment = { vertical: 'middle' }
  }
  row.height = 20
}

function addSummaryBlock(ws: WS, startRow: number, items: { label: string; value: string | number }[]) {
  let r = startRow
  for (const item of items) {
    const row = ws.getRow(r)
    const labelCell = row.getCell(1)
    const valCell = row.getCell(2)
    labelCell.value = item.label
    labelCell.font = { bold: false, size: 10, name: 'Calibri', color: { argb: 'FF475569' } }
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' }
    valCell.value = item.value
    valCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: C_BLUE_DARK } }
    valCell.alignment = { horizontal: 'left', vertical: 'middle' }
    row.height = 22
    r++
  }
  return r
}

function completionColor(pct: number) {
  if (pct >= 75) return C_GREEN_LIGHT
  if (pct >= 50) return C_AMBER_LIGHT
  return C_RED_LIGHT
}

function completionTextColor(pct: number) {
  if (pct >= 75) return C_GREEN_TEXT
  if (pct >= 50) return C_AMBER_TEXT
  return C_RED_TEXT
}

// ── MANAGER export (Lider or Closer) ──────────────────────────────────────

router.get('/manager', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to, lang } = req.query
  const L = getL(lang as string)
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const monthKeys = getMonthKeys(start, end)
  const ytdStart = new Date(start.getFullYear(), 0, 1)
  const ytdFromStr = dateToStr(ytdStart)
  const ytdMonthKeys = getMonthKeys(ytdStart, end)
  const userId = req.user!.id
  const fromStr = dateToStr(start)
  const toStr = dateToStr(end)
  const pLabel = periodLabel(period as string, L, from as string, to as string)

  try {
    const [user, reports, plans, periodSales] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, managerType: true } }),
      prisma.report.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: { in: ytdMonthKeys }, userId } }),
      prisma.sale.findMany({ where: { userId, date: { gte: fromStr, lte: toStr } }, orderBy: { date: 'asc' } }),
    ])
    // selectedPlans = only plans for the chosen period (for summary stats)
    const selectedPlans = plans.filter((p: any) => monthKeys.includes(p.period))
    // YTD data for the monthly breakdown sheet
    let ytdSales = periodSales
    let ytdReports = reports
    if (ytdStart < start) {
      const [prevSales, prevReports] = await Promise.all([
        prisma.sale.findMany({ where: { userId, date: { gte: ytdFromStr, lt: fromStr } }, orderBy: { date: 'asc' } }),
        prisma.report.findMany({ where: { userId, date: { gte: ytdStart, lt: start } }, orderBy: { date: 'asc' } }),
      ])
      ytdSales = [...prevSales, ...periodSales]
      ytdReports = [...prevReports, ...reports]
    }

    const isCloser = req.user!.managerType === 'CLOSER'
    const wb = new ExcelJS.Workbook()
    wb.creator = 'SalesPlatform'
    wb.created = new Date()

    // ── SHEET 1: Summary ────────────────────────────────────────────────────
    const wsSummary = wb.addWorksheet(L.sheet.summary, { properties: { tabColor: { argb: C_BLUE_MID } } })
    wsSummary.columns = [{ key: 'label', width: 30 }, { key: 'value', width: 30 }]

    wsSummary.mergeCells('A1:B1')
    wsSummary.getCell('A1').value = L.title.manager(user?.name || '')
    styleTitleRow(wsSummary, 1, 2)

    wsSummary.mergeCells('A2:B2')
    const subCell = wsSummary.getCell('A2')
    subCell.value = `${L.misc.period}: ${pLabel}  |  ${L.misc.role}: ${isCloser ? L.role.closer : L.role.lider}`
    subCell.font = { size: 10, color: { argb: 'FF64748B' }, name: 'Calibri' }
    subCell.alignment = { horizontal: 'left', vertical: 'middle' }
    wsSummary.getRow(2).height = 20
    wsSummary.addRow([])

    if (isCloser) {
      const salesAmount = periodSales.reduce((s, x) => s + x.amount, 0)
      const salesCount = periodSales.length
      const clientsReceived = sumField(reports, 'clientsReceived')
      const consultations = sumField(reports, 'consultations')
      const refusals = sumField(reports, 'refusals')
      const salesPlan = totalPlan(selectedPlans, 'SALES_AMOUNT', userId)
      const completion = pctOneDecimal(salesAmount, salesPlan)
      const conversion = pctOneDecimal(salesCount, clientsReceived)
      const avgCheck = salesCount > 0 ? Math.round(salesAmount / salesCount) : 0

      const subHdr = wsSummary.addRow([L.hdr.closerStats, ''])
      styleSubHeader(wsSummary, subHdr.number, 2)

      addSummaryBlock(wsSummary, subHdr.number + 1, [
        { label: L.sum.salesAmount,     value: fmtMoney(salesAmount) },
        { label: L.sum.dealsCount,      value: salesCount },
        { label: L.sum.salesPlan,       value: fmtMoney(salesPlan) },
        { label: L.sum.planCompletion,  value: `${completion}%` },
        { label: L.sum.conversion,      value: `${conversion}%` },
        { label: L.sum.avgCheck,        value: fmtMoney(avgCheck) },
        { label: L.sum.clientsReceived, value: clientsReceived },
        { label: L.sum.consultations,   value: consultations },
        { label: L.sum.refusals,        value: refusals },
        { label: L.sum.inWork,          value: Math.max(0, consultations - salesCount - refusals) },
      ])
    } else {
      const leads = sumLiderLeads(reports)
      const qualifiedLeads = sumField(reports, 'qualifiedLeads')
      const meetingsScheduled = sumField(reports, 'meetingsScheduled')
      const meetingsAttended = sumField(reports, 'meetingsAttended')
      const attendedPlan = totalPlan(selectedPlans, 'MEETINGS_ATTENDED', userId)
      const leadsplan = totalPlan(selectedPlans, 'LEADS', userId)
      const completion = pctOneDecimal(meetingsAttended, attendedPlan)

      const subHdr = wsSummary.addRow([L.hdr.liderStats, ''])
      styleSubHeader(wsSummary, subHdr.number, 2)

      addSummaryBlock(wsSummary, subHdr.number + 1, [
        { label: L.sum.meetingsHappened,  value: meetingsAttended },
        { label: L.sum.meetingsPlan,      value: attendedPlan },
        { label: L.sum.planCompletion,    value: `${completion}%` },
        { label: L.sum.meetingsScheduled, value: meetingsScheduled },
        { label: L.sum.leadsReceived,     value: leads },
        { label: L.sum.leadsplan,         value: leadsplan || '—' },
        { label: L.sum.qualified,         value: qualifiedLeads },
        { label: L.sum.qualPct,           value: `${pctOneDecimal(qualifiedLeads, leads)}%` },
      ])
    }

    // ── SHEET 2: Daily reports ───────────────────────────────────────────────
    if (!isCloser) {
      const wsReports = wb.addWorksheet(L.sheet.daily, { properties: { tabColor: { argb: 'FF7C3AED' } } })
      const headers = [L.col.date, L.col.leads, L.col.qual, L.col.scheduled, L.col.attended, L.col.comment]
      wsReports.columns = [
        { key: 'date', width: 14 }, { key: 'leads', width: 12 }, { key: 'qual', width: 12 },
        { key: 'scheduled', width: 20 }, { key: 'attended', width: 20 }, { key: 'comment', width: 35 },
      ]

      wsReports.mergeCells(`A1:${String.fromCharCode(64 + headers.length)}1`)
      wsReports.getCell('A1').value = `${L.sheet.daily} — ${pLabel}`
      styleTitleRow(wsReports, 1, headers.length)
      wsReports.addRow([])

      const hRow = wsReports.addRow(headers)
      styleHeaderRow(wsReports, hRow.number, headers.length)

      reports.forEach((r, i) => {
        const d = r.data as any
        const dataRow = wsReports.addRow([
          fmtDate(r.date),
          Number(d.leadsReceived) || Number(d.leads) || 0,
          Number(d.qualifiedLeads) || 0,
          Number(d.meetingsScheduled) || 0,
          Number(d.meetingsAttended) || 0,
          d.comment || '',
        ])
        styleDataRow(wsReports, dataRow.number, headers.length, i % 2 === 0)
        for (let c = 1; c <= 5; c++) dataRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
        if (Number(d.meetingsAttended) > 0) {
          dataRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN_LIGHT } }
          dataRow.getCell(5).font = { bold: true, color: { argb: C_GREEN_TEXT }, size: 10, name: 'Calibri' }
        }
      })

      const totRow = wsReports.addRow([
        L.total, sumLiderLeads(reports), sumField(reports, 'qualifiedLeads'),
        sumField(reports, 'meetingsScheduled'), sumField(reports, 'meetingsAttended'), '',
      ])
      for (let c = 1; c <= headers.length; c++) {
        totRow.getCell(c).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
        totRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
        totRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
        totRow.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
      }
      totRow.height = 22
    } else {
      // ── SHEET 2: Sales ──────────────────────────────────────────────────────
      const wsSales = wb.addWorksheet(L.sheet.sales, { properties: { tabColor: { argb: 'FF16A34A' } } })
      const saleCols = [L.col.date, L.col.amount, L.col.type, L.col.method, L.col.bank, L.col.months, L.col.comment]
      wsSales.columns = [
        { key: 'date', width: 14 }, { key: 'amount', width: 18 }, { key: 'type', width: 14 },
        { key: 'method', width: 16 }, { key: 'bank', width: 18 }, { key: 'months', width: 10 }, { key: 'comment', width: 35 },
      ]

      wsSales.mergeCells(`A1:${String.fromCharCode(64 + saleCols.length)}1`)
      wsSales.getCell('A1').value = `${L.sheet.sales} — ${pLabel}`
      styleTitleRow(wsSales, 1, saleCols.length)
      wsSales.addRow([])

      const hRow = wsSales.addRow(saleCols)
      styleHeaderRow(wsSales, hRow.number, saleCols.length)

      periodSales.forEach((s, i) => {
        const dataRow = wsSales.addRow([
          fmtDate(s.date), s.amount,
          (L.payType as any)[s.paymentType] || s.paymentType,
          (L.payMethod as any)[s.paymentMethod] || s.paymentMethod,
          s.bank || '', s.months || '', s.comment || '',
        ])
        styleDataRow(wsSales, dataRow.number, saleCols.length, i % 2 === 0)
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        dataRow.getCell(2).numFmt = '#,##0'
        dataRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
        dataRow.getCell(2).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
        if (s.paymentType === 'new_sale') {
          dataRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN_LIGHT } }
          dataRow.getCell(3).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_GREEN_TEXT } }
        } else {
          dataRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_AMBER_LIGHT } }
          dataRow.getCell(3).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_AMBER_TEXT } }
        }
      })

      const total = periodSales.reduce((s, x) => s + x.amount, 0)
      const totRow = wsSales.addRow([L.total, total, '', '', '', '', L.misc.dealsTotal(periodSales.length)])
      for (let c = 1; c <= saleCols.length; c++) {
        totRow.getCell(c).font = { bold: true, size: 11, name: 'Calibri', color: { argb: C_BLUE_DARK } }
        totRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
        totRow.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
        totRow.getCell(c).alignment = { vertical: 'middle' }
      }
      totRow.getCell(2).numFmt = '#,##0'
      totRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
      totRow.height = 24

      // ── SHEET 3: Daily reports (closer) ─────────────────────────────────────
      const wsCloserRep = wb.addWorksheet(L.sheet.daily, { properties: { tabColor: { argb: 'FF7C3AED' } } })
      const closerCols = [L.col.date, L.col.clients, L.col.consults, L.col.refusals, L.col.comment]
      wsCloserRep.columns = [
        { key: 'date', width: 14 }, { key: 'clients', width: 14 },
        { key: 'consults', width: 16 }, { key: 'refusals', width: 14 }, { key: 'comment', width: 35 },
      ]

      wsCloserRep.mergeCells(`A1:${String.fromCharCode(64 + closerCols.length)}1`)
      wsCloserRep.getCell('A1').value = `${L.sheet.daily} — ${pLabel}`
      styleTitleRow(wsCloserRep, 1, closerCols.length)
      wsCloserRep.addRow([])

      const hRowC = wsCloserRep.addRow(closerCols)
      styleHeaderRow(wsCloserRep, hRowC.number, closerCols.length)

      reports.forEach((r, i) => {
        const d = r.data as any
        const dataRow = wsCloserRep.addRow([
          fmtDate(r.date), Number(d.clientsReceived) || 0,
          Number(d.consultations) || 0, Number(d.refusals) || 0, d.comment || '',
        ])
        styleDataRow(wsCloserRep, dataRow.number, closerCols.length, i % 2 === 0)
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        for (let c = 2; c <= 4; c++) dataRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      })
    }

    // ── Monthly breakdown sheet (YTD — always shown when >1 month in year) ──
    if (ytdMonthKeys.length > 1 && isCloser) {
      const wsM = wb.addWorksheet(L.sheet.monthly, { properties: { tabColor: { argb: 'FF0F766E' } } })
      const moCols = [L.col.month, `${L.hdr.salesHdr} (₸)`, L.sum.dealsCount, L.col.plan, L.col.completion, L.col.clients, L.col.consults, L.col.refusals]
      wsM.columns = [
        { key: 'mo', width: 18 }, { key: 'amt', width: 18 }, { key: 'cnt', width: 14 },
        { key: 'pl', width: 16 }, { key: 'pct', width: 14 }, { key: 'cli', width: 12 },
        { key: 'con', width: 14 }, { key: 'ref', width: 12 },
      ]
      wsM.mergeCells(`A1:${String.fromCharCode(64 + moCols.length)}1`)
      wsM.getCell('A1').value = `${L.sheet.monthly} — ${L.months[0]} ${start.getFullYear()} → ${pLabel}`
      styleTitleRow(wsM, 1, moCols.length)
      wsM.addRow([])
      styleHeaderRow(wsM, wsM.addRow(moCols).number, moCols.length)

      const sByMo: Record<string, { amt: number; cnt: number }> = {}
      for (const s of ytdSales) {
        const mk = s.date.substring(0, 7)
        if (!sByMo[mk]) sByMo[mk] = { amt: 0, cnt: 0 }
        sByMo[mk].amt += s.amount; sByMo[mk].cnt++
      }
      const cliByMo: Record<string, number> = {}; const conByMo: Record<string, number> = {}; const refByMo: Record<string, number> = {}
      for (const r of ytdReports) {
        const mk = dateToStr(r.date).substring(0, 7); const d = r.data as any
        cliByMo[mk] = (cliByMo[mk] || 0) + (Number(d.clientsReceived) || 0)
        conByMo[mk] = (conByMo[mk] || 0) + (Number(d.consultations) || 0)
        refByMo[mk] = (refByMo[mk] || 0) + (Number(d.refusals) || 0)
      }
      ytdMonthKeys.forEach((mk, i) => {
        const [y, mo] = mk.split('-')
        const lbl = `${L.months[parseInt(mo, 10) - 1]} ${y}`
        const sa = sByMo[mk] || { amt: 0, cnt: 0 }
        const moPl = planForMonth(plans, mk, 'SALES_AMOUNT', userId)
        const moComp = pctOneDecimal(sa.amt, moPl)
        const row = wsM.addRow([lbl, sa.amt, sa.cnt, moPl || '—', moPl > 0 ? `${moComp}%` : '—', cliByMo[mk] || 0, conByMo[mk] || 0, refByMo[mk] || 0])
        styleDataRow(wsM, row.number, moCols.length, i % 2 === 0)
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
        row.getCell(2).numFmt = '#,##0'; row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
        if (typeof row.getCell(4).value === 'number') { row.getCell(4).numFmt = '#,##0'; row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' } }
        if (moPl > 0) { row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(moComp) } }; row.getCell(5).font = { bold: true, size: 10, name: 'Calibri', color: { argb: completionTextColor(moComp) } } }
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
        for (let c = 6; c <= 8; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      })
    }
    if (ytdMonthKeys.length > 1 && !isCloser) {
      const wsM = wb.addWorksheet(L.sheet.monthly, { properties: { tabColor: { argb: 'FF0F766E' } } })
      const moCols = [L.col.month, L.col.leads, L.col.qual, L.col.scheduled, L.col.attended, L.col.meetingPlan, L.col.completion]
      wsM.columns = [
        { key: 'mo', width: 18 }, { key: 'leads', width: 12 }, { key: 'qual', width: 12 },
        { key: 'sched', width: 20 }, { key: 'att', width: 20 }, { key: 'pl', width: 16 }, { key: 'pct', width: 14 },
      ]
      wsM.mergeCells(`A1:${String.fromCharCode(64 + moCols.length)}1`)
      wsM.getCell('A1').value = `${L.sheet.monthly} — ${L.months[0]} ${start.getFullYear()} → ${pLabel}`
      styleTitleRow(wsM, 1, moCols.length)
      wsM.addRow([])
      styleHeaderRow(wsM, wsM.addRow(moCols).number, moCols.length)

      const rByMo: Record<string, { leads: number; qual: number; sched: number; att: number }> = {}
      for (const r of ytdReports) {
        const mk = dateToStr(r.date).substring(0, 7); const d = r.data as any
        if (!rByMo[mk]) rByMo[mk] = { leads: 0, qual: 0, sched: 0, att: 0 }
        rByMo[mk].leads += Number(d.leadsReceived) || Number(d.leads) || 0
        rByMo[mk].qual += Number(d.qualifiedLeads) || 0
        rByMo[mk].sched += Number(d.meetingsScheduled) || 0
        rByMo[mk].att += Number(d.meetingsAttended) || 0
      }
      ytdMonthKeys.forEach((mk, i) => {
        const [y, mo] = mk.split('-')
        const lbl = `${L.months[parseInt(mo, 10) - 1]} ${y}`
        const st = rByMo[mk] || { leads: 0, qual: 0, sched: 0, att: 0 }
        const moPl = planForMonth(plans, mk, 'MEETINGS_ATTENDED', userId)
        const moComp = pctOneDecimal(st.att, moPl)
        const row = wsM.addRow([lbl, st.leads, st.qual, st.sched, st.att, moPl || '—', moPl > 0 ? `${moComp}%` : '—'])
        styleDataRow(wsM, row.number, moCols.length, i % 2 === 0)
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
        for (let c = 2; c <= 5; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
        if (moPl > 0) { row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(moComp) } }; row.getCell(7).font = { bold: true, size: 10, name: 'Calibri', color: { argb: completionTextColor(moComp) } } }
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }
      })
    }

    // ── Send ─────────────────────────────────────────────────────────────────
    const safeName = (user?.name || 'manager').replace(/[^а-яёА-ЯЁa-zA-Z0-9]/g, '_')
    const filename = `${isCloser ? 'closer' : 'lider'}_${safeName}_${dateToStr(start)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    await wb.xlsx.write(res)
    res.end()
  } catch (e) {
    console.error('Export manager error:', e)
    res.status(500).json({ error: 'Export failed' })
  }
})

// ── ROP export ─────────────────────────────────────────────────────────────

router.get('/rop', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to, lang } = req.query
  const L = getL(lang as string)
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const monthKeys = getMonthKeys(start, end)
  const ytdStart = new Date(start.getFullYear(), 0, 1)
  const ytdFromStr = dateToStr(ytdStart)
  const ytdMonthKeys = getMonthKeys(ytdStart, end)
  const deptId = req.user!.departmentId
  const fromStr = dateToStr(start)
  const toStr = dateToStr(end)
  const pLabel = periodLabel(period as string, L, from as string, to as string)

  try {
    const [managers, plans, closerReports, liderReports, periodSales] = await Promise.all([
      prisma.user.findMany({ where: { companyId: req.user!.companyId, departmentId: deptId || undefined, status: 'ACTIVE', role: 'MANAGER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: { in: ytdMonthKeys } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'CLOSER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'LIDER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true } } } }),
      prisma.sale.findMany({ where: { companyId: req.user!.companyId, date: { gte: fromStr, lte: toStr } }, include: { user: { select: { id: true, name: true, managerType: true } } }, orderBy: { date: 'asc' } }),
    ])
    const selectedPlans = plans.filter((p: any) => monthKeys.includes(p.period))
    let ytdSales = periodSales
    let ytdCloserReports = closerReports
    let ytdLiderReports = liderReports
    if (ytdStart < start) {
      const [prevSales, prevCloser, prevLider] = await Promise.all([
        prisma.sale.findMany({ where: { companyId: req.user!.companyId, date: { gte: ytdFromStr, lt: fromStr } }, include: { user: { select: { id: true, name: true, managerType: true } } }, orderBy: { date: 'asc' } }),
        prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'CLOSER', date: { gte: ytdStart, lt: start } }, include: { user: { select: { id: true, name: true } } } }),
        prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'LIDER', date: { gte: ytdStart, lt: start } }, include: { user: { select: { id: true, name: true } } } }),
      ])
      ytdSales = [...prevSales, ...periodSales]
      ytdCloserReports = [...prevCloser, ...closerReports]
      ytdLiderReports = [...prevLider, ...liderReports]
    }

    const salesByUser: Record<string, { salesCount: number; salesAmount: number }> = {}
    for (const s of periodSales) {
      if (!salesByUser[s.userId]) salesByUser[s.userId] = { salesCount: 0, salesAmount: 0 }
      salesByUser[s.userId].salesCount++
      salesByUser[s.userId].salesAmount += s.amount
    }
    const clientsByManager: Record<string, number> = {}
    const consultByManager: Record<string, number> = {}
    const refusalsByManager: Record<string, number> = {}
    for (const r of closerReports) {
      const uid = r.user.id
      clientsByManager[uid] = (clientsByManager[uid] || 0) + (Number((r.data as any).clientsReceived) || 0)
      consultByManager[uid] = (consultByManager[uid] || 0) + (Number((r.data as any).consultations) || 0)
      refusalsByManager[uid] = (refusalsByManager[uid] || 0) + (Number((r.data as any).refusals) || 0)
    }
    const liderMap: Record<string, { name: string; leads: number; qual: number; scheduled: number; attended: number }> = {}
    for (const r of liderReports) {
      const uid = r.user.id; const d = r.data as any
      if (!liderMap[uid]) liderMap[uid] = { name: r.user.name, leads: 0, qual: 0, scheduled: 0, attended: 0 }
      liderMap[uid].leads += Number(d.leadsReceived) || Number(d.leads) || 0
      liderMap[uid].qual += Number(d.qualifiedLeads) || 0
      liderMap[uid].scheduled += Number(d.meetingsScheduled) || 0
      liderMap[uid].attended += Number(d.meetingsAttended) || 0
    }

    const totalSalesAmount = periodSales.reduce((s, x) => s + x.amount, 0)
    const totalSalesCount = periodSales.length
    const totalClients = Object.values(clientsByManager).reduce((s, x) => s + x, 0)
    const totalConsultations = sumField(closerReports, 'consultations')
    const totalRefusals = sumField(closerReports, 'refusals')
    const salesPlan = totalPlan(selectedPlans, 'SALES_AMOUNT', null, deptId) ||
      totalPlan(selectedPlans, 'SALES_AMOUNT', null, null)
    const planCompletion = pctOneDecimal(totalSalesAmount, salesPlan)
    const conversion = pctOneDecimal(totalSalesCount, totalClients)
    const avgCheck = totalSalesCount > 0 ? Math.round(totalSalesAmount / totalSalesCount) : 0

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SalesPlatform'
    wb.created = new Date()

    // ── SHEET 1: Summary ────────────────────────────────────────────────────
    const wsSummary = wb.addWorksheet(L.sheet.summary, { properties: { tabColor: { argb: C_BLUE_MID } } })
    wsSummary.columns = [{ key: 'l', width: 32 }, { key: 'v', width: 28 }]

    wsSummary.mergeCells('A1:B1')
    wsSummary.getCell('A1').value = L.title.rop
    styleTitleRow(wsSummary, 1, 2)

    wsSummary.mergeCells('A2:B2')
    wsSummary.getCell('A2').value = `${L.misc.period}: ${pLabel}`
    wsSummary.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' }, name: 'Calibri' }
    wsSummary.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' }
    wsSummary.getRow(2).height = 20
    wsSummary.addRow([])

    const salesHdr = wsSummary.addRow([L.hdr.salesHdr, ''])
    styleSubHeader(wsSummary, salesHdr.number, 2)
    addSummaryBlock(wsSummary, salesHdr.number + 1, [
      { label: L.sum.salesVolume,    value: fmtMoney(totalSalesAmount) },
      { label: L.sum.dealsCount,     value: totalSalesCount },
      { label: L.sum.salesPlan,      value: fmtMoney(salesPlan) },
      { label: L.sum.planCompletion, value: `${planCompletion}%` },
      { label: L.sum.conversion,     value: `${conversion}%` },
      { label: L.sum.avgCheck,       value: fmtMoney(avgCheck) },
    ])

    const compCell = wsSummary.getCell(`B${salesHdr.number + 4}`)
    compCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(planCompletion) } }
    compCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: completionTextColor(planCompletion) } }

    wsSummary.addRow([])
    const clientHdr = wsSummary.addRow([L.hdr.clientFlow, ''])
    styleSubHeader(wsSummary, clientHdr.number, 2)
    addSummaryBlock(wsSummary, clientHdr.number + 1, [
      { label: L.sum.clientsReceived, value: totalClients },
      { label: L.sum.consultations,   value: totalConsultations },
      { label: L.sum.refusals,        value: totalRefusals },
      { label: L.sum.inWork,          value: Math.max(0, totalConsultations - totalSalesCount - totalRefusals) },
    ])

    const totalLiderLeads = Object.values(liderMap).reduce((s, x) => s + x.leads, 0)
    const totalQual = Object.values(liderMap).reduce((s, x) => s + x.qual, 0)
    const totalScheduled = Object.values(liderMap).reduce((s, x) => s + x.scheduled, 0)
    const totalAttended = Object.values(liderMap).reduce((s, x) => s + x.attended, 0)

    wsSummary.addRow([])
    const funnelHdr = wsSummary.addRow([L.hdr.liderFunnel, ''])
    styleSubHeader(wsSummary, funnelHdr.number, 2)
    addSummaryBlock(wsSummary, funnelHdr.number + 1, [
      { label: L.sum.leadsReceived,     value: totalLiderLeads },
      { label: L.sum.qualified,         value: totalQual },
      { label: L.sum.meetingsScheduled, value: totalScheduled },
      { label: L.sum.meetingsHappened,  value: totalAttended },
    ])

    // ── SHEET 2: Closers ────────────────────────────────────────────────────
    const wsClosers = wb.addWorksheet(L.sheet.closers, { properties: { tabColor: { argb: 'FF16A34A' } } })
    const closerCols = [
      L.col.manager, `${L.col.amount} (₸)`, L.col.amountRub.replace('Сома (₸)', L.col.amountRub),
      L.col.plan, L.col.completion, L.col.conversion, L.col.avgCheck,
      L.col.clients, L.col.consults, L.col.refusals, L.col.inWork,
    ]
    // Redefine cleanly
    const closerColsClean = [
      L.col.manager,
      `${L.hdr.salesHdr} (₸)`,
      L.sum.dealsCount,
      L.col.plan,
      L.col.completion,
      L.col.conversion,
      L.col.avgCheck,
      L.col.clients,
      L.col.consults,
      L.col.refusals,
      L.col.inWork,
    ]
    wsClosers.columns = [
      { key: 'name', width: 22 }, { key: 'amount', width: 18 }, { key: 'count', width: 14 },
      { key: 'plan', width: 16 }, { key: 'pct', width: 14 }, { key: 'conv', width: 14 },
      { key: 'avg', width: 16 }, { key: 'clients', width: 12 }, { key: 'consults', width: 14 },
      { key: 'refusals', width: 12 }, { key: 'inWork', width: 12 },
    ]

    wsClosers.mergeCells(`A1:${String.fromCharCode(64 + closerColsClean.length)}1`)
    wsClosers.getCell('A1').value = `${L.sheet.closers} — ${pLabel}`
    styleTitleRow(wsClosers, 1, closerColsClean.length)
    wsClosers.addRow([])

    const hRowC = wsClosers.addRow(closerColsClean)
    styleHeaderRow(wsClosers, hRowC.number, closerColsClean.length)

    const closers = managers.filter(m => m.managerType !== 'LIDER')
      .map(m => {
        const stats = salesByUser[m.id] || { salesCount: 0, salesAmount: 0 }
        const clients = clientsByManager[m.id] || 0
        const consults = consultByManager[m.id] || 0
        const refusals = refusalsByManager[m.id] || 0
        const plan = totalPlan(selectedPlans, 'SALES_AMOUNT', m.id)
        const comp = pctOneDecimal(stats.salesAmount, plan)
        return {
          name: m.name, salesAmount: stats.salesAmount, salesCount: stats.salesCount, plan,
          completion: comp, conversion: pctOneDecimal(stats.salesCount, clients),
          avgCheck: stats.salesCount > 0 ? Math.round(stats.salesAmount / stats.salesCount) : 0,
          clients, consults, refusals,
          inWork: Math.max(0, consults - stats.salesCount - refusals),
        }
      }).sort((a, b) => b.salesAmount - a.salesAmount)

    closers.forEach((m, i) => {
      const row = wsClosers.addRow([
        m.name, m.salesAmount, m.salesCount, m.plan, `${m.completion}%`,
        `${m.conversion}%`, m.avgCheck, m.clients, m.consults, m.refusals, m.inWork,
      ])
      styleDataRow(wsClosers, row.number, closerColsClean.length, i % 2 === 0)
      row.getCell(2).numFmt = '#,##0'; row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(4).numFmt = '#,##0'; row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(7).numFmt = '#,##0'; row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(m.completion) } }
      row.getCell(5).font = { bold: true, size: 10, name: 'Calibri', color: { argb: completionTextColor(m.completion) } }
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
      for (let c = 8; c <= 11; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
    })

    const closerTotalAmount = closers.reduce((s, m) => s + m.salesAmount, 0)
    const closerTotalCount = closers.reduce((s, m) => s + m.salesCount, 0)
    const totRowC = wsClosers.addRow([
      L.total, closerTotalAmount, closerTotalCount, '',
      `${pctOneDecimal(closerTotalAmount, salesPlan)}%`, `${conversion}%`,
      closerTotalCount > 0 ? Math.round(closerTotalAmount / closerTotalCount) : 0,
      totalClients, totalConsultations, totalRefusals,
      Math.max(0, totalConsultations - closerTotalCount - totalRefusals),
    ])
    for (let c = 1; c <= closerColsClean.length; c++) {
      totRowC.getCell(c).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      totRowC.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
      totRowC.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
      totRowC.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
    }
    totRowC.getCell(2).numFmt = '#,##0'; totRowC.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
    totRowC.getCell(7).numFmt = '#,##0'; totRowC.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
    totRowC.height = 24

    // ── SHEET 3: Liders ─────────────────────────────────────────────────────
    const wsLiders = wb.addWorksheet(L.sheet.liders, { properties: { tabColor: { argb: 'FF7C3AED' } } })
    const liderCols = [
      L.col.lider, L.col.attendedFact, L.col.meetingPlan,
      L.col.completion, L.col.scheduled, L.col.leads, L.col.qual, L.col.qualPct,
    ]
    wsLiders.columns = [
      { key: 'name', width: 22 }, { key: 'attended', width: 14 }, { key: 'plan', width: 14 },
      { key: 'pct', width: 14 }, { key: 'scheduled', width: 14 }, { key: 'leads', width: 12 },
      { key: 'qual', width: 12 }, { key: 'qualPct', width: 12 },
    ]

    wsLiders.mergeCells(`A1:${String.fromCharCode(64 + liderCols.length)}1`)
    wsLiders.getCell('A1').value = `${L.sheet.liders} — ${pLabel}`
    styleTitleRow(wsLiders, 1, liderCols.length)
    wsLiders.addRow([])

    const hRowL = wsLiders.addRow(liderCols)
    styleHeaderRow(wsLiders, hRowL.number, liderCols.length)

    managers.filter(m => m.managerType === 'LIDER')
      .map(m => {
        const stats = liderMap[m.id] || { leads: 0, qual: 0, scheduled: 0, attended: 0 }
        const meetingsPlan = totalPlan(selectedPlans, 'MEETINGS_ATTENDED', m.id)
        const comp = pctOneDecimal(stats.attended, meetingsPlan)
        return {
          name: m.name, attended: stats.attended, plan: meetingsPlan,
          completion: comp, scheduled: stats.scheduled, leads: stats.leads,
          qual: stats.qual, qualPct: pctOneDecimal(stats.qual, stats.leads),
        }
      })
      .sort((a, b) => b.completion - a.completion)
      .forEach((m, i) => {
        const row = wsLiders.addRow([
          m.name, m.attended, m.plan, `${m.completion}%`,
          m.scheduled, m.leads, m.qual, `${m.qualPct}%`,
        ])
        styleDataRow(wsLiders, row.number, liderCols.length, i % 2 === 0)
        row.getCell(2).font = { bold: true, size: 11, name: 'Calibri', color: { argb: C_BLUE_MID } }
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(m.completion) } }
        row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: completionTextColor(m.completion) } }
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
        for (let c = 5; c <= 8; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      })

    // ── SHEET 4: All sales ──────────────────────────────────────────────────
    const wsSales = wb.addWorksheet(L.sheet.allSales, { properties: { tabColor: { argb: 'FFDC2626' } } })
    const allSaleCols = [
      L.col.date, L.col.manager, L.col.amountRub, L.col.type,
      L.col.method, L.col.bank, L.col.months, L.col.comment,
    ]
    wsSales.columns = [
      { key: 'date', width: 14 }, { key: 'name', width: 20 }, { key: 'amount', width: 18 },
      { key: 'type', width: 16 }, { key: 'method', width: 16 }, { key: 'bank', width: 18 },
      { key: 'months', width: 10 }, { key: 'comment', width: 30 },
    ]

    wsSales.mergeCells(`A1:${String.fromCharCode(64 + allSaleCols.length)}1`)
    wsSales.getCell('A1').value = `${L.sheet.allSales} — ${pLabel}`
    styleTitleRow(wsSales, 1, allSaleCols.length)
    wsSales.addRow([])

    const hRowS = wsSales.addRow(allSaleCols)
    styleHeaderRow(wsSales, hRowS.number, allSaleCols.length)

    periodSales.forEach((s, i) => {
      const row = wsSales.addRow([
        fmtDate(s.date), s.user?.name || '—', s.amount,
        (L.payType as any)[s.paymentType] || s.paymentType,
        (L.payMethod as any)[s.paymentMethod] || s.paymentMethod,
        s.bank || '', s.months || '', s.comment || '',
      ])
      styleDataRow(wsSales, row.number, allSaleCols.length, i % 2 === 0)
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(3).numFmt = '#,##0'
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(3).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      if (s.paymentType === 'new_sale') {
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN_LIGHT } }
        row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_GREEN_TEXT } }
      } else {
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_AMBER_LIGHT } }
        row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_AMBER_TEXT } }
      }
    })

    const totRowS = wsSales.addRow([L.total, '', totalSalesAmount, '', '', '', '', L.misc.dealsTotal(totalSalesCount)])
    for (let c = 1; c <= allSaleCols.length; c++) {
      totRowS.getCell(c).font = { bold: true, size: 11, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      totRowS.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
      totRowS.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
      totRowS.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
    }
    totRowS.getCell(3).numFmt = '#,##0'; totRowS.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' }
    totRowS.height = 24

    // ── Monthly breakdown sheet (ROP, YTD — always shown when >1 month in year) ─
    if (ytdMonthKeys.length > 1) {
      const wsM = wb.addWorksheet(L.sheet.monthly, { properties: { tabColor: { argb: 'FF0F766E' } } })
      const moCols = [L.col.month, `${L.hdr.salesHdr} (₸)`, L.sum.dealsCount, L.col.plan, L.col.completion, L.col.clients, L.col.consults, L.col.leads, L.col.qual, L.col.scheduled, L.col.attended]
      wsM.columns = [
        { key: 'mo', width: 18 }, { key: 'amt', width: 18 }, { key: 'cnt', width: 14 },
        { key: 'pl', width: 16 }, { key: 'pct', width: 14 }, { key: 'cli', width: 12 },
        { key: 'con', width: 14 }, { key: 'leads', width: 12 }, { key: 'qual', width: 12 },
        { key: 'sched', width: 18 }, { key: 'att', width: 16 },
      ]
      wsM.mergeCells(`A1:${String.fromCharCode(64 + moCols.length)}1`)
      wsM.getCell('A1').value = `${L.sheet.monthly} — ${L.months[0]} ${start.getFullYear()} → ${pLabel}`
      styleTitleRow(wsM, 1, moCols.length)
      wsM.addRow([])
      styleHeaderRow(wsM, wsM.addRow(moCols).number, moCols.length)

      const sByMo: Record<string, { amt: number; cnt: number }> = {}
      for (const s of ytdSales) {
        const mk = s.date.substring(0, 7)
        if (!sByMo[mk]) sByMo[mk] = { amt: 0, cnt: 0 }
        sByMo[mk].amt += s.amount; sByMo[mk].cnt++
      }
      const cliByMo: Record<string, number> = {}; const conByMo: Record<string, number> = {}
      for (const r of ytdCloserReports) {
        const mk = dateToStr(r.date).substring(0, 7); const d = r.data as any
        cliByMo[mk] = (cliByMo[mk] || 0) + (Number(d.clientsReceived) || 0)
        conByMo[mk] = (conByMo[mk] || 0) + (Number(d.consultations) || 0)
      }
      const lByMo: Record<string, { leads: number; qual: number; sched: number; att: number }> = {}
      for (const r of ytdLiderReports) {
        const mk = dateToStr(r.date).substring(0, 7); const d = r.data as any
        if (!lByMo[mk]) lByMo[mk] = { leads: 0, qual: 0, sched: 0, att: 0 }
        lByMo[mk].leads += Number(d.leadsReceived) || Number(d.leads) || 0
        lByMo[mk].qual += Number(d.qualifiedLeads) || 0
        lByMo[mk].sched += Number(d.meetingsScheduled) || 0
        lByMo[mk].att += Number(d.meetingsAttended) || 0
      }
      ytdMonthKeys.forEach((mk, i) => {
        const [y, mo] = mk.split('-')
        const lbl = `${L.months[parseInt(mo, 10) - 1]} ${y}`
        const sa = sByMo[mk] || { amt: 0, cnt: 0 }
        const li = lByMo[mk] || { leads: 0, qual: 0, sched: 0, att: 0 }
        const moPl = planForMonth(plans, mk, 'SALES_AMOUNT', null, deptId) || planForMonth(plans, mk, 'SALES_AMOUNT', null, null)
        const moComp = pctOneDecimal(sa.amt, moPl)
        const row = wsM.addRow([lbl, sa.amt, sa.cnt, moPl || '—', moPl > 0 ? `${moComp}%` : '—', cliByMo[mk] || 0, conByMo[mk] || 0, li.leads, li.qual, li.sched, li.att])
        styleDataRow(wsM, row.number, moCols.length, i % 2 === 0)
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
        row.getCell(2).numFmt = '#,##0'; row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
        if (typeof row.getCell(4).value === 'number') { row.getCell(4).numFmt = '#,##0'; row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' } }
        if (moPl > 0) { row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(moComp) } }; row.getCell(5).font = { bold: true, size: 10, name: 'Calibri', color: { argb: completionTextColor(moComp) } } }
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
        for (let c = 6; c <= 11; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      })
    }

    const filename = `rop_report_${dateToStr(start)}_${dateToStr(end)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    await wb.xlsx.write(res)
    res.end()
  } catch (e) {
    console.error('Export ROP error:', e)
    res.status(500).json({ error: 'Export failed' })
  }
})

// ── Marketer export ────────────────────────────────────────────────────────

router.get('/marketer', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to, lang } = req.query
  const L = getL(lang as string)
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const monthKeys = getMonthKeys(start, end)
  const ytdStart = new Date(start.getFullYear(), 0, 1)
  const ytdFromStr = dateToStr(ytdStart)
  const ytdMonthKeys = getMonthKeys(ytdStart, end)
  const userId = req.user!.id
  const deptId = req.user!.departmentId
  const pLabel = periodLabel(period as string, L, from as string, to as string)

  try {
    const [user, reports, plans] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.report.findMany({ where: { userId, type: 'MARKETER', date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: { in: ytdMonthKeys } } }),
    ])
    const selectedPlans = plans.filter((p: any) => monthKeys.includes(p.period))
    let ytdReports = reports
    if (ytdStart < start) {
      const prevReports = await prisma.report.findMany({ where: { userId, type: 'MARKETER', date: { gte: ytdStart, lt: start } }, orderBy: { date: 'asc' } })
      ytdReports = [...prevReports, ...reports]
    }

    const findPlan = (type: string): number =>
      totalPlan(selectedPlans, type, userId) ||
      totalPlan(selectedPlans, type, null, deptId) ||
      totalPlan(selectedPlans, type, null, null)

    const totalLeads = reports.reduce((s, r) => s + (Number((r.data as any).leadsCount) || Number((r.data as any).leads) || 0), 0)
    const totalQualified = reports.reduce((s, r) => s + (Number((r.data as any).qualifiedLeads) || 0), 0)
    const totalBudget = reports.reduce((s, r) => s + (Number((r.data as any).adBudget) || 0), 0)
    const leadsplan = findPlan('LEADS')
    const budgetPlan = findPlan('BUDGET')
    const planCompletion = pctOneDecimal(totalLeads, leadsplan)
    const leadCost = totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0
    const qualCost = totalQualified > 0 ? Math.round(totalBudget / totalQualified) : 0

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SalesPlatform'
    wb.created = new Date()

    // ── SHEET 1: Summary ────────────────────────────────────────────────────
    const wsSummary = wb.addWorksheet(L.sheet.summary, { properties: { tabColor: { argb: 'FFF59E0B' } } })
    wsSummary.columns = [{ key: 'l', width: 32 }, { key: 'v', width: 28 }]

    wsSummary.mergeCells('A1:B1')
    wsSummary.getCell('A1').value = L.title.marketer(user?.name || '')
    styleTitleRow(wsSummary, 1, 2)

    wsSummary.mergeCells('A2:B2')
    wsSummary.getCell('A2').value = `${L.misc.period}: ${pLabel}`
    wsSummary.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' }, name: 'Calibri' }
    wsSummary.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' }
    wsSummary.getRow(2).height = 20
    wsSummary.addRow([])

    const leadsHdr = wsSummary.addRow([L.hdr.leadsHdr, ''])
    styleSubHeader(wsSummary, leadsHdr.number, 2)
    addSummaryBlock(wsSummary, leadsHdr.number + 1, [
      { label: L.sum.totalLeads,     value: totalLeads },
      { label: L.sum.leadsplan,      value: leadsplan || '—' },
      { label: L.sum.planCompletion, value: `${planCompletion}%` },
      { label: L.sum.qualified,      value: totalQualified },
      { label: L.sum.qualPct,        value: `${pctOneDecimal(totalQualified, totalLeads)}%` },
    ])

    wsSummary.addRow([])
    const budgetHdr = wsSummary.addRow([L.hdr.budgetHdr, ''])
    styleSubHeader(wsSummary, budgetHdr.number, 2)
    addSummaryBlock(wsSummary, budgetHdr.number + 1, [
      { label: L.sum.adBudgetFact, value: fmtMoney(totalBudget) },
      { label: L.sum.budgetPlan,   value: budgetPlan ? fmtMoney(budgetPlan) : '—' },
      { label: L.sum.leadCost,     value: leadCost ? fmtMoney(leadCost) : '—' },
      { label: L.sum.qualLeadCost, value: qualCost ? fmtMoney(qualCost) : '—' },
    ])

    // ── SHEET 2: Daily data ─────────────────────────────────────────────────
    const wsDaily = wb.addWorksheet(L.sheet.data, { properties: { tabColor: { argb: 'FFF59E0B' } } })
    const dailyCols = [L.col.date, L.col.leads, L.col.qual, L.col.budget, L.col.leadCost, L.col.comment]
    wsDaily.columns = [
      { key: 'date', width: 14 }, { key: 'leads', width: 12 }, { key: 'qual', width: 12 },
      { key: 'budget', width: 18 }, { key: 'cost', width: 16 }, { key: 'comment', width: 35 },
    ]

    wsDaily.mergeCells(`A1:${String.fromCharCode(64 + dailyCols.length)}1`)
    wsDaily.getCell('A1').value = `${L.sheet.data} — ${pLabel}`
    styleTitleRow(wsDaily, 1, dailyCols.length)
    wsDaily.addRow([])

    const hRowD = wsDaily.addRow(dailyCols)
    styleHeaderRow(wsDaily, hRowD.number, dailyCols.length)

    reports.forEach((r, i) => {
      const d = r.data as any
      const leads = Number(d.leadsCount) || Number(d.leads) || 0
      const budget = Number(d.adBudget) || 0
      const cost = leads > 0 ? Math.round(budget / leads) : 0
      const row = wsDaily.addRow([fmtDate(r.date), leads, Number(d.qualifiedLeads) || 0, budget, cost, d.comment || ''])
      styleDataRow(wsDaily, row.number, dailyCols.length, i % 2 === 0)
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(4).numFmt = '#,##0'; row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(5).numFmt = '#,##0'; row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
    })

    const totRowD = wsDaily.addRow([L.total, totalLeads, totalQualified, totalBudget, leadCost || '', `${reports.length} ${L.days}`])
    for (let c = 1; c <= dailyCols.length; c++) {
      totRowD.getCell(c).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      totRowD.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
      totRowD.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
      totRowD.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
    }
    totRowD.getCell(4).numFmt = '#,##0'; totRowD.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
    totRowD.height = 22

    // ── Monthly breakdown sheet (marketer, YTD — always shown when >1 month) ──
    if (ytdMonthKeys.length > 1) {
      const wsM = wb.addWorksheet(L.sheet.monthly, { properties: { tabColor: { argb: 'FF0F766E' } } })
      const moCols = [L.col.month, L.col.leads, L.sum.leadsplan, L.col.completion, L.col.qual, L.col.qualPct, L.col.budget, L.col.leadCost]
      wsM.columns = [
        { key: 'mo', width: 18 }, { key: 'leads', width: 12 }, { key: 'pl', width: 14 },
        { key: 'pct', width: 14 }, { key: 'qual', width: 12 }, { key: 'qpct', width: 12 },
        { key: 'bud', width: 18 }, { key: 'lc', width: 16 },
      ]
      wsM.mergeCells(`A1:${String.fromCharCode(64 + moCols.length)}1`)
      wsM.getCell('A1').value = `${L.sheet.monthly} — ${L.months[0]} ${start.getFullYear()} → ${pLabel}`
      styleTitleRow(wsM, 1, moCols.length)
      wsM.addRow([])
      styleHeaderRow(wsM, wsM.addRow(moCols).number, moCols.length)

      const rByMo: Record<string, { leads: number; qual: number; budget: number }> = {}
      for (const r of ytdReports) {
        const mk = dateToStr(r.date).substring(0, 7); const d = r.data as any
        if (!rByMo[mk]) rByMo[mk] = { leads: 0, qual: 0, budget: 0 }
        rByMo[mk].leads += Number(d.leadsCount) || Number(d.leads) || 0
        rByMo[mk].qual += Number(d.qualifiedLeads) || 0
        rByMo[mk].budget += Number(d.adBudget) || 0
      }
      ytdMonthKeys.forEach((mk, i) => {
        const [y, mo] = mk.split('-')
        const lbl = `${L.months[parseInt(mo, 10) - 1]} ${y}`
        const st = rByMo[mk] || { leads: 0, qual: 0, budget: 0 }
        const moPl = planForMonth(plans, mk, 'LEADS', userId) || planForMonth(plans, mk, 'LEADS', null, deptId) || planForMonth(plans, mk, 'LEADS', null, null)
        const moComp = pctOneDecimal(st.leads, moPl)
        const lc = st.leads > 0 ? Math.round(st.budget / st.leads) : 0
        const row = wsM.addRow([lbl, st.leads, moPl || '—', moPl > 0 ? `${moComp}%` : '—', st.qual, `${pctOneDecimal(st.qual, st.leads)}%`, st.budget, lc || '—'])
        styleDataRow(wsM, row.number, moCols.length, i % 2 === 0)
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
        if (moPl > 0) { row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(moComp) } }; row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: completionTextColor(moComp) } } }
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(7).numFmt = '#,##0'; row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
        if (typeof row.getCell(8).value === 'number') { row.getCell(8).numFmt = '#,##0'; row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' } }
      })
    }

    const safeName = (user?.name || 'marketer').replace(/[^а-яёА-ЯЁa-zA-Z0-9]/g, '_')
    const filename = `marketer_${safeName}_${dateToStr(start)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    await wb.xlsx.write(res)
    res.end()
  } catch (e) {
    console.error('Export marketer error:', e)
    res.status(500).json({ error: 'Export failed' })
  }
})

// ── Lider FULL export ──────────────────────────────────────────────────────

router.get('/lider-full', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to, search, channelId, ktsStatus, subStatus, consultationStatus, date: dateFilter, lang } = req.query
  const L = getL(lang as string)
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const fromStr = dateToStr(start)
  const toStr   = dateToStr(end)
  const userId  = req.user!.id
  const pLabel  = periodLabel(period as string, L, from as string, to as string)
  const monthKeys = getMonthKeys(start, end)
  const ytdStart = new Date(start.getFullYear(), 0, 1)
  const ytdFromStr = dateToStr(ytdStart)
  const ytdMonthKeys = getMonthKeys(ytdStart, end)

  try {
    const leadWhere: any = {
      createdById: userId,
      date: { gte: fromStr, lte: toStr },
    }
    if (search) leadWhere.OR = [
      { clientName: { contains: search as string, mode: 'insensitive' } },
      { phone: { contains: search as string } },
      { leadLink: { contains: search as string, mode: 'insensitive' } },
    ]
    if (channelId)          leadWhere.salesChannelId = channelId as string
    if (subStatus)          leadWhere.subStatus = subStatus as string
    if (consultationStatus) leadWhere.consultationStatus = consultationStatus as string
    if (dateFilter)         leadWhere.appointmentDate = dateFilter as string
    if (ktsStatus === 'qualified') {
      leadWhere.isQualified = true
      leadWhere.status = { not: 'IN_WORK' }
      if (!subStatus) {
        leadWhere.AND = [{ OR: [{ subStatus: null }, { subStatus: { not: 'in_work_kc' } }] }]
      }
    } else if (ktsStatus === 'unqualified') {
      leadWhere.isQualified = false
    } else if (ktsStatus === 'in_work') {
      leadWhere.OR = [{ subStatus: 'in_work_kc' }, { status: 'IN_WORK' }]
    }

    const [user, leads, reports, plans] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.lead.findMany({
        where: leadWhere,
        include: {
          salesChannel: { select: { id: true, name: true } },
          assignedTo:   { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.report.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: { in: ytdMonthKeys }, userId } }),
    ])
    const selectedPlans = plans.filter((p: any) => monthKeys.includes(p.period))
    // YTD leads (no filters except date/user) for monthly breakdown
    let ytdLeads = leads
    if (ytdStart < start) {
      const prevLeads = await prisma.lead.findMany({
        where: { createdById: userId, date: { gte: ytdFromStr, lt: fromStr } },
        include: { salesChannel: { select: { id: true, name: true } }, assignedTo: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      })
      ytdLeads = [...prevLeads, ...leads]
    }

    const totalLeads     = leads.length
    const totalQual      = leads.filter(l => l.isQualified).length
    const totalScheduled = leads.filter(l =>
      l.consultationStatus && ['planned', 'happened', 'not_happened', 'postponed'].includes(l.consultationStatus)
    ).length
    const totalHappened  = leads.filter(l => l.consultationStatus === 'happened').length

    const meetPlan  = totalPlan(selectedPlans, 'MEETINGS_ATTENDED', userId)
    const leadsPlan = totalPlan(selectedPlans, 'LEADS', userId)

    const pctMeet  = meetPlan  > 0 ? pctOneDecimal(totalHappened, meetPlan)  : 0
    const pctLeads = leadsPlan > 0 ? pctOneDecimal(totalLeads, leadsPlan)    : 0
    const pctQual  = totalLeads > 0 ? pctOneDecimal(totalQual, totalLeads)   : 0

    // Monthly breakdown (YTD — uses ytdLeads which includes all months from Jan 1)
    const monthMap = new Map<string, { label: string; leads: number; qual: number; scheduled: number; happened: number }>()
    for (const l of ytdLeads) {
      const [y, m] = (l.date as string).split('-')
      const key = `${y}-${m}`
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          label: `${L.months[parseInt(m, 10) - 1]} ${y}`,
          leads: 0, qual: 0, scheduled: 0, happened: 0,
        })
      }
      const mo = monthMap.get(key)!
      mo.leads++
      if (l.isQualified) mo.qual++
      if (l.consultationStatus && ['planned','happened','not_happened','postponed'].includes(l.consultationStatus)) mo.scheduled++
      if (l.consultationStatus === 'happened') mo.happened++
    }
    // Also ensure all ytdMonthKeys have a row (even if no leads that month)
    for (const mk of ytdMonthKeys) {
      if (!monthMap.has(mk)) {
        const [y, m] = mk.split('-')
        monthMap.set(mk, { label: `${L.months[parseInt(m, 10) - 1]} ${y}`, leads: 0, qual: 0, scheduled: 0, happened: 0 })
      }
    }
    const monthRows = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v)
    const isMultiMonth = ytdMonthKeys.length > 1

    // Channel breakdown
    const chanMap = new Map<string, { name: string; leads: number; qual: number; scheduled: number; happened: number }>()
    for (const l of leads) {
      const cId   = (l as any).salesChannel?.id   || '__none__'
      const cName = (l as any).salesChannel?.name || L.misc.noChannel
      if (!chanMap.has(cId)) chanMap.set(cId, { name: cName, leads: 0, qual: 0, scheduled: 0, happened: 0 })
      const ch = chanMap.get(cId)!
      ch.leads++
      if (l.isQualified) ch.qual++
      if (l.consultationStatus && ['planned','happened','not_happened','postponed'].includes(l.consultationStatus)) ch.scheduled++
      if (l.consultationStatus === 'happened') ch.happened++
    }
    const chanRows = [...chanMap.values()].sort((a, b) => b.leads - a.leads)

    const fmtD = (s?: string | null) => s ? s.split('-').reverse().join('.') : ''
    const ktsLabel = (l: any) =>
      !l.isQualified ? L.kts.unqual
      : l.status === 'IN_WORK' ? L.kts.inWork
      : l.subStatus === 'in_work_kc' ? L.kts.inWork
      : l.assignedToId ? L.kts.qualCloser
      : L.kts.qual

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SalesPlatform'
    wb.created = new Date()

    // ── SHEET 1: Summary ────────────────────────────────────────────────────
    const wsSum = wb.addWorksheet(L.sheet.summary, { properties: { tabColor: { argb: C_BLUE_MID } } })
    wsSum.columns = [{ key: 'l', width: 34 }, { key: 'v', width: 22 }, { key: 'c', width: 36 }]

    wsSum.mergeCells('A1:B1')
    wsSum.getCell('A1').value = L.title.lider(user?.name || '')
    styleTitleRow(wsSum, 1, 2)

    wsSum.mergeCells('A2:B2')
    const subCell = wsSum.getCell('A2')
    subCell.value = `${L.misc.period}: ${pLabel}${ktsStatus || search || channelId ? `  |  ${L.misc.filters}` : ''}`
    subCell.font = { size: 10, color: { argb: 'FF64748B' }, name: 'Calibri' }
    subCell.alignment = { horizontal: 'left', vertical: 'middle' }
    wsSum.getRow(2).height = 20
    wsSum.addRow([])

    // Funnel
    styleSubHeader(wsSum, wsSum.addRow([L.hdr.leadFunnel, '']).number, 2)
    const funnelItems = [
      { label: L.sum.leadsReceived,     value: totalLeads,     pct: leadsPlan > 0 ? `${L.misc.plan}: ${leadsPlan}  /  ${L.misc.fact}: ${totalLeads}  /  ${pctLeads}%` : `${totalLeads}` },
      { label: `→ ${L.sum.qualified}`,  value: totalQual,      pct: `${pctOneDecimal(totalQual, totalLeads)}% ${L.misc.fromLeads}` },
      { label: `→ ${L.sum.meetingsScheduled}`, value: totalScheduled, pct: `${pctOneDecimal(totalScheduled, totalQual)}% ${L.misc.fromQual}` },
      { label: `→ ${L.sum.meetingsHappened}`,  value: totalHappened,  pct: `${pctOneDecimal(totalHappened, totalScheduled)}% ${L.misc.fromScheduled}` },
    ]
    for (const fi of funnelItems) {
      const row = wsSum.addRow([fi.label, fi.value])
      row.getCell(1).font = { size: 10, name: 'Calibri', color: { argb: 'FF475569' } }
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(2).font = { bold: true, size: 11, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
      wsSum.getCell(`C${row.number}`).value = fi.pct
      wsSum.getCell(`C${row.number}`).font = { italic: true, size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } }
      wsSum.getCell(`C${row.number}`).alignment = { horizontal: 'left', vertical: 'middle' }
      row.height = 22
    }

    wsSum.addRow([])

    // Plan execution
    styleSubHeader(wsSum, wsSum.addRow([L.hdr.planExec, '']).number, 2)
    if (meetPlan > 0) {
      const planRow = wsSum.addRow([L.misc.meetPlanLbl, `${pctMeet}%`])
      planRow.getCell(1).font = { size: 10, name: 'Calibri', color: { argb: 'FF475569' } }
      planRow.getCell(2).font = { bold: true, size: 13, name: 'Calibri', color: { argb: completionTextColor(pctMeet) } }
      planRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(pctMeet) } }
      planRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
      planRow.height = 24
      wsSum.addRow([L.misc.factMeetings, totalHappened]).getCell(1).font = { size: 10, name: 'Calibri', color: { argb: 'FF64748B' } }
      wsSum.addRow([L.misc.planMeetings, meetPlan]).getCell(1).font    = { size: 10, name: 'Calibri', color: { argb: 'FF64748B' } }
    }
    if (leadsPlan > 0) {
      wsSum.addRow([])
      const planRow2 = wsSum.addRow([L.misc.leadPlanLbl, `${pctLeads}%`])
      planRow2.getCell(1).font = { size: 10, name: 'Calibri', color: { argb: 'FF475569' } }
      planRow2.getCell(2).font = { bold: true, size: 13, name: 'Calibri', color: { argb: completionTextColor(pctLeads) } }
      planRow2.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(pctLeads) } }
      planRow2.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
      planRow2.height = 24
      wsSum.addRow([L.misc.factLeads, totalLeads]).getCell(1).font   = { size: 10, name: 'Calibri', color: { argb: 'FF64748B' } }
      wsSum.addRow([L.misc.planLeads, leadsPlan]).getCell(1).font    = { size: 10, name: 'Calibri', color: { argb: 'FF64748B' } }
    }

    wsSum.addRow([])

    // Top channels
    if (chanRows.length > 0) {
      styleSubHeader(wsSum, wsSum.addRow([L.hdr.topChannels, '']).number, 2)
      chanRows.slice(0, 5).forEach((ch, i) => {
        const r = wsSum.addRow([`${i + 1}. ${ch.name}`, ch.leads])
        r.getCell(1).font = { size: 10, name: 'Calibri', color: { argb: 'FF475569' } }
        r.getCell(2).font = { bold: true, size: 11, name: 'Calibri', color: { argb: C_BLUE_DARK } }
        wsSum.getCell(`C${r.number}`).value = ch.qual > 0 ? `${L.sum.qualified.toLowerCase()}: ${ch.qual}  (${pctOneDecimal(ch.qual, ch.leads)}%)` : ''
        wsSum.getCell(`C${r.number}`).font  = { italic: true, size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } }
        r.height = 20
      })
    }

    // ── SHEET 2: Monthly (YTD — always shown when >1 month in year) ─────────
    if (isMultiMonth) {
      const wsMon = wb.addWorksheet(L.sheet.monthly, { properties: { tabColor: { argb: 'FF7C3AED' } } })
      const monCols = [
        L.col.month, L.col.leads, L.col.qual, L.col.qualPctCol,
        L.col.scheduled, L.col.attended, L.col.happenedPct, L.col.planExecCol,
      ]
      wsMon.columns = [
        { key: 'month', width: 20 }, { key: 'leads', width: 12 }, { key: 'qual', width: 12 },
        { key: 'qpct', width: 12 }, { key: 'sched', width: 14 }, { key: 'happ', width: 14 },
        { key: 'hpct', width: 26 }, { key: 'plan', width: 22 },
      ]
      wsMon.mergeCells(`A1:${String.fromCharCode(64 + monCols.length)}1`)
      wsMon.getCell('A1').value = `${L.sheet.monthly} — ${L.months[0]} ${start.getFullYear()} → ${pLabel}`
      styleTitleRow(wsMon, 1, monCols.length)
      wsMon.addRow([])
      styleHeaderRow(wsMon, wsMon.addRow(monCols).number, monCols.length)

      let altMon = false
      for (const mo of monthRows) {
        const qPct = mo.leads > 0   ? pctOneDecimal(mo.qual, mo.leads) : 0
        const hPct = mo.scheduled > 0 ? pctOneDecimal(mo.happened, mo.scheduled) : 0
        const planPct = meetPlan > 0 ? pctOneDecimal(mo.happened, meetPlan) : null
        const row = wsMon.addRow([
          mo.label, mo.leads, mo.qual, `${qPct}%`,
          mo.scheduled, mo.happened, `${hPct}%`,
          planPct !== null ? `${planPct}%` : '—',
        ])
        styleDataRow(wsMon, row.number, monCols.length, altMon)
        altMon = !altMon
        row.getCell(1).font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } }
        for (let c = 2; c <= 8; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
        if (planPct !== null) {
          row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(planPct) } }
          row.getCell(8).font = { bold: true, size: 10, name: 'Calibri', color: { argb: completionTextColor(planPct) } }
        }
        if (qPct >= 70) {
          row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN_LIGHT } }
          row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_GREEN_TEXT } }
        } else if (qPct < 40 && mo.leads > 0) {
          row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_RED_LIGHT } }
          row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_RED_TEXT } }
        }
      }

      const totQ = monthRows.reduce((s, m) => s + m.qual, 0)
      const totS = monthRows.reduce((s, m) => s + m.scheduled, 0)
      const totH = monthRows.reduce((s, m) => s + m.happened, 0)
      const totL = monthRows.reduce((s, m) => s + m.leads, 0)
      const totRow = wsMon.addRow([
        L.total, totL, totQ, `${pctOneDecimal(totQ, totL)}%`,
        totS, totH, `${pctOneDecimal(totH, totS)}%`,
        meetPlan > 0 ? `${pctOneDecimal(totH, meetPlan)}%` : '—',
      ])
      for (let c = 1; c <= monCols.length; c++) {
        totRow.getCell(c).font  = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
        totRow.getCell(c).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
        totRow.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
        totRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      }
      totRow.height = 22
    }

    // ── SHEET 3: By channel ─────────────────────────────────────────────────
    const wsChan = wb.addWorksheet(L.sheet.channels, { properties: { tabColor: { argb: 'FFEA580C' } } })
    const chanCols = [
      L.col.channel, L.col.leads, L.col.qual, L.col.qualPctCol,
      L.col.scheduled, L.col.attended, L.col.happenedPct.replace('от записанных', '').trim(), L.col.share,
    ]
    wsChan.columns = [
      { key: 'chan', width: 24 }, { key: 'leads', width: 12 }, { key: 'qual', width: 12 },
      { key: 'qpct', width: 12 }, { key: 'sched', width: 14 }, { key: 'happ', width: 14 },
      { key: 'hpct', width: 14 }, { key: 'share', width: 16 },
    ]
    wsChan.mergeCells(`A1:${String.fromCharCode(64 + chanCols.length)}1`)
    wsChan.getCell('A1').value = `${L.sheet.channels} — ${pLabel}`
    styleTitleRow(wsChan, 1, chanCols.length)
    wsChan.addRow([])
    styleHeaderRow(wsChan, wsChan.addRow(chanCols).number, chanCols.length)

    let altC = false
    for (const ch of chanRows) {
      const qPct  = ch.leads > 0     ? pctOneDecimal(ch.qual, ch.leads)         : 0
      const hPct  = ch.scheduled > 0 ? pctOneDecimal(ch.happened, ch.scheduled) : 0
      const share = totalLeads > 0   ? pctOneDecimal(ch.leads, totalLeads)      : 0
      const row = wsChan.addRow([ch.name, ch.leads, ch.qual, `${qPct}%`, ch.scheduled, ch.happened, `${hPct}%`, `${share}%`])
      styleDataRow(wsChan, row.number, chanCols.length, altC)
      altC = !altC
      for (let c = 2; c <= 8; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      if (qPct >= 70) {
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN_LIGHT } }
        row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_GREEN_TEXT } }
      } else if (qPct < 40 && ch.leads > 0) {
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_RED_LIGHT } }
        row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_RED_TEXT } }
      }
    }
    const cTotRow = wsChan.addRow([
      L.total, totalLeads, totalQual, `${pctQual}%`, totalScheduled, totalHappened,
      `${totalScheduled > 0 ? pctOneDecimal(totalHappened, totalScheduled) : 0}%`, '100%',
    ])
    for (let c = 1; c <= chanCols.length; c++) {
      cTotRow.getCell(c).font  = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      cTotRow.getCell(c).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
      cTotRow.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
      cTotRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
    }
    cTotRow.height = 22

    // ── SHEET 4: All leads ──────────────────────────────────────────────────
    const wsLeads = wb.addWorksheet(L.sheet.leads, { properties: { tabColor: { argb: C_BLUE_MID } } })
    const LCOLS = 12
    wsLeads.columns = [
      { key: 'date',   width: 20 }, { key: 'client', width: 24 }, { key: 'phone',  width: 16 },
      { key: 'link',   width: 32 }, { key: 'chan',   width: 18 }, { key: 'kts',    width: 16 },
      { key: 'sub',    width: 16 }, { key: 'apptD',  width: 14 }, { key: 'apptT', width: 10 },
      { key: 'closer', width: 22 }, { key: 'consul', width: 18 }, { key: 'post',   width: 18 },
    ]
    wsLeads.mergeCells(`A1:${String.fromCharCode(64 + LCOLS)}1`)
    wsLeads.getCell('A1').value = `${L.sheet.leads} — ${pLabel}`
    styleTitleRow(wsLeads, 1, LCOLS)
    wsLeads.addRow([])
    styleHeaderRow(wsLeads, wsLeads.addRow([
      L.col.receivedAt, L.col.clientName, L.col.phone, L.col.link, L.col.channel,
      L.col.kts, L.col.sub, L.col.apptDate, L.col.apptTime, L.col.closer,
      L.col.consultStatus, L.col.postponed,
    ]).number, LCOLS)

    leads.forEach((l, i) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      const kzDate = new Date(l.createdAt.getTime() + 5 * 3600 * 1000)
      const dateStr = `${pad(kzDate.getUTCDate())}.${pad(kzDate.getUTCMonth()+1)}.${kzDate.getUTCFullYear()} ${pad(kzDate.getUTCHours())}:${pad(kzDate.getUTCMinutes())}`
      const row = wsLeads.addRow([
        dateStr, l.clientName, l.phone, l.leadLink || '',
        (l as any).salesChannel?.name || '',
        ktsLabel(l),
        l.subStatus ? ((L.status as any)[l.subStatus] || l.subStatus) : '',
        fmtD(l.appointmentDate), l.appointmentTime || '',
        (l as any).assignedTo?.name || '',
        l.consultationStatus ? ((L.status as any)[l.consultationStatus] || l.consultationStatus) : '',
        l.postponedDate ? `${fmtD(l.postponedDate)}${l.postponedTime ? ' ' + l.postponedTime : ''}` : '',
      ])
      styleDataRow(wsLeads, row.number, LCOLS, i % 2 === 1)
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

      const kts = ktsLabel(l)
      if (kts === L.kts.qual || kts === L.kts.qualCloser) {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN_LIGHT } }
        row.getCell(6).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_GREEN_TEXT } }
      } else if (kts === L.kts.unqual) {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_RED_LIGHT } }
        row.getCell(6).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_RED_TEXT } }
      } else {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_AMBER_LIGHT } }
        row.getCell(6).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_AMBER_TEXT } }
      }
      const cs = l.consultationStatus
      if (cs === 'happened') {
        row.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN_LIGHT } }
        row.getCell(11).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_GREEN_TEXT } }
      } else if (cs === 'not_happened') {
        row.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_RED_LIGHT } }
        row.getCell(11).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_RED_TEXT } }
      } else if (cs === 'postponed') {
        row.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_AMBER_LIGHT } }
        row.getCell(11).font = { size: 10, name: 'Calibri', color: { argb: C_AMBER_TEXT } }
      }
    })

    const lTotRow = wsLeads.addRow([
      L.misc.leadsTotal(leads.length), '', '', '', '',
      L.misc.qualTotal(totalQual), L.misc.scheduledTotal(totalScheduled),
      '', '', '', L.misc.happenedTotal(totalHappened), '',
    ])
    for (let c = 1; c <= LCOLS; c++) {
      lTotRow.getCell(c).font  = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      lTotRow.getCell(c).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
      lTotRow.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
    }
    lTotRow.height = 22

    // ── SHEET 5: Daily reports ───────────────────────────────────────────────
    if (reports.length > 0) {
      const wsRep = wb.addWorksheet(L.sheet.dailyReports, { properties: { tabColor: { argb: 'FF16A34A' } } })
      const repCols = [L.col.date, L.col.leads, L.col.qual, L.col.scheduled, L.col.attended, L.col.comment]
      wsRep.columns = [
        { key: 'date', width: 14 }, { key: 'leads', width: 12 }, { key: 'qual', width: 12 },
        { key: 'sched', width: 22 }, { key: 'happ', width: 22 }, { key: 'comment', width: 40 },
      ]
      wsRep.mergeCells(`A1:${String.fromCharCode(64 + repCols.length)}1`)
      wsRep.getCell('A1').value = `${L.sheet.dailyReports} — ${pLabel}`
      styleTitleRow(wsRep, 1, repCols.length)
      wsRep.addRow([])
      styleHeaderRow(wsRep, wsRep.addRow(repCols).number, repCols.length)

      reports.forEach((r, i) => {
        const d = r.data as any
        const sched = Number(d.meetingsScheduled) || 0
        const happ  = Number(d.meetingsAttended)  || 0
        const row = wsRep.addRow([
          fmtDate(r.date), Number(d.leadsReceived) || Number(d.leads) || 0,
          Number(d.qualifiedLeads) || 0, sched, happ, d.comment || '',
        ])
        styleDataRow(wsRep, row.number, repCols.length, i % 2 === 0)
        for (let c = 1; c <= 5; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' }
        if (happ > 0) {
          row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN_LIGHT } }
          row.getCell(5).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_GREEN_TEXT } }
        }
      })

      const rTot = wsRep.addRow([
        L.total, sumLiderLeads(reports), sumField(reports, 'qualifiedLeads'),
        sumField(reports, 'meetingsScheduled'), sumField(reports, 'meetingsAttended'),
        `${reports.length} ${L.days}`,
      ])
      for (let c = 1; c <= repCols.length; c++) {
        rTot.getCell(c).font  = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
        rTot.getCell(c).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
        rTot.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
        rTot.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      }
      rTot.height = 22
    }

    // ── Send ─────────────────────────────────────────────────────────────────
    const safeName = (user?.name || 'lider').replace(/[^а-яёА-ЯЁa-zA-Z0-9]/g, '_')
    const filename = `lider_${safeName}_${fromStr}_${toStr}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    await wb.xlsx.write(res)
    res.end()
  } catch (e) {
    console.error('Export lider-full error:', e)
    res.status(500).json({ error: 'Export failed' })
  }
})

// ── Lider leads export (legacy) ────────────────────────────────────────────

router.get('/lider-leads', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to, search, channelId, ktsStatus, subStatus, consultationStatus, date: dateFilter, lang } = req.query
  const L = getL(lang as string)
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const fromStr = dateToStr(start)
  const toStr = dateToStr(end)
  const pLabel = periodLabel(period as string, L, from as string, to as string)

  try {
    const where: any = {
      createdById: req.user!.id,
      date: { gte: fromStr, lte: toStr },
    }
    if (search) where.OR = [
      { clientName: { contains: search as string, mode: 'insensitive' } },
      { phone: { contains: search as string } },
      { leadLink: { contains: search as string, mode: 'insensitive' } },
    ]
    if (channelId) where.salesChannelId = channelId as string
    if (subStatus) where.subStatus = subStatus as string
    if (consultationStatus) where.consultationStatus = consultationStatus as string
    if (dateFilter) where.appointmentDate = dateFilter as string
    if (ktsStatus === 'qualified') { where.isQualified = true; where.assignedToId = null }
    else if (ktsStatus === 'unqualified') { where.isQualified = false }
    else if (ktsStatus === 'in_work') { where.assignedToId = { not: null } }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        salesChannel: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const fmtD = (s?: string | null) => s ? s.split('-').reverse().join('.') : ''

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SalesPlatform'
    wb.created = new Date()

    const ws = wb.addWorksheet(L.col.leads, { properties: { tabColor: { argb: C_BLUE_MID } } })
    const COLS = 12

    ws.columns = [
      { key: 'date', width: 20 }, { key: 'client', width: 24 }, { key: 'phone', width: 18 },
      { key: 'link', width: 36 }, { key: 'channel', width: 18 }, { key: 'kts', width: 14 },
      { key: 'subStatus', width: 16 }, { key: 'apptDate', width: 14 }, { key: 'apptTime', width: 10 },
      { key: 'closer', width: 22 }, { key: 'consultation', width: 18 }, { key: 'postponed', width: 18 },
    ]

    ws.mergeCells('A1:L1')
    ws.getCell('A1').value = L.title.lider(req.user?.name || '')
    styleTitleRow(ws, 1, COLS)

    const headers = [
      L.col.receivedAt, L.col.clientName, L.col.phone, L.col.link, L.col.channel,
      L.col.kts, L.col.sub, L.col.apptDate, L.col.apptTime, L.col.closer,
      L.col.consultStatus, L.col.postponed,
    ]
    ws.addRow(headers)
    styleHeaderRow(ws, 2, COLS)

    leads.forEach((l, i) => {
      const d = new Date(l.createdAt)
      const pad = (n: number) => String(n).padStart(2, '0')
      const dateStr = `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      const row = ws.addRow([
        dateStr, l.clientName, l.phone, l.leadLink || '',
        (l as any).salesChannel?.name || '',
        !l.isQualified ? L.kts.unqual : l.assignedToId ? L.kts.inWork : L.kts.qual,
        l.subStatus ? ((L.status as any)[l.subStatus] || l.subStatus) : '',
        fmtD(l.appointmentDate), l.appointmentTime || '',
        (l as any).assignedTo?.name || '',
        l.consultationStatus ? ((L.status as any)[l.consultationStatus] || l.consultationStatus) : '',
        l.postponedDate ? `${fmtD(l.postponedDate)}${l.postponedTime ? ' ' + l.postponedTime : ''}` : '',
      ])
      styleDataRow(ws, row.number, COLS, i % 2 === 1)
    })

    const totRow = ws.addRow([L.misc.leadsTotal(leads.length), '', '', '', '', '', '', '', '', '', '', ''])
    for (let c = 1; c <= COLS; c++) {
      totRow.getCell(c).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      totRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
      totRow.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
    }
    totRow.height = 22

    const safeName = (req.user?.name || 'lider').replace(/[^а-яёА-ЯЁa-zA-Z0-9]/g, '_')
    const filename = `lider_leads_${safeName}_${fromStr}_${toStr}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    await wb.xlsx.write(res)
    res.end()
  } catch (e) {
    console.error('Export lider-leads error:', e)
    res.status(500).json({ error: 'Export failed' })
  }
})

export default router
