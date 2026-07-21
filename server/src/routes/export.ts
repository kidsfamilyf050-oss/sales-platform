import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'
import ExcelJS from 'exceljs'

const router = Router()
const prisma = new PrismaClient()

// ── Helpers ────────────────────────────────────────────────────────────────

function getPeriodDates(period: string, from?: string, to?: string) {
  if (from && to) return { start: new Date(from), end: new Date(to) }
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

function fmtDate(d: string | Date) {
  const date = typeof d === 'string' ? new Date(d + 'T12:00:00') : d
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtMoney(n: number) {
  return `₸ ${n.toLocaleString('ru-RU')}`
}

function periodLabel(period: string, from?: string, to?: string) {
  if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`
  const map: Record<string, string> = {
    today: 'Сегодня', yesterday: 'Вчера', week: 'Последние 7 дней', month: 'Текущий месяц'
  }
  return map[period] || period
}

// ── Excel style constants ──────────────────────────────────────────────────

const C_BLUE_DARK   = 'FF1E40AF'  // dark blue header
const C_BLUE_MID    = 'FF2563EB'  // mid blue accent
const C_BLUE_LIGHT  = 'FFDBEAFE'  // light blue alt row
const C_WHITE       = 'FFFFFFFF'
const C_GRAY_HDR    = 'FFF1F5F9'  // section sub-header
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
  if (pct >= 100) return C_GREEN_LIGHT
  if (pct >= 75)  return C_GREEN_LIGHT
  if (pct >= 50)  return C_AMBER_LIGHT
  return C_RED_LIGHT
}

function completionTextColor(pct: number) {
  if (pct >= 75) return C_GREEN_TEXT
  if (pct >= 50) return C_AMBER_TEXT
  return C_RED_TEXT
}

// ── MANAGER export (Lider or Closer) ──────────────────────────────────────

router.get('/manager', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const userId = req.user!.id
  const fromStr = dateToStr(start)
  const toStr = dateToStr(end)
  const pLabel = periodLabel(period as string, from as string, to as string)

  try {
    const [user, reports, plans, periodSales] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, managerType: true } }),
      prisma.report.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey, userId } }),
      prisma.sale.findMany({ where: { userId, date: { gte: fromStr, lte: toStr } }, orderBy: { date: 'asc' } }),
    ])

    const isCloser = req.user!.managerType === 'CLOSER'
    const wb = new ExcelJS.Workbook()
    wb.creator = 'SalesPlatform'
    wb.created = new Date()

    // ── SHEET 1: Summary ────────────────────────────────────────────────────
    const wsSummary = wb.addWorksheet('Сводка', { properties: { tabColor: { argb: C_BLUE_MID } } })
    wsSummary.columns = [
      { key: 'label', width: 30 },
      { key: 'value', width: 30 },
    ]

    // Title
    wsSummary.mergeCells('A1:B1')
    const titleCell = wsSummary.getCell('A1')
    titleCell.value = `Отчёт — ${user?.name || 'Менеджер'}`
    styleTitleRow(wsSummary, 1, 2)

    wsSummary.mergeCells('A2:B2')
    const subCell = wsSummary.getCell('A2')
    subCell.value = `Период: ${pLabel}  |  Роль: ${isCloser ? 'Клоузер' : 'Лидоруб'}`
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
      const salesPlan = plans.find(p => p.type === 'SALES_AMOUNT')?.value || 0
      const completion = pctOneDecimal(salesAmount, salesPlan)
      const conversion = pctOneDecimal(salesCount, clientsReceived)
      const avgCheck = salesCount > 0 ? Math.round(salesAmount / salesCount) : 0

      const subHdr = wsSummary.addRow(['Показатели продаж', ''])
      styleSubHeader(wsSummary, subHdr.number, 2)

      addSummaryBlock(wsSummary, subHdr.number + 1, [
        { label: 'Продажи (сумма)', value: fmtMoney(salesAmount) },
        { label: 'Кол-во сделок', value: salesCount },
        { label: 'План продаж', value: fmtMoney(salesPlan) },
        { label: 'Выполнение плана', value: `${completion}%` },
        { label: 'Конверсия (клиенты → сделки)', value: `${conversion}%` },
        { label: 'Средний чек', value: fmtMoney(avgCheck) },
        { label: 'Клиентов получено', value: clientsReceived },
        { label: 'Консультаций', value: consultations },
        { label: 'Отказов', value: refusals },
        { label: 'В работе', value: Math.max(0, consultations - salesCount - refusals) },
      ])
    } else {
      const leads = sumLiderLeads(reports)
      const qualifiedLeads = sumField(reports, 'qualifiedLeads')
      const meetingsScheduled = sumField(reports, 'meetingsScheduled')
      const meetingsAttended = sumField(reports, 'meetingsAttended')
      const attendedPlan = plans.find(p => p.type === 'MEETINGS_ATTENDED')?.value || 0
      const leadsplan = plans.find(p => p.type === 'LEADS')?.value || 0
      const completion = pctOneDecimal(meetingsAttended, attendedPlan)

      const subHdr = wsSummary.addRow(['Показатели лидоруба', ''])
      styleSubHeader(wsSummary, subHdr.number, 2)

      addSummaryBlock(wsSummary, subHdr.number + 1, [
        { label: 'Проведено встреч (пришло)', value: meetingsAttended },
        { label: 'План встреч', value: attendedPlan },
        { label: 'Выполнение плана', value: `${completion}%` },
        { label: 'Записано на встречу', value: meetingsScheduled },
        { label: 'Лидов получено', value: leads },
        { label: 'План по лидам', value: leadsplan || '—' },
        { label: 'Квалифицировано', value: qualifiedLeads },
        { label: '% квалификации', value: `${pctOneDecimal(qualifiedLeads, leads)}%` },
      ])
    }

    // ── SHEET 2: Daily reports ───────────────────────────────────────────────
    if (!isCloser) {
      const wsReports = wb.addWorksheet('Отчёты по дням', { properties: { tabColor: { argb: 'FF7C3AED' } } })
      const headers = ['Дата', 'Лидов', 'Квалиф.', 'Записано на встречу', 'Пришло на встречу', 'Комментарий']
      wsReports.columns = [
        { key: 'date', width: 14 },
        { key: 'leads', width: 12 },
        { key: 'qual', width: 12 },
        { key: 'scheduled', width: 20 },
        { key: 'attended', width: 20 },
        { key: 'comment', width: 35 },
      ]

      wsReports.mergeCells(`A1:${String.fromCharCode(64 + headers.length)}1`)
      wsReports.getCell('A1').value = `Ежедневные отчёты — ${pLabel}`
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
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        dataRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
        dataRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
        dataRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
        dataRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
        // Highlight attended > 0
        if (Number(d.meetingsAttended) > 0) {
          dataRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN_LIGHT } }
          dataRow.getCell(5).font = { bold: true, color: { argb: C_GREEN_TEXT }, size: 10, name: 'Calibri' }
        }
      })

      // Totals row
      const totRow = wsReports.addRow([
        'ИТОГО',
        sumLiderLeads(reports),
        sumField(reports, 'qualifiedLeads'),
        sumField(reports, 'meetingsScheduled'),
        sumField(reports, 'meetingsAttended'),
        '',
      ])
      for (let c = 1; c <= headers.length; c++) {
        const cell = totRow.getCell(c)
        cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
      }
      totRow.height = 22
    } else {
      // ── SHEET 2: Sales ──────────────────────────────────────────────────────
      const wsSales = wb.addWorksheet('Продажи', { properties: { tabColor: { argb: 'FF16A34A' } } })
      const saleCols = ['Дата', 'Сумма', 'Тип', 'Способ оплаты', 'Банк', 'Месяцев', 'Комментарий']
      wsSales.columns = [
        { key: 'date', width: 14 },
        { key: 'amount', width: 18 },
        { key: 'type', width: 14 },
        { key: 'method', width: 16 },
        { key: 'bank', width: 18 },
        { key: 'months', width: 10 },
        { key: 'comment', width: 35 },
      ]

      wsSales.mergeCells(`A1:${String.fromCharCode(64 + saleCols.length)}1`)
      wsSales.getCell('A1').value = `Продажи — ${pLabel}`
      styleTitleRow(wsSales, 1, saleCols.length)
      wsSales.addRow([])

      const hRow = wsSales.addRow(saleCols)
      styleHeaderRow(wsSales, hRow.number, saleCols.length)

      const typeLabel: Record<string, string> = { new_sale: 'Новая продажа', additional: 'Доплата' }
      const methodLabel: Record<string, string> = { cash: 'Наличные', card: 'Безналичный', credit: 'Кредит', installment: 'Рассрочка' }

      periodSales.forEach((s, i) => {
        const dataRow = wsSales.addRow([
          fmtDate(s.date),
          s.amount,
          typeLabel[s.paymentType] || s.paymentType,
          methodLabel[s.paymentMethod] || s.paymentMethod,
          s.bank || '',
          s.months || '',
          s.comment || '',
        ])
        styleDataRow(wsSales, dataRow.number, saleCols.length, i % 2 === 0)
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        dataRow.getCell(2).numFmt = '#,##0'
        dataRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
        dataRow.getCell(2).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
        // Color by type
        if (s.paymentType === 'new_sale') {
          dataRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GREEN_LIGHT } }
          dataRow.getCell(3).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_GREEN_TEXT } }
        } else {
          dataRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_AMBER_LIGHT } }
          dataRow.getCell(3).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_AMBER_TEXT } }
        }
      })

      // Totals
      const total = periodSales.reduce((s, x) => s + x.amount, 0)
      const totRow = wsSales.addRow(['ИТОГО', total, '', '', '', '', `${periodSales.length} сделок`])
      for (let c = 1; c <= saleCols.length; c++) {
        const cell = totRow.getCell(c)
        cell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: C_BLUE_DARK } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
        cell.border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
        cell.alignment = { vertical: 'middle' }
      }
      totRow.getCell(2).numFmt = '#,##0'
      totRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
      totRow.height = 24

      // ── SHEET 3: Daily reports (closer) ─────────────────────────────────────
      const wsCloserRep = wb.addWorksheet('Отчёты по дням', { properties: { tabColor: { argb: 'FF7C3AED' } } })
      const closerCols = ['Дата', 'Клиентов', 'Консультаций', 'Отказов', 'Комментарий']
      wsCloserRep.columns = [
        { key: 'date', width: 14 },
        { key: 'clients', width: 14 },
        { key: 'consults', width: 16 },
        { key: 'refusals', width: 14 },
        { key: 'comment', width: 35 },
      ]

      wsCloserRep.mergeCells(`A1:${String.fromCharCode(64 + closerCols.length)}1`)
      wsCloserRep.getCell('A1').value = `Ежедневные отчёты — ${pLabel}`
      styleTitleRow(wsCloserRep, 1, closerCols.length)
      wsCloserRep.addRow([])

      const hRowC = wsCloserRep.addRow(closerCols)
      styleHeaderRow(wsCloserRep, hRowC.number, closerCols.length)

      reports.forEach((r, i) => {
        const d = r.data as any
        const dataRow = wsCloserRep.addRow([
          fmtDate(r.date),
          Number(d.clientsReceived) || 0,
          Number(d.consultations) || 0,
          Number(d.refusals) || 0,
          d.comment || '',
        ])
        styleDataRow(wsCloserRep, dataRow.number, closerCols.length, i % 2 === 0)
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        for (let c = 2; c <= 4; c++) dataRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
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

// ── ROP export (most detailed — 4 sheets) ─────────────────────────────────

router.get('/rop', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const deptId = req.user!.departmentId
  const fromStr = dateToStr(start)
  const toStr = dateToStr(end)
  const pLabel = periodLabel(period as string, from as string, to as string)

  try {
    const [managers, plans, closerReports, liderReports, periodSales] = await Promise.all([
      prisma.user.findMany({ where: { companyId: req.user!.companyId, departmentId: deptId || undefined, status: 'ACTIVE', role: 'MANAGER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'CLOSER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'LIDER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true } } } }),
      prisma.sale.findMany({ where: { companyId: req.user!.companyId, date: { gte: fromStr, lte: toStr } }, include: { user: { select: { id: true, name: true, managerType: true } } }, orderBy: { date: 'asc' } }),
    ])

    // Aggregate
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
    const salesPlan = plans.find(p => p.departmentId === deptId && !p.userId && p.type === 'SALES_AMOUNT')?.value ||
      plans.find(p => !p.departmentId && !p.userId && p.type === 'SALES_AMOUNT')?.value || 0
    const planCompletion = pctOneDecimal(totalSalesAmount, salesPlan)
    const conversion = pctOneDecimal(totalSalesCount, totalClients)
    const avgCheck = totalSalesCount > 0 ? Math.round(totalSalesAmount / totalSalesCount) : 0

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SalesPlatform'
    wb.created = new Date()

    // ── SHEET 1: Сводка ────────────────────────────────────────────────────
    const wsSummary = wb.addWorksheet('Сводка', { properties: { tabColor: { argb: C_BLUE_MID } } })
    wsSummary.columns = [{ key: 'l', width: 32 }, { key: 'v', width: 28 }]

    wsSummary.mergeCells('A1:B1')
    wsSummary.getCell('A1').value = 'Отчёт РОПа — Сводные показатели'
    styleTitleRow(wsSummary, 1, 2)

    wsSummary.mergeCells('A2:B2')
    wsSummary.getCell('A2').value = `Период: ${pLabel}`
    wsSummary.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' }, name: 'Calibri' }
    wsSummary.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' }
    wsSummary.getRow(2).height = 20
    wsSummary.addRow([])

    const salesHdr = wsSummary.addRow(['Продажи', ''])
    styleSubHeader(wsSummary, salesHdr.number, 2)
    let nextRow = addSummaryBlock(wsSummary, salesHdr.number + 1, [
      { label: 'Объём продаж', value: fmtMoney(totalSalesAmount) },
      { label: 'Кол-во сделок', value: totalSalesCount },
      { label: 'План продаж', value: fmtMoney(salesPlan) },
      { label: 'Выполнение плана', value: `${planCompletion}%` },
      { label: 'Конверсия (клиенты → сделки)', value: `${conversion}%` },
      { label: 'Средний чек', value: fmtMoney(avgCheck) },
    ])

    // Color the planCompletion value
    const compCell = wsSummary.getCell(`B${salesHdr.number + 4}`)
    compCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(planCompletion) } }
    compCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: completionTextColor(planCompletion) } }

    wsSummary.addRow([])
    const clientHdr = wsSummary.addRow(['Клиентский поток', ''])
    styleSubHeader(wsSummary, clientHdr.number, 2)
    addSummaryBlock(wsSummary, clientHdr.number + 1, [
      { label: 'Клиентов получено', value: totalClients },
      { label: 'Консультаций', value: totalConsultations },
      { label: 'Отказов', value: totalRefusals },
      { label: 'В работе', value: Math.max(0, totalConsultations - totalSalesCount - totalRefusals) },
    ])

    // Лидоруб funnel
    const totalLiderLeads = Object.values(liderMap).reduce((s, x) => s + x.leads, 0)
    const totalQual = Object.values(liderMap).reduce((s, x) => s + x.qual, 0)
    const totalScheduled = Object.values(liderMap).reduce((s, x) => s + x.scheduled, 0)
    const totalAttended = Object.values(liderMap).reduce((s, x) => s + x.attended, 0)

    wsSummary.addRow([])
    const funnelHdr = wsSummary.addRow(['Воронка лидорубов', ''])
    styleSubHeader(wsSummary, funnelHdr.number, 2)
    addSummaryBlock(wsSummary, funnelHdr.number + 1, [
      { label: 'Лидов получено', value: totalLiderLeads },
      { label: 'Квалифицировано', value: totalQual },
      { label: 'Записано на встречу', value: totalScheduled },
      { label: 'Пришло на встречу', value: totalAttended },
    ])

    // ── SHEET 2: Клоузеры ──────────────────────────────────────────────────
    const wsClosers = wb.addWorksheet('Клоузеры', { properties: { tabColor: { argb: 'FF16A34A' } } })
    const closerCols = ['Менеджер', 'Продажи (₸)', 'Кол-во сделок', 'План (₸)', 'Выполнение %', 'Конверсия %', 'Средний чек (₸)', 'Клиентов', 'Консультаций', 'Отказов', 'В работе']
    wsClosers.columns = [
      { key: 'name', width: 22 },
      { key: 'amount', width: 18 },
      { key: 'count', width: 14 },
      { key: 'plan', width: 16 },
      { key: 'pct', width: 14 },
      { key: 'conv', width: 14 },
      { key: 'avg', width: 16 },
      { key: 'clients', width: 12 },
      { key: 'consults', width: 14 },
      { key: 'refusals', width: 12 },
      { key: 'inWork', width: 12 },
    ]

    wsClosers.mergeCells(`A1:${String.fromCharCode(64 + closerCols.length)}1`)
    wsClosers.getCell('A1').value = `Клоузеры — ${pLabel}`
    styleTitleRow(wsClosers, 1, closerCols.length)
    wsClosers.addRow([])

    const hRowC = wsClosers.addRow(closerCols)
    styleHeaderRow(wsClosers, hRowC.number, closerCols.length)

    const closers = managers.filter(m => m.managerType !== 'LIDER')
      .map(m => {
        const stats = salesByUser[m.id] || { salesCount: 0, salesAmount: 0 }
        const clients = clientsByManager[m.id] || 0
        const consults = consultByManager[m.id] || 0
        const refusals = refusalsByManager[m.id] || 0
        const plan = plans.find(p => p.userId === m.id && p.type === 'SALES_AMOUNT')?.value || 0
        const comp = pctOneDecimal(stats.salesAmount, plan)
        return {
          name: m.name,
          salesAmount: stats.salesAmount,
          salesCount: stats.salesCount,
          plan,
          completion: comp,
          conversion: pctOneDecimal(stats.salesCount, clients),
          avgCheck: stats.salesCount > 0 ? Math.round(stats.salesAmount / stats.salesCount) : 0,
          clients, consults, refusals,
          inWork: Math.max(0, consults - stats.salesCount - refusals),
        }
      })
      .sort((a, b) => b.salesAmount - a.salesAmount)

    closers.forEach((m, i) => {
      const row = wsClosers.addRow([
        m.name, m.salesAmount, m.salesCount, m.plan, `${m.completion}%`,
        `${m.conversion}%`, m.avgCheck, m.clients, m.consults, m.refusals, m.inWork,
      ])
      styleDataRow(wsClosers, row.number, closerCols.length, i % 2 === 0)
      row.getCell(2).numFmt = '#,##0'; row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(4).numFmt = '#,##0'; row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(7).numFmt = '#,##0'; row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(m.completion) } }
      row.getCell(5).font = { bold: true, size: 10, name: 'Calibri', color: { argb: completionTextColor(m.completion) } }
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
      for (let c = 8; c <= 11; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
    })

    // Totals row
    const closerTotalAmount = closers.reduce((s, m) => s + m.salesAmount, 0)
    const closerTotalCount = closers.reduce((s, m) => s + m.salesCount, 0)
    const totRowC = wsClosers.addRow([
      'ИТОГО', closerTotalAmount, closerTotalCount, '', `${pctOneDecimal(closerTotalAmount, salesPlan)}%`,
      `${conversion}%`, closerTotalCount > 0 ? Math.round(closerTotalAmount / closerTotalCount) : 0,
      totalClients, totalConsultations, totalRefusals,
      Math.max(0, totalConsultations - closerTotalCount - totalRefusals),
    ])
    for (let c = 1; c <= closerCols.length; c++) {
      totRowC.getCell(c).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      totRowC.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
      totRowC.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
      totRowC.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
    }
    totRowC.getCell(2).numFmt = '#,##0'; totRowC.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
    totRowC.getCell(7).numFmt = '#,##0'; totRowC.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
    totRowC.height = 24

    // ── SHEET 3: Лидорубы ──────────────────────────────────────────────────
    const wsLiders = wb.addWorksheet('Лидорубы', { properties: { tabColor: { argb: 'FF7C3AED' } } })
    const liderCols = ['Лидоруб', 'Пришло (факт)', 'План встреч', 'Выполнение %', 'Записано', 'Лидов', 'Квалиф.', '% квал.']
    wsLiders.columns = [
      { key: 'name', width: 22 },
      { key: 'attended', width: 14 },
      { key: 'plan', width: 14 },
      { key: 'pct', width: 14 },
      { key: 'scheduled', width: 14 },
      { key: 'leads', width: 12 },
      { key: 'qual', width: 12 },
      { key: 'qualPct', width: 12 },
    ]

    wsLiders.mergeCells(`A1:${String.fromCharCode(64 + liderCols.length)}1`)
    wsLiders.getCell('A1').value = `Лидорубы — ${pLabel}`
    styleTitleRow(wsLiders, 1, liderCols.length)
    wsLiders.addRow([])

    const hRowL = wsLiders.addRow(liderCols)
    styleHeaderRow(wsLiders, hRowL.number, liderCols.length)

    const liderUsers = managers.filter(m => m.managerType === 'LIDER')
    liderUsers
      .map(m => {
        const stats = liderMap[m.id] || { leads: 0, qual: 0, scheduled: 0, attended: 0 }
        const meetingsPlan = plans.find(p => p.userId === m.id && p.type === 'MEETINGS_ATTENDED')?.value || 0
        const comp = pctOneDecimal(stats.attended, meetingsPlan)
        return { name: m.name, attended: stats.attended, plan: meetingsPlan, completion: comp, scheduled: stats.scheduled, leads: stats.leads, qual: stats.qual, qualPct: pctOneDecimal(stats.qual, stats.leads) }
      })
      .sort((a, b) => b.completion - a.completion)
      .forEach((m, i) => {
        const row = wsLiders.addRow([m.name, m.attended, m.plan, `${m.completion}%`, m.scheduled, m.leads, m.qual, `${m.qualPct}%`])
        styleDataRow(wsLiders, row.number, liderCols.length, i % 2 === 0)
        row.getCell(2).font = { bold: true, size: 11, name: 'Calibri', color: { argb: C_BLUE_MID } }
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: completionColor(m.completion) } }
        row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: completionTextColor(m.completion) } }
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
        for (let c = 5; c <= 8; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
      })

    // ── SHEET 4: Все продажи ───────────────────────────────────────────────
    const wsSales = wb.addWorksheet('Все продажи', { properties: { tabColor: { argb: 'FFDC2626' } } })
    const allSaleCols = ['Дата', 'Менеджер', 'Сумма (₸)', 'Тип', 'Способ оплаты', 'Банк', 'Месяцев', 'Комментарий']
    wsSales.columns = [
      { key: 'date', width: 14 },
      { key: 'name', width: 20 },
      { key: 'amount', width: 18 },
      { key: 'type', width: 16 },
      { key: 'method', width: 16 },
      { key: 'bank', width: 18 },
      { key: 'months', width: 10 },
      { key: 'comment', width: 30 },
    ]

    wsSales.mergeCells(`A1:${String.fromCharCode(64 + allSaleCols.length)}1`)
    wsSales.getCell('A1').value = `Все продажи — ${pLabel}`
    styleTitleRow(wsSales, 1, allSaleCols.length)
    wsSales.addRow([])

    const hRowS = wsSales.addRow(allSaleCols)
    styleHeaderRow(wsSales, hRowS.number, allSaleCols.length)

    const typeLabel: Record<string, string> = { new_sale: 'Новая продажа', additional: 'Доплата' }
    const methodLabel: Record<string, string> = { cash: 'Наличные', card: 'Безналичный', credit: 'Кредит', installment: 'Рассрочка' }

    periodSales.forEach((s, i) => {
      const row = wsSales.addRow([
        fmtDate(s.date),
        s.user?.name || '—',
        s.amount,
        typeLabel[s.paymentType] || s.paymentType,
        methodLabel[s.paymentMethod] || s.paymentMethod,
        s.bank || '',
        s.months || '',
        s.comment || '',
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

    const totRowS = wsSales.addRow(['ИТОГО', '', totalSalesAmount, '', '', '', '', `${totalSalesCount} сделок`])
    for (let c = 1; c <= allSaleCols.length; c++) {
      totRowS.getCell(c).font = { bold: true, size: 11, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      totRowS.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
      totRowS.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
      totRowS.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
    }
    totRowS.getCell(3).numFmt = '#,##0'; totRowS.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' }
    totRowS.height = 24

    // ── Send ─────────────────────────────────────────────────────────────────
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
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const userId = req.user!.id
  const deptId = req.user!.departmentId
  const pLabel = periodLabel(period as string, from as string, to as string)

  try {
    const [user, reports, plans] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.report.findMany({ where: { userId, type: 'MARKETER', date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
    ])

    const findPlan = (type: string) =>
      plans.find(p => p.type === type && p.userId === userId)
      ?? plans.find(p => p.type === type && p.departmentId === deptId && !p.userId)
      ?? plans.find(p => p.type === type && !p.userId && !p.departmentId)

    const totalLeads = reports.reduce((s, r) => s + (Number((r.data as any).leadsCount) || Number((r.data as any).leads) || 0), 0)
    const totalQualified = reports.reduce((s, r) => s + (Number((r.data as any).qualifiedLeads) || 0), 0)
    const totalBudget = reports.reduce((s, r) => s + (Number((r.data as any).adBudget) || 0), 0)
    const leadsplan = findPlan('LEADS')?.value || 0
    const budgetPlan = findPlan('BUDGET')?.value || 0
    const planCompletion = pctOneDecimal(totalLeads, leadsplan)
    const leadCost = totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0
    const qualCost = totalQualified > 0 ? Math.round(totalBudget / totalQualified) : 0

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SalesPlatform'
    wb.created = new Date()

    // ── SHEET 1: Сводка ────────────────────────────────────────────────────
    const wsSummary = wb.addWorksheet('Сводка', { properties: { tabColor: { argb: 'FFF59E0B' } } })
    wsSummary.columns = [{ key: 'l', width: 32 }, { key: 'v', width: 28 }]

    wsSummary.mergeCells('A1:B1')
    wsSummary.getCell('A1').value = `Отчёт маркетолога — ${user?.name || ''}`
    styleTitleRow(wsSummary, 1, 2)

    wsSummary.mergeCells('A2:B2')
    wsSummary.getCell('A2').value = `Период: ${pLabel}`
    wsSummary.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' }, name: 'Calibri' }
    wsSummary.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' }
    wsSummary.getRow(2).height = 20
    wsSummary.addRow([])

    const leadsHdr = wsSummary.addRow(['Лиды', ''])
    styleSubHeader(wsSummary, leadsHdr.number, 2)
    addSummaryBlock(wsSummary, leadsHdr.number + 1, [
      { label: 'Лидов получено', value: totalLeads },
      { label: 'План по лидам', value: leadsplan || '—' },
      { label: 'Выполнение плана', value: `${planCompletion}%` },
      { label: 'Квалифицировано', value: totalQualified },
      { label: '% квалификации', value: `${pctOneDecimal(totalQualified, totalLeads)}%` },
    ])

    wsSummary.addRow([])
    const budgetHdr = wsSummary.addRow(['Бюджет', ''])
    styleSubHeader(wsSummary, budgetHdr.number, 2)
    addSummaryBlock(wsSummary, budgetHdr.number + 1, [
      { label: 'Рекламный бюджет (факт)', value: fmtMoney(totalBudget) },
      { label: 'Бюджетный план', value: budgetPlan ? fmtMoney(budgetPlan) : '—' },
      { label: 'Стоимость лида', value: leadCost ? fmtMoney(leadCost) : '—' },
      { label: 'Стоимость квал. лида', value: qualCost ? fmtMoney(qualCost) : '—' },
    ])

    // ── SHEET 2: Данные по дням ─────────────────────────────────────────────
    const wsDaily = wb.addWorksheet('Данные по дням', { properties: { tabColor: { argb: 'FFF59E0B' } } })
    const dailyCols = ['Дата', 'Лидов', 'Квалиф.', 'Рекл. бюджет (₸)', 'Стоим. лида (₸)', 'Комментарий']
    wsDaily.columns = [
      { key: 'date', width: 14 },
      { key: 'leads', width: 12 },
      { key: 'qual', width: 12 },
      { key: 'budget', width: 18 },
      { key: 'cost', width: 16 },
      { key: 'comment', width: 35 },
    ]

    wsDaily.mergeCells(`A1:${String.fromCharCode(64 + dailyCols.length)}1`)
    wsDaily.getCell('A1').value = `Ежедневные данные — ${pLabel}`
    styleTitleRow(wsDaily, 1, dailyCols.length)
    wsDaily.addRow([])

    const hRowD = wsDaily.addRow(dailyCols)
    styleHeaderRow(wsDaily, hRowD.number, dailyCols.length)

    reports.forEach((r, i) => {
      const d = r.data as any
      const leads = Number(d.leadsCount) || Number(d.leads) || 0
      const budget = Number(d.adBudget) || 0
      const cost = leads > 0 ? Math.round(budget / leads) : 0
      const row = wsDaily.addRow([
        fmtDate(r.date), leads, Number(d.qualifiedLeads) || 0, budget, cost, d.comment || '',
      ])
      styleDataRow(wsDaily, row.number, dailyCols.length, i % 2 === 0)
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(4).numFmt = '#,##0'; row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(5).numFmt = '#,##0'; row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
    })

    const totRowD = wsDaily.addRow([
      'ИТОГО', totalLeads, totalQualified, totalBudget, leadCost || '', `${reports.length} дней`,
    ])
    for (let c = 1; c <= dailyCols.length; c++) {
      totRowD.getCell(c).font = { bold: true, size: 10, name: 'Calibri', color: { argb: C_BLUE_DARK } }
      totRowD.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GRAY_HDR } }
      totRowD.getCell(c).border = { top: { style: 'medium', color: { argb: C_BLUE_MID } } }
      totRowD.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
    }
    totRowD.getCell(4).numFmt = '#,##0'; totRowD.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
    totRowD.height = 22

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

export default router
