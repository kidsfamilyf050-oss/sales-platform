import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

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

function sumReportField(reports: any[], field: string) {
  return reports.reduce((acc, r) => acc + (Number((r.data as any)[field]) || 0), 0)
}

// Backward-compat helper for lider "leads received" — old reports saved as 'leads', new as 'leadsReceived'
function sumLiderLeads(reports: any[]) {
  return reports.reduce((acc, r) => {
    const d = r.data as any
    return acc + (Number(d.leadsReceived) || Number(d.leads) || 0)
  }, 0)
}

// Closer reports: sum salesAmount from individual sales[] array if present, else fallback to salesAmount field
function sumCloserSalesAmount(reports: any[]) {
  return reports.reduce((acc, r) => {
    const d = r.data as any
    if (Array.isArray(d.sales) && d.sales.length > 0) {
      return acc + d.sales.reduce((s: number, sale: any) => s + (Number(sale.amount) || 0), 0)
    }
    return acc + (Number(d.salesAmount) || 0)
  }, 0)
}

function sumCloserSalesCount(reports: any[]) {
  return reports.reduce((acc, r) => {
    const d = r.data as any
    if (Array.isArray(d.sales)) return acc + d.sales.length
    return acc + (Number(d.salesCount) || 0)
  }, 0)
}

// Owner dashboard
router.get('/owner', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const fromStr = dateToStr(start)
  const toStr = dateToStr(end)

  try {
    const [salesDepts, allUsers, plans, closerReports, liderReports, marketerReports, periodSales] = await Promise.all([
      prisma.department.findMany({ where: { companyId: req.user!.companyId, type: 'SALES' }, include: { users: { where: { status: 'ACTIVE', role: 'MANAGER' } } } }),
      prisma.user.findMany({ where: { companyId: req.user!.companyId, status: 'ACTIVE', role: 'MANAGER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'CLOSER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true, departmentId: true, managerType: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'LIDER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true, departmentId: true, managerType: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'MARKETER', date: { gte: start, lte: end } } }),
      // Sales from Sale model — truth source
      prisma.sale.findMany({ where: { companyId: req.user!.companyId, date: { gte: fromStr, lte: toStr } }, include: { user: { select: { id: true, name: true } } } }),
    ])

    // ── Sales (Sale model) ─────────────────────────────────────────────────
    const totalSalesAmount   = periodSales.reduce((s, x) => s + x.amount, 0)
    const totalSalesCount    = periodSales.length
    const totalClients       = sumReportField(closerReports, 'clientsReceived')
    const totalConsultations = sumReportField(closerReports, 'consultations')
    const totalRefusals      = sumReportField(closerReports, 'refusals')
    const totalInWork        = Math.max(0, totalConsultations - totalSalesCount - totalRefusals)

    // ── Marketing metrics (MARKETER reports) ──────────────────────────────
    const marketingLeads = marketerReports.reduce((s, r) => s + (Number((r.data as any).leadsCount) || Number((r.data as any).leads) || 0), 0)
    const totalBudget    = marketerReports.reduce((s, r) => s + (Number((r.data as any).adBudget) || Number((r.data as any).budget) || 0), 0)

    // ── Lider funnel (Lead model — live per-lead data) ────────────────────
    const allLiderLeads = await prisma.lead.findMany({
      where: { createdBy: { companyId: req.user!.companyId }, date: { gte: fromStr, lte: toStr } },
      select: { isQualified: true, isScheduled: true, status: true },
    })
    const totalLiderLeads        = allLiderLeads.length
    const totalQualifiedLeads    = allLiderLeads.filter(l => l.isQualified).length
    const totalMeetingsScheduled = allLiderLeads.filter(l => l.isScheduled).length
    const totalMeetingsAttended  = allLiderLeads.filter(l => l.status === 'IN_WORK' || l.status === 'SOLD').length

    // ── Plans ─────────────────────────────────────────────────────────────
    // Sum department-level SALES_AMOUNT plans; fall back to company-wide plan only if no dept plans exist.
    // NEVER mix dept plans and company-wide plan — that causes double-counting.
    const deptSalesPlans = plans.filter(p => p.departmentId && !p.userId && p.type === 'SALES_AMOUNT')
    const salesPlan = deptSalesPlans.length > 0
      ? deptSalesPlans.reduce((s, p) => s + p.value, 0)
      : (plans.find(p => !p.departmentId && !p.userId && p.type === 'SALES_AMOUNT')?.value || 0)
    const leadsplan  = plans.find(p => !p.userId && !p.departmentId && p.type === 'LEADS')?.value  || 0
    const budgetPlan = plans.find(p => !p.userId && !p.departmentId && p.type === 'BUDGET')?.value || 0

    const avgCheck = totalSalesCount > 0 ? totalSalesAmount / totalSalesCount : 0
    // Конверсия: встречи → продажи (основная); если нет встреч — клиенты → продажи
    const conversionBase  = totalMeetingsAttended > 0 ? totalMeetingsAttended : totalClients
    const conversionLabel = totalMeetingsAttended > 0 ? 'встречи → продажи' : 'клиенты → продажи'
    const conversion = conversionBase > 0 ? (totalSalesCount / conversionBase) * 100 : 0
    const effectiveBudget = totalBudget > 0 ? totalBudget : budgetPlan
    const leadCost = marketingLeads > 0 ? effectiveBudget / marketingLeads : 0

    // ── Daily chart from Sale model ────────────────────────────────────────
    const dailySalesMap: Record<string, { sales: number; amount: number }> = {}
    for (const s of periodSales) {
      if (!dailySalesMap[s.date]) dailySalesMap[s.date] = { sales: 0, amount: 0 }
      dailySalesMap[s.date].sales++
      dailySalesMap[s.date].amount += s.amount
    }

    // ── Sales per user (Sale model) ────────────────────────────────────────
    const salesByUser: Record<string, { salesCount: number; salesAmount: number }> = {}
    for (const s of periodSales) {
      if (!salesByUser[s.userId]) salesByUser[s.userId] = { salesCount: 0, salesAmount: 0 }
      salesByUser[s.userId].salesCount++
      salesByUser[s.userId].salesAmount += s.amount
    }
    const clientsByUser: Record<string, number> = {}
    const consultationsByUser: Record<string, number> = {}
    const refusalsByUser: Record<string, number> = {}
    for (const r of closerReports) {
      const uid = r.user.id
      clientsByUser[uid] = (clientsByUser[uid] || 0) + (Number((r.data as any).clientsReceived) || 0)
      consultationsByUser[uid] = (consultationsByUser[uid] || 0) + (Number((r.data as any).consultations) || 0)
      refusalsByUser[uid] = (refusalsByUser[uid] || 0) + (Number((r.data as any).refusals) || 0)
    }

    // ── Manager (closer) rating ────────────────────────────────────────────
    const closerUsers = allUsers.filter(u => u.managerType !== 'LIDER')
    const managerRating = closerUsers
      .map(u => {
        const stats = salesByUser[u.id] || { salesCount: 0, salesAmount: 0 }
        const clients = clientsByUser[u.id] || 0
        const consultations = consultationsByUser[u.id] || 0
        const refusals = refusalsByUser[u.id] || 0
        const inWork = Math.max(0, consultations - stats.salesCount - refusals)
        const plan = plans.find(p => p.userId === u.id && p.type === 'SALES_AMOUNT')?.value || 0
        const completion = plan > 0 ? Math.round((stats.salesAmount / plan) * 1000) / 10 : 0
        const userSales = periodSales.filter(s => s.userId === u.id)
          .map(s => ({ id: s.id, amount: s.amount, paymentType: s.paymentType, paymentMethod: s.paymentMethod, bank: s.bank, months: s.months, crmLink: s.crmLink, comment: s.comment, date: s.date }))
        return {
          id: u.id, name: u.name, type: 'CLOSER', plan,
          salesCount: stats.salesCount, salesAmount: stats.salesAmount, completion,
          consultations, refusals, inWork,
          conversion: consultations > 0 ? Math.round((stats.salesCount / consultations) * 1000) / 10 : 0,
          avgCheck: stats.salesCount > 0 ? Math.round(stats.salesAmount / stats.salesCount) : 0,
          sales: userSales,
        }
      })
      .filter(m => m.salesAmount > 0 || m.plan > 0)
      .sort((a, b) => b.completion - a.completion)

    // ── Lider rating (from Lead model) ────────────────────────────────────
    const ownerLiderLeadsFull = await prisma.lead.findMany({
      where: { createdBy: { companyId: req.user!.companyId, managerType: 'LIDER' }, date: { gte: fromStr, lte: toStr } },
      select: { createdById: true, createdBy: { select: { name: true } }, isQualified: true, isScheduled: true, status: true },
    })
    const ownerLiderStatsMap: Record<string, { name: string; leads: number; qualifiedLeads: number; meetingsScheduled: number; meetingsAttended: number }> = {}
    for (const l of ownerLiderLeadsFull) {
      const uid = l.createdById
      if (!ownerLiderStatsMap[uid]) ownerLiderStatsMap[uid] = { name: l.createdBy.name, leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
      ownerLiderStatsMap[uid].leads++
      if (l.isQualified) ownerLiderStatsMap[uid].qualifiedLeads++
      if (l.isScheduled) ownerLiderStatsMap[uid].meetingsScheduled++
      if (l.status === 'IN_WORK' || l.status === 'SOLD') ownerLiderStatsMap[uid].meetingsAttended++
    }
    const liderRating = Object.entries(ownerLiderStatsMap)
      .map(([id, s]) => {
        const meetingsPlan = plans.find(p => p.userId === id && p.type === 'MEETINGS_ATTENDED')?.value || 0
        const completion = meetingsPlan > 0 ? Math.round((s.meetingsAttended / meetingsPlan) * 1000) / 10 : 0
        return {
          id, name: s.name, type: 'LIDER', meetingsPlan,
          leads: s.leads, qualifiedLeads: s.qualifiedLeads,
          meetingsScheduled: s.meetingsScheduled, meetingsAttended: s.meetingsAttended,
          completion,
          qualRate: s.leads > 0 ? Math.round((s.qualifiedLeads / s.leads) * 1000) / 10 : 0,
          pctScheduled: s.leads > 0 ? Math.round((s.meetingsScheduled / s.leads) * 1000) / 10 : 0,
          pctAttended: s.meetingsScheduled > 0 ? Math.round((s.meetingsAttended / s.meetingsScheduled) * 1000) / 10 : 0,
        }
      })
      .sort((a, b) => b.completion - a.completion || b.meetingsAttended - a.meetingsAttended)

    res.json({
      summary: {
        salesPlan, totalSalesAmount, totalSalesCount, avgCheck: Math.round(avgCheck),
        conversion: Math.round(conversion * 10) / 10,
        conversionLabel,
        planCompletion: salesPlan > 0 ? Math.round((totalSalesAmount / salesPlan) * 1000) / 10 : 0,
        totalConsultations, totalRefusals, totalInWork,
        // Marketing block (from MARKETER reports)
        marketingLeads, leadsplan, totalBudget, budgetPlan, leadCost: Math.round(leadCost),
        // Lider funnel (from LIDER reports)
        totalLiderLeads, totalQualifiedLeads, totalMeetingsScheduled, totalMeetingsAttended,
        totalManagers: allUsers.length,
        bestManager: managerRating[0]?.name || '—',
        worstManager: managerRating[managerRating.length - 1]?.name || '—',
      },
      departments: salesDepts,
      dailyChart: Object.entries(dailySalesMap).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
      managerRating,
      liderRating,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ROP dashboard
router.get('/rop', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const deptId = req.user!.departmentId
  const fromStr = dateToStr(start)
  const toStr = dateToStr(end)
  const todayStr = dateToStr(new Date())

  try {
    const [managers, plans, closerReports, liderReports, marketerReports, todayReports, periodSales, todaySales] = await Promise.all([
      prisma.user.findMany({ where: { companyId: req.user!.companyId, departmentId: deptId || undefined, status: 'ACTIVE', role: 'MANAGER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'CLOSER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true, managerType: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'LIDER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'MARKETER', date: { gte: start, lte: end } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, include: { user: { select: { id: true, name: true } } } }),
      // Period sales from Sale model
      prisma.sale.findMany({ where: { companyId: req.user!.companyId, date: { gte: fromStr, lte: toStr } }, include: { user: { select: { id: true, name: true, managerType: true } } } }),
      // Today's sales per manager
      prisma.sale.findMany({ where: { companyId: req.user!.companyId, date: todayStr }, orderBy: { createdAt: 'asc' } }),
    ])

    const todayReportedIds = new Set(todayReports.map(r => r.userId))

    // Aggregate period sales per user (from Sale model)
    const salesByUser: Record<string, { salesCount: number; salesAmount: number }> = {}
    for (const s of periodSales) {
      if (!salesByUser[s.userId]) salesByUser[s.userId] = { salesCount: 0, salesAmount: 0 }
      salesByUser[s.userId].salesCount++
      salesByUser[s.userId].salesAmount += s.amount
    }

    const totalSalesAmount = periodSales.reduce((s, x) => s + x.amount, 0)
    const totalSalesCount = periodSales.length

    // Clients/consultations from closer reports
    const clientsReceived = sumReportField(closerReports, 'clientsReceived')
    // Lider funnel from Lead model
    const ropLiderLeads = await prisma.lead.findMany({
      where: { createdBy: { companyId: req.user!.companyId, departmentId: deptId || undefined }, date: { gte: fromStr, lte: toStr } },
      select: { isQualified: true, isScheduled: true, status: true },
    })
    const leadsReceived = ropLiderLeads.length
    const qualifiedLeads = ropLiderLeads.filter(l => l.isQualified).length
    const meetingsScheduled = ropLiderLeads.filter(l => l.isScheduled).length
    const meetingsAttended = ropLiderLeads.filter(l => l.status === 'IN_WORK' || l.status === 'SOLD').length

    // Dept plan first; fall back to company-wide (explicitly exclude personal plans with !p.userId)
    const salesPlan = plans.find(p => p.departmentId === deptId && !p.userId && p.type === 'SALES_AMOUNT')?.value ||
      plans.find(p => !p.departmentId && !p.userId && p.type === 'SALES_AMOUNT')?.value || 0

    // Today's report data per manager
    const todayReportByManager: Record<string, any> = {}
    for (const r of todayReports) {
      todayReportByManager[r.userId] = r.data
    }

    // Today's sales per manager (for status dots and "today" detail)
    const todaySalesByManager: Record<string, any[]> = {}
    for (const s of todaySales) {
      if (!todaySalesByManager[s.userId]) todaySalesByManager[s.userId] = []
      todaySalesByManager[s.userId].push(s)
    }

    // Period sales per manager (for expanded view matching selected period)
    const periodSalesByManager: Record<string, any[]> = {}
    for (const s of periodSales) {
      if (!periodSalesByManager[s.userId]) periodSalesByManager[s.userId] = []
      periodSalesByManager[s.userId].push({ id: s.id, amount: s.amount, paymentType: s.paymentType, paymentMethod: s.paymentMethod, bank: s.bank, months: s.months, crmLink: s.crmLink, comment: s.comment, date: s.date })
    }

    // Closer clients/consultations/refusals per manager (from reports)
    const clientsByManager: Record<string, number> = {}
    const consultationsByManager: Record<string, number> = {}
    const refusalsByManager: Record<string, number> = {}
    for (const r of closerReports) {
      const uid = r.user.id
      clientsByManager[uid] = (clientsByManager[uid] || 0) + (Number((r.data as any).clientsReceived) || 0)
      consultationsByManager[uid] = (consultationsByManager[uid] || 0) + (Number((r.data as any).consultations) || 0)
      refusalsByManager[uid] = (refusalsByManager[uid] || 0) + (Number((r.data as any).refusals) || 0)
    }

    const totalConsultations = sumReportField(closerReports, 'consultations')
    const totalRefusals = sumReportField(closerReports, 'refusals')
    const totalInWork = Math.max(0, totalConsultations - totalSalesCount - totalRefusals)

    const closers = managers.filter(m => m.managerType !== 'LIDER')
    const managerRating = closers.map(m => {
      const stats = salesByUser[m.id] || { salesCount: 0, salesAmount: 0 }
      const clients = clientsByManager[m.id] || 0
      const consultations = consultationsByManager[m.id] || 0
      const refusals = refusalsByManager[m.id] || 0
      const inWork = Math.max(0, consultations - stats.salesCount - refusals)
      const managerPlan = plans.find(p => p.userId === m.id && p.type === 'SALES_AMOUNT')?.value || 0
      const completion = managerPlan > 0 ? Math.round((stats.salesAmount / managerPlan) * 1000) / 10 : 0
      const reportedToday = todayReportedIds.has(m.id)
      let status: 'red' | 'yellow' | 'green' = 'green'
      if (!reportedToday) status = 'red'
      else if (completion < 50) status = 'yellow'
      return {
        id: m.id, name: m.name, managerType: m.managerType,
        plan: managerPlan, salesAmount: stats.salesAmount, salesCount: stats.salesCount,
        completion, conversion: consultations > 0 ? Math.round((stats.salesCount / consultations) * 1000) / 10 : 0,
        avgCheck: stats.salesCount > 0 ? Math.round(stats.salesAmount / stats.salesCount) : 0,
        consultations, refusals, inWork,
        status, reportedToday,
        // Period sales for expanded view (matches selected date range)
        sales: periodSalesByManager[m.id] || [],
        // Today's detail for status tracking
        todayReport: todayReportByManager[m.id] || null,
        todaySales: todaySalesByManager[m.id] || [],
        todaySalesTotal: (todaySalesByManager[m.id] || []).reduce((s: number, x: any) => s + x.amount, 0),
      }
    }).sort((a, b) => b.completion - a.completion)

    // Lider rating
    const liderMap: Record<string, any> = {}
    for (const r of liderReports) {
      const uid = r.user.id
      const d = r.data as any
      if (!liderMap[uid]) liderMap[uid] = { leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0, todayData: null }
      liderMap[uid].leads += Number(d.leadsReceived) || Number(d.leads) || 0
      liderMap[uid].qualifiedLeads += Number(d.qualifiedLeads) || 0
      liderMap[uid].meetingsScheduled += Number(d.meetingsScheduled) || 0
      liderMap[uid].meetingsAttended += Number(d.meetingsAttended) || 0
    }

    const liderUsers = managers.filter(m => m.managerType === 'LIDER')
    const liderRating = liderUsers.map(m => {
      const stats = liderMap[m.id] || { leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
      // Primary plan: MEETINGS_ATTENDED (people who actually came to the meeting)
      const meetingsPlan = plans.find(p => p.userId === m.id && p.type === 'MEETINGS_ATTENDED')?.value || 0
      const leadsplan = plans.find(p => p.userId === m.id && p.type === 'LEADS')?.value || 0
      const completion = meetingsPlan > 0 ? Math.round((stats.meetingsAttended / meetingsPlan) * 1000) / 10 : 0
      const reportedToday = todayReportedIds.has(m.id)
      let status: 'red' | 'yellow' | 'green' = 'green'
      if (!reportedToday) status = 'red'
      else if (completion < 50) status = 'yellow'
      return {
        id: m.id, name: m.name,
        meetingsPlan, leadsplan, leads: stats.leads, qualifiedLeads: stats.qualifiedLeads,
        meetingsScheduled: stats.meetingsScheduled, meetingsAttended: stats.meetingsAttended,
        completion,
        qualRate: stats.leads > 0 ? Math.round((stats.qualifiedLeads / stats.leads) * 1000) / 10 : 0,
        pctScheduled: stats.leads > 0 ? Math.round((stats.meetingsScheduled / stats.leads) * 1000) / 10 : 0,
        pctAttended: stats.meetingsScheduled > 0 ? Math.round((stats.meetingsAttended / stats.meetingsScheduled) * 1000) / 10 : 0,
        status, reportedToday,
        todayReport: todayReportByManager[m.id] || null,
      }
    }).sort((a, b) => b.completion - a.completion)

    // Marketing block
    const totalLeads = marketerReports.reduce((s, r) => s + (Number((r.data as any).leads) || Number((r.data as any).leadsCount) || 0), 0)
    const totalBudget = marketerReports.reduce((s, r) => s + (Number((r.data as any).budget) || Number((r.data as any).adBudget) || 0), 0)
    const leadsplan = plans.find(p => !p.userId && !p.departmentId && p.type === 'LEADS')?.value || 0

    res.json({
      summary: {
        salesPlan, salesAmount: totalSalesAmount, salesCount: totalSalesCount,
        conversion: clientsReceived > 0 ? Math.round((totalSalesCount / clientsReceived) * 1000) / 10 : 0,
        avgCheck: totalSalesCount > 0 ? Math.round(totalSalesAmount / totalSalesCount) : 0,
        planCompletion: salesPlan > 0 ? Math.round((totalSalesAmount / salesPlan) * 1000) / 10 : 0,
        totalConsultations, totalRefusals, totalInWork,
      },
      funnel: { leadsReceived, qualifiedLeads, meetingsScheduled, meetingsAttended, salesCount: totalSalesCount },
      marketing: { leadsplan, totalLeads, totalBudget, leadCost: totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0, qualifiedLeads },
      managerRating,
      liderRating,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Helper: YYYY-MM-DD string from Date (local)
function dateToStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Manager dashboard (personal)
router.get('/manager', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const userId = req.user!.id
  const fromStr = dateToStr(start)
  const toStr = dateToStr(end)

  try {
    const [reports, plans, todayReport, periodSales] = await Promise.all([
      prisma.report.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { date: 'desc' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey, userId } }),
      prisma.report.findFirst({ where: { userId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      prisma.sale.findMany({ where: { userId, date: { gte: fromStr, lte: toStr } } }),
    ])

    const isCloser = req.user!.managerType === 'CLOSER'

    if (isCloser) {
      // Sales come from Sale model (live, per-entry)
      const salesAmount = periodSales.reduce((s, x) => s + x.amount, 0)
      const salesCount = periodSales.length
      // Clients received from daily reports
      const clientsReceived = sumReportField(reports, 'clientsReceived')
      const consultations = sumReportField(reports, 'consultations')
      const refusals = sumReportField(reports, 'refusals')
      const inWork = Math.max(0, consultations - salesCount - refusals)
      const salesPlan = plans.find(p => p.type === 'SALES_AMOUNT')?.value || 0
      const conversion = consultations > 0 ? Math.round((salesCount / consultations) * 1000) / 10 : 0

      // Lead-based stats for closer
      const [pendingLeadsCount, inWorkLeadsCount, pendingTasksCount] = await Promise.all([
        prisma.lead.count({ where: { assignedToId: userId, status: 'ASSIGNED' } }),
        prisma.lead.count({ where: { assignedToId: userId, status: 'IN_WORK' } }),
        prisma.leadTask.count({ where: { userId, completed: false } }),
      ])

      res.json({
        type: 'CLOSER',
        summary: {
          salesPlan, salesAmount, salesCount,
          planCompletion: salesPlan > 0 ? Math.round((salesAmount / salesPlan) * 1000) / 10 : 0,
          conversion,
          avgCheck: salesCount > 0 ? Math.round(salesAmount / salesCount) : 0,
          consultations, refusals, inWork,
          pendingLeadsCount, inWorkLeadsCount, pendingTasksCount,
        },
        periodSales: periodSales.map(s => ({
          id: s.id, date: s.date, amount: s.amount,
          paymentType: s.paymentType, paymentMethod: s.paymentMethod,
          bank: s.bank, months: s.months, crmLink: s.crmLink, comment: s.comment,
        })),
        todayReport,
        recentReports: reports.slice(0, 7),
      })
    } else {
      // LIDER — stats come from Lead model (live, per-lead)
      const liderLeads = await prisma.lead.findMany({
        where: { createdById: userId, date: { gte: fromStr, lte: toStr } },
        select: { isQualified: true, isScheduled: true, status: true },
      })

      const leads = liderLeads.length
      const qualifiedLeads = liderLeads.filter(l => l.isQualified).length
      const meetingsScheduled = liderLeads.filter(l => l.isScheduled).length
      // "Attended" = leads that went IN_WORK or SOLD (closer actually started working)
      const meetingsAttended = liderLeads.filter(l => l.status === 'IN_WORK' || l.status === 'SOLD').length

      const meetingsAttendedPlan = plans.find(p => p.type === 'MEETINGS_ATTENDED')?.value || 0
      const leadsplan = plans.find(p => p.type === 'LEADS')?.value || 0
      const schedToAttRate = meetingsScheduled > 0 ? Math.round((meetingsAttended / meetingsScheduled) * 1000) / 10 : 0
      const leadsToSchedRate = leads > 0 ? Math.round((meetingsScheduled / leads) * 1000) / 10 : 0

      // Counts by status for sidebar badges
      const newCount = liderLeads.filter(l => l.status === 'NEW').length
      const assignedCount = liderLeads.filter(l => l.status === 'ASSIGNED').length
      const unqualifiedCount = await prisma.lead.count({ where: { createdById: userId, status: 'UNQUALIFIED' } })

      res.json({
        type: 'LIDER',
        summary: {
          leadsplan, leads,
          meetingsScheduledPlan: meetingsAttendedPlan, meetingsScheduled, meetingsAttended,
          planCompletion: meetingsAttendedPlan > 0 ? Math.round((meetingsAttended / meetingsAttendedPlan) * 1000) / 10 : 0,
          qualifiedLeads,
          qualRate: leads > 0 ? Math.round((qualifiedLeads / leads) * 1000) / 10 : 0,
          schedToAttRate,
          leadsToSchedRate,
          newCount, assignedCount, unqualifiedCount,
        },
        todayReport: null,
        recentReports: [],
      })
    }
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Marketer dashboard
router.get('/marketer', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const userId = req.user!.id
  const deptId = req.user!.departmentId

  try {
    const [reports, plans, todayReport] = await Promise.all([
      prisma.report.findMany({ where: { userId, type: 'MARKETER', date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.report.findFirst({ where: { userId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ])

    // Plan lookup priority: personal → department → company-level (no userId/deptId)
    const findPlan = (type: string) =>
      plans.find(p => p.type === type && p.userId === userId)
      ?? plans.find(p => p.type === type && p.departmentId === deptId && !p.userId)
      ?? plans.find(p => p.type === type && !p.userId && !p.departmentId)

    const totalLeads = sumReportField(reports, 'leadsCount')
    const totalQualified = sumReportField(reports, 'qualifiedLeads')
    const totalBudget = sumReportField(reports, 'adBudget')
    const leadsplan = findPlan('LEADS')?.value || 0
    const budgetPlan = findPlan('BUDGET')?.value || 0
    const daysInPeriod = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
    const daysElapsed = Math.min(reports.length, daysInPeriod)

    const dailyChart = reports.map(r => ({
      date: r.date.toISOString().split('T')[0],
      leads: Number((r.data as any).leadsCount) || 0,
      qualified: Number((r.data as any).qualifiedLeads) || 0,
      budget: Number((r.data as any).adBudget) || 0,
    }))

    const avgLeadsPerDay = daysElapsed > 0 ? totalLeads / daysElapsed : 0
    const projectedLeads = Math.round(avgLeadsPerDay * daysInPeriod)

    res.json({
      summary: {
        leadsplan, totalLeads, totalQualified, totalBudget, budgetPlan,
        leadCost: totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0,
        qualifiedLeadCost: totalQualified > 0 ? Math.round(totalBudget / totalQualified) : 0,
        planCompletion: leadsplan > 0 ? Math.round((totalLeads / leadsplan) * 1000) / 10 : 0,
        avgLeadsPerDay: Math.round(avgLeadsPerDay * 10) / 10,
        projectedLeads,
      },
      dailyChart,
      todayReport,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Lider ranking — uses Lead model as source of truth
router.get('/lider-ranking', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const fromStr = dateToStr(start)
  const toStr = dateToStr(end)

  try {
    const [liders, plans, liderLeads] = await Promise.all([
      prisma.user.findMany({ where: { companyId: req.user!.companyId, status: 'ACTIVE', role: 'MANAGER', managerType: 'LIDER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.lead.findMany({
        where: { createdBy: { companyId: req.user!.companyId, managerType: 'LIDER' }, date: { gte: fromStr, lte: toStr } },
        select: { createdById: true, isQualified: true, isScheduled: true, status: true },
      }),
    ])

    const statsMap: Record<string, { leads: number; qualifiedLeads: number; meetingsScheduled: number; meetingsAttended: number }> = {}
    for (const l of liderLeads) {
      if (!statsMap[l.createdById]) statsMap[l.createdById] = { leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
      statsMap[l.createdById].leads++
      if (l.isQualified) statsMap[l.createdById].qualifiedLeads++
      if (l.isScheduled) statsMap[l.createdById].meetingsScheduled++
      if (l.status === 'IN_WORK' || l.status === 'SOLD') statsMap[l.createdById].meetingsAttended++
    }

    const ranking = liders.map(u => {
      const s = statsMap[u.id] || { leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
      const plan = plans.find(p => p.userId === u.id && p.type === 'MEETINGS_ATTENDED')?.value || 0
      const completion = plan > 0 ? Math.round((s.meetingsAttended / plan) * 1000) / 10 : 0
      const pctAttended = s.meetingsScheduled > 0 ? Math.round((s.meetingsAttended / s.meetingsScheduled) * 1000) / 10 : 0
      return {
        id: u.id,
        name: u.name,
        leads: s.leads,
        qualifiedLeads: s.qualifiedLeads,
        meetingsScheduled: s.meetingsScheduled,
        meetingsAttended: s.meetingsAttended,
        plan,
        completion,
        pctAttended,
      }
    })
    .filter(u => u.plan > 0 || u.leads > 0)
    .sort((a, b) => b.completion - a.completion || b.meetingsAttended - a.meetingsAttended)

    res.json({ ranking, currentUserId: req.user!.id })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Closer ranking — used by personal closer dashboard to show competitive leaderboard
router.get('/closer-ranking', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  // Sale.date is a String field (YYYY-MM-DD) — must use string comparison, not Date objects
  const fromStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const toStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`

  try {
    const [closers, plans, sales] = await Promise.all([
      prisma.user.findMany({ where: { companyId: req.user!.companyId, status: 'ACTIVE', role: 'MANAGER', managerType: 'CLOSER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.sale.findMany({ where: { user: { companyId: req.user!.companyId, managerType: 'CLOSER' }, date: { gte: fromStr, lte: toStr } }, include: { user: { select: { id: true } } } }),
    ])

    const salesMap: Record<string, { salesAmount: number; salesCount: number }> = {}
    for (const s of sales) {
      const uid = s.user.id
      if (!salesMap[uid]) salesMap[uid] = { salesAmount: 0, salesCount: 0 }
      salesMap[uid].salesAmount += Number(s.amount) || 0
      salesMap[uid].salesCount += 1
    }

    const ranking = closers.map(u => {
      const s = salesMap[u.id] || { salesAmount: 0, salesCount: 0 }
      const plan = plans.find(p => p.userId === u.id && p.type === 'SALES_AMOUNT')?.value || 0
      const completion = plan > 0 ? Math.round((s.salesAmount / plan) * 1000) / 10 : 0
      return {
        id: u.id,
        name: u.name,
        salesAmount: s.salesAmount,
        salesCount: s.salesCount,
        plan,
        completion,
      }
    })
    .filter(u => u.plan > 0 || u.salesAmount > 0)
    .sort((a, b) => b.completion - a.completion || b.salesAmount - a.salesAmount)

    res.json({ ranking, currentUserId: req.user!.id })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
