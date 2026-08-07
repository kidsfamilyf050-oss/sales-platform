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

// Build gateway analytics from a list of Sale records
function buildGatewayAnalytics(sales: any[]) {
  const map: Record<string, { method: string; count: number; grossAmount: number; netAmount: number }> = {}
  for (const s of sales) {
    const m = s.paymentMethod || 'unknown'
    if (!map[m]) map[m] = { method: m, count: 0, grossAmount: 0, netAmount: 0 }
    map[m].count++
    map[m].grossAmount += Number(s.amount) || 0
    map[m].netAmount += Number(s.netAmount ?? s.amount) || 0
  }
  const total = sales.length || 1
  return Object.values(map)
    .sort((a, b) => b.count - a.count)
    .map(g => ({ ...g, pct: Math.round((g.count / total) * 1000) / 10 }))
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
  // KZ timezone (UTC+5) boundaries for updatedAt/createdAt comparisons
  const periodStart = new Date(fromStr + 'T00:00:00+05:00')
  const periodEnd   = new Date(toStr   + 'T23:59:59+05:00')

  try {
    const [salesDepts, allUsers, plans, closerReports, liderReports, marketerReports, periodSales] = await Promise.all([
      prisma.department.findMany({ where: { companyId: req.user!.companyId, type: 'SALES' }, include: { users: { where: { status: 'ACTIVE', role: 'MANAGER' } } } }),
      prisma.user.findMany({ where: { companyId: req.user!.companyId, status: 'ACTIVE', role: 'MANAGER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'CLOSER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true, departmentId: true, managerType: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'LIDER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true, departmentId: true, managerType: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'MARKETER', date: { gte: start, lte: end } } }),
      // Sales from Sale model — truth source; OR Sale.createdAt in KZ period (covers wrong-date records)
      prisma.sale.findMany({ where: { companyId: req.user!.companyId, OR: [{ date: { gte: fromStr, lte: toStr } }, { createdAt: { gte: periodStart, lte: periodEnd } }] }, include: { user: { select: { id: true, name: true } }, product: { select: { id: true, name: true } } } }),
    ])

    // ── Sales (Sale model) — use netAmount (бюджет сделки) where available ──
    const totalSalesAmount   = periodSales.reduce((s, x) => s + (x.netAmount ?? x.amount), 0)
    const totalSalesCount    = periodSales.length
    // NOTE: totalConsultations/Refusals/InWork computed below from Lead model (after allLiderLeads query)

    // Carryover: sold in this period from leads created before period start (use createdAt — system timestamp, always reliable)
    const ownerSaleLeadIds = periodSales.map((s: any) => s.leadId).filter(Boolean) as string[]
    const ownerCarryoverLeadSet = ownerSaleLeadIds.length > 0
      ? await prisma.lead.findMany({ where: { id: { in: ownerSaleLeadIds }, createdAt: { lt: start } }, select: { id: true } })
          .then(ls => new Set(ls.map(l => l.id)))
      : new Set<string>()
    const ownerCarryoverSales = periodSales.filter((s: any) => s.leadId && ownerCarryoverLeadSet.has(s.leadId))
    const ownerCarryoverCount = ownerCarryoverSales.length
    const ownerCarryoverRevenue = ownerCarryoverSales.reduce((sum: number, x: any) => sum + (x.netAmount ?? x.amount), 0)
    // Per-manager carryover map (for manager rating table)
    const ownerCarryoverByUser: Record<string, { count: number; revenue: number }> = {}
    for (const s of ownerCarryoverSales) {
      if (!ownerCarryoverByUser[s.userId]) ownerCarryoverByUser[s.userId] = { count: 0, revenue: 0 }
      ownerCarryoverByUser[s.userId].count++
      ownerCarryoverByUser[s.userId].revenue += s.netAmount ?? s.amount
    }

    // ── Marketing metrics — budget from MARKETER reports; leads from Lead model ──
    const totalBudget    = marketerReports.reduce((s, r) => s + (Number((r.data as any).adBudget) || Number((r.data as any).budget) || 0), 0)

    // ── Lider funnel (Lead model — live per-lead data) ────────────────────
    const [allLiderLeads, companyRefundedLeads] = await Promise.all([
      prisma.lead.findMany({
        where: { createdBy: { companyId: req.user!.companyId }, date: { gte: fromStr, lte: toStr } },
        select: { isQualified: true, assignedToId: true, status: true, consultationStatus: true, amount: true, netAmount: true },
      }),
      prisma.lead.findMany({
        where: { createdBy: { companyId: req.user!.companyId }, status: 'SOLD', isRefund: true, date: { gte: fromStr, lte: toStr } },
        select: { netAmount: true, amount: true, assignedToId: true },
      }),
    ])

    const totalRefundCount  = companyRefundedLeads.length
    const totalRefundAmount = companyRefundedLeads.reduce((s, l) => s + (l.amount ?? l.netAmount ?? 0), 0)
    const totalNetSales     = totalSalesAmount - totalRefundAmount

    // Per-manager refunds map (for net amounts in manager table)
    const ownerRefundsByUser: Record<string, { count: number; amount: number }> = {}
    for (const l of companyRefundedLeads) {
      if (l.assignedToId) {
        if (!ownerRefundsByUser[l.assignedToId]) ownerRefundsByUser[l.assignedToId] = { count: 0, amount: 0 }
        ownerRefundsByUser[l.assignedToId].count++
        ownerRefundsByUser[l.assignedToId].amount += l.amount ?? l.netAmount ?? 0
      }
    }
    const totalLiderLeads        = allLiderLeads.length
    const totalQualifiedLeads    = allLiderLeads.filter(l => l.isQualified).length
    const totalMeetingsScheduled = allLiderLeads.filter(l => l.assignedToId != null).length // "Передано клоузеру"
    const totalMeetingsAttended  = allLiderLeads.filter(l => l.consultationStatus === 'happened' || l.status === 'SOLD').length // "Консультация состоялась"
    // Lead model is source of truth for consultations/refusals/inWork
    const totalConsultations = allLiderLeads.filter(l => l.consultationStatus === 'happened' || l.status === 'SOLD').length
    const totalRefusals      = allLiderLeads.filter(l => l.status === 'REFUSED' && l.consultationStatus !== 'not_happened').length
    const totalRefusalsAmount = allLiderLeads.filter(l => l.status === 'REFUSED' && l.consultationStatus !== 'not_happened').reduce((s, l) => s + (l.netAmount ?? l.amount ?? 0), 0)
    const totalInWork        = allLiderLeads.filter(l => l.status === 'IN_WORK').length

    // ── Plans ─────────────────────────────────────────────────────────────
    // Sum department-level SALES_AMOUNT plans; fall back to company-wide plan only if no dept plans exist.
    // NEVER mix dept plans and company-wide plan — that causes double-counting.
    const deptSalesPlans = plans.filter(p => p.departmentId && !p.userId && p.type === 'SALES_AMOUNT')
    const salesPlan = deptSalesPlans.length > 0
      ? deptSalesPlans.reduce((s, p) => s + p.value, 0)
      : (plans.find(p => !p.departmentId && !p.userId && p.type === 'SALES_AMOUNT')?.value || 0)
    const leadsplan  = plans.find(p => !p.userId && !p.departmentId && p.type === 'LEADS')?.value  || 0
    const budgetPlan = plans.find(p => !p.userId && !p.departmentId && p.type === 'BUDGET')?.value || 0

    const netSalesCountOwner = Math.max(0, totalSalesCount - totalRefundCount)
    const avgCheck = netSalesCountOwner > 0 ? totalNetSales / netSalesCountOwner : 0
    const effectiveBudget = totalBudget > 0 ? totalBudget : budgetPlan
    const leadCost = totalLiderLeads > 0 ? effectiveBudget / totalLiderLeads : 0

    // ── Daily chart from Sale model ────────────────────────────────────────
    const dailySalesMap: Record<string, { sales: number; amount: number }> = {}
    for (const s of periodSales) {
      if (!dailySalesMap[s.date]) dailySalesMap[s.date] = { sales: 0, amount: 0 }
      dailySalesMap[s.date].sales++
      dailySalesMap[s.date].amount += s.netAmount ?? s.amount
    }

    // ── Sales per user (Sale model) — use netAmount where available ─────────
    const salesByUser: Record<string, { salesCount: number; salesAmount: number }> = {}
    for (const s of periodSales) {
      if (!salesByUser[s.userId]) salesByUser[s.userId] = { salesCount: 0, salesAmount: 0 }
      salesByUser[s.userId].salesCount++
      salesByUser[s.userId].salesAmount += s.netAmount ?? s.amount
    }
    // clientsByUser, consultationsByUser, refusalsByUser — from Lead model (consistent with ROP)
    const clientsByUser: Record<string, number> = {}
    const consultationsByUser: Record<string, number> = {}
    const refusalsByUser: Record<string, number> = {}
    for (const l of allLiderLeads) {
      if (!l.assignedToId) continue
      const uid = l.assignedToId
      clientsByUser[uid] = (clientsByUser[uid] || 0) + 1 // transferred = client received
      if (l.consultationStatus === 'happened' || l.status === 'SOLD') {
        consultationsByUser[uid] = (consultationsByUser[uid] || 0) + 1
      }
      if (l.status === 'REFUSED' && l.consultationStatus !== 'not_happened') {
        refusalsByUser[uid] = (refusalsByUser[uid] || 0) + 1
      }
    }

    // ── Manager (closer) rating ────────────────────────────────────────────
    const closerUsers = allUsers.filter(u => u.managerType !== 'LIDER')
    const managerRating = closerUsers
      .map(u => {
        const stats = salesByUser[u.id] || { salesCount: 0, salesAmount: 0 }
        const userRefunds = ownerRefundsByUser[u.id] || { count: 0, amount: 0 }
        const netSalesAmount = stats.salesAmount - userRefunds.amount
        const netSalesCount = Math.max(0, stats.salesCount - userRefunds.count)
        const clients = clientsByUser[u.id] || 0
        const consultations = consultationsByUser[u.id] || 0
        const refusals = refusalsByUser[u.id] || 0
        const inWork = Math.max(0, consultations - stats.salesCount - refusals)
        const plan = plans.find(p => p.userId === u.id && p.type === 'SALES_AMOUNT')?.value || 0
        const completion = plan > 0 ? Math.round((netSalesAmount / plan) * 1000) / 10 : 0
        let status: 'red' | 'yellow' | 'green' = 'green'
        if (completion === 0) status = 'red'
        else if (completion < 75) status = 'yellow'
        const userSales = periodSales.filter(s => s.userId === u.id)
          .map(s => ({ id: s.id, amount: s.amount, netAmount: s.netAmount, paymentType: s.paymentType, paymentMethod: s.paymentMethod, bank: s.bank, months: s.months, crmLink: s.crmLink, comment: s.comment, date: s.date, productName: s.product?.name || null }))
        return {
          id: u.id, name: u.name, type: 'CLOSER', plan,
          salesCount: netSalesCount, salesAmount: netSalesAmount, completion,
          consultations, refusals, inWork,
          conversion: consultations > 0 ? Math.round((stats.salesCount / consultations) * 1000) / 10 : 0,
          avgCheck: netSalesCount > 0 ? Math.round(netSalesAmount / netSalesCount) : 0,
          sales: userSales, status,
          carryover: ownerCarryoverByUser[u.id] || { count: 0, revenue: 0 },
        }
      })
      .sort((a, b) => b.completion - a.completion || b.salesAmount - a.salesAmount)

    // ── Lider rating (from Lead model) ────────────────────────────────────
    const ownerLiderLeadsFull = await prisma.lead.findMany({
      where: { createdBy: { companyId: req.user!.companyId, managerType: 'LIDER' }, date: { gte: fromStr, lte: toStr } },
      select: { createdById: true, createdBy: { select: { name: true } }, isQualified: true, assignedToId: true, status: true, consultationStatus: true },
    })
    const ownerLiderStatsMap: Record<string, { name: string; leads: number; qualifiedLeads: number; meetingsScheduled: number; meetingsAttended: number }> = {}
    for (const l of ownerLiderLeadsFull) {
      const uid = l.createdById
      if (!ownerLiderStatsMap[uid]) ownerLiderStatsMap[uid] = { name: l.createdBy.name, leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
      ownerLiderStatsMap[uid].leads++
      if (l.isQualified) ownerLiderStatsMap[uid].qualifiedLeads++
      if (l.assignedToId) ownerLiderStatsMap[uid].meetingsScheduled++  // "Передано"
      if (l.consultationStatus === 'happened') ownerLiderStatsMap[uid].meetingsAttended++ // "Консультация состоялась"
    }
    // Include ALL lider users, even those with zero leads in period
    const allLiderUsers = allUsers.filter(u => u.managerType === 'LIDER')
    const liderRating = allLiderUsers
      .map(u => {
        const s = ownerLiderStatsMap[u.id] || { leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
        const meetingsPlan = plans.find(p => p.userId === u.id && p.type === 'MEETINGS_ATTENDED')?.value || 0
        const leadsplan = plans.find(p => p.userId === u.id && p.type === 'LEADS')?.value || 0
        const completion = meetingsPlan > 0 ? Math.round((s.meetingsAttended / meetingsPlan) * 1000) / 10 : 0
        let status: 'red' | 'yellow' | 'green' = 'green'
        if (s.leads === 0) status = 'red'
        else if (completion < 75) status = 'yellow'
        return {
          id: u.id, name: u.name, type: 'LIDER', meetingsPlan, leadsplan,
          leads: s.leads, qualifiedLeads: s.qualifiedLeads,
          meetingsScheduled: s.meetingsScheduled, meetingsAttended: s.meetingsAttended,
          completion,
          qualRate: s.leads > 0 ? Math.round((s.qualifiedLeads / s.leads) * 1000) / 10 : 0,
          pctScheduled: s.leads > 0 ? Math.round((s.meetingsScheduled / s.leads) * 1000) / 10 : 0,
          pctAttended: s.meetingsScheduled > 0 ? Math.round((s.meetingsAttended / s.meetingsScheduled) * 1000) / 10 : 0,
          status,
        }
      })
      .sort((a, b) => b.completion - a.completion || b.meetingsAttended - a.meetingsAttended)

    // ── Product stats (from Sale model) ───────────────────────────────────────
    const productStatsMap: Record<string, { productId: string; productName: string; count: number; totalAmount: number }> = {}
    for (const s of periodSales) {
      if (s.productId && s.product) {
        if (!productStatsMap[s.productId]) {
          productStatsMap[s.productId] = { productId: s.productId, productName: s.product.name, count: 0, totalAmount: 0 }
        }
        productStatsMap[s.productId].count++
        productStatsMap[s.productId].totalAmount += s.netAmount ?? s.amount
      }
    }
    const productStats = Object.values(productStatsMap).sort((a, b) => b.totalAmount - a.totalAmount)

    // Fact = total sales minus dojim (carryover) — leads created THIS period
    const factSalesAmount = totalSalesAmount - ownerCarryoverRevenue
    const factSalesCount  = Math.max(0, totalSalesCount - ownerCarryoverCount)
    const factNetSales    = factSalesAmount - totalRefundAmount
    const factAvgCheck    = factSalesCount > 0 ? Math.round(factNetSales / factSalesCount) : 0
    const dojimAvgCheck   = ownerCarryoverCount > 0 ? Math.round(ownerCarryoverRevenue / ownerCarryoverCount) : 0
    // conversion uses factSalesCount — dojim sales don't count as conversions
    const conversion = totalConsultations > 0 ? Math.round((factSalesCount / totalConsultations) * 100) : 0
    const conversionLabel = 'встречи → продажи'

    res.json({
      summary: {
        salesPlan, totalSalesAmount, totalSalesCount: netSalesCountOwner, totalSalesCountGross: totalSalesCount,
        avgCheck: Math.round(avgCheck), factAvgCheck,
        totalRefundCount, totalRefundAmount, totalNetSales,
        // Fact = new-period leads sold this period (excludes dojim carryover)
        factSalesAmount, factSalesCount, factNetSales,
        conversion,
        conversionLabel,
        planCompletion: salesPlan > 0 ? Math.round((totalNetSales / salesPlan) * 1000) / 10 : 0,
        totalConsultations, totalRefusals, totalRefusalsAmount, totalInWork,
        // Marketing block — leads from Lead model, budget from MARKETER reports
        marketingLeads: totalLiderLeads, leadsplan, totalBudget, budgetPlan, leadCost: Math.round(leadCost),
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
      productStats,
      gatewayAnalytics: buildGatewayAnalytics(periodSales),
      carryover: { count: ownerCarryoverCount, revenue: ownerCarryoverRevenue, avgCheck: dojimAvgCheck },
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
  // KZ timezone (UTC+5) boundaries for updatedAt/createdAt comparisons
  const periodStart = new Date(fromStr + 'T00:00:00+05:00')
  const periodEnd   = new Date(toStr   + 'T23:59:59+05:00')
  const todayStart  = new Date(todayStr + 'T00:00:00+05:00')
  const todayEnd    = new Date(todayStr + 'T23:59:59+05:00')

  try {
    const [managers, plans, closerReports, marketerReports, todayReports, periodSales, todaySales, ropLiderLeadsFull, allCompanyLeads, closerLeads] = await Promise.all([
      prisma.user.findMany({ where: { companyId: req.user!.companyId, departmentId: deptId || undefined, status: 'ACTIVE', role: 'MANAGER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'CLOSER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true, managerType: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'MARKETER', date: { gte: start, lte: end } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, include: { user: { select: { id: true, name: true } } } }),
      // Period sales — Sale.date OR Sale.createdAt in KZ period (covers wrong-date records)
      prisma.sale.findMany({ where: { companyId: req.user!.companyId, OR: [{ date: { gte: fromStr, lte: toStr } }, { createdAt: { gte: periodStart, lte: periodEnd } }] }, include: { user: { select: { id: true, name: true, managerType: true } }, product: { select: { id: true, name: true } } }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] }),
      // Today's sales — Sale.date OR Sale.createdAt today in KZ
      prisma.sale.findMany({ where: { companyId: req.user!.companyId, OR: [{ date: todayStr }, { createdAt: { gte: todayStart, lte: todayEnd } }] }, orderBy: { createdAt: 'asc' } }),
      // Lider leads from Lead model (source of truth for lider stats)
      prisma.lead.findMany({
        where: { createdBy: { companyId: req.user!.companyId, departmentId: deptId || undefined, managerType: 'LIDER' }, date: { gte: fromStr, lte: toStr } },
        select: { createdById: true, isQualified: true, isScheduled: true, status: true, assignedToId: true, consultationStatus: true },
      }),
      // All company leads for consultation/refusal/inWork stats (Lead model = source of truth)
      prisma.lead.findMany({
        where: { createdBy: { companyId: req.user!.companyId }, date: { gte: fromStr, lte: toStr } },
        select: { status: true, consultationStatus: true, amount: true, netAmount: true },
      }),
      // Closer-assigned leads for per-manager metrics (Lead model = source of truth)
      prisma.lead.findMany({
        where: { assignedTo: { companyId: req.user!.companyId }, date: { gte: fromStr, lte: toStr } },
        select: { assignedToId: true, status: true, consultationStatus: true },
      }),
    ])

    const todayReportedIds = new Set(todayReports.map(r => r.userId))

    // Aggregate period sales per user (from Sale model)
    const salesByUser: Record<string, { salesCount: number; salesAmount: number }> = {}
    for (const s of periodSales) {
      if (!salesByUser[s.userId]) salesByUser[s.userId] = { salesCount: 0, salesAmount: 0 }
      salesByUser[s.userId].salesCount++
      salesByUser[s.userId].salesAmount += s.netAmount ?? s.amount
    }

    const totalSalesAmount = periodSales.reduce((s, x) => s + (x.netAmount ?? x.amount), 0)
    const totalSalesCount = periodSales.length

    // Carryover: sold in this period from leads created before period start (use createdAt — system timestamp, always reliable)
    const ropSaleLeadIds = periodSales.map((s: any) => s.leadId).filter(Boolean) as string[]
    const ropCarryoverLeadSet = ropSaleLeadIds.length > 0
      ? await prisma.lead.findMany({ where: { id: { in: ropSaleLeadIds }, createdAt: { lt: start } }, select: { id: true } })
          .then(ls => new Set(ls.map(l => l.id)))
      : new Set<string>()
    const ropCarryoverSales = periodSales.filter((s: any) => s.leadId && ropCarryoverLeadSet.has(s.leadId))
    const ropCarryoverCount = ropCarryoverSales.length
    const ropCarryoverRevenue = ropCarryoverSales.reduce((sum: number, x: any) => sum + (x.netAmount ?? x.amount), 0)
    // Per-manager carryover map (for manager rating table)
    const ropCarryoverByUser: Record<string, { count: number; revenue: number }> = {}
    for (const s of ropCarryoverSales) {
      if (!ropCarryoverByUser[s.userId]) ropCarryoverByUser[s.userId] = { count: 0, revenue: 0 }
      ropCarryoverByUser[s.userId].count++
      ropCarryoverByUser[s.userId].revenue += s.netAmount ?? s.amount
    }

    // Refunds from Lead model — include full detail for ROP drill-down
    const ropRefundedLeads = await prisma.lead.findMany({
      where: { createdBy: { companyId: req.user!.companyId }, status: 'SOLD', isRefund: true, date: { gte: fromStr, lte: toStr } },
      include: {
        assignedTo: { select: { id: true, name: true } },
        salesChannel: { select: { id: true, name: true } },
      },
      orderBy: { refundedAt: 'desc' },
    })
    const ropRefundCount  = ropRefundedLeads.length
    const ropRefundTotal  = ropRefundedLeads.reduce((s, l) => s + (l.amount ?? l.netAmount ?? 0), 0)
    const ropNetSales     = totalSalesAmount - ropRefundTotal
    const ropRefundedLeadIds = new Set(ropRefundedLeads.map(l => l.id))

    // Clients/consultations from closer reports
    const clientsReceived = sumReportField(closerReports, 'clientsReceived')
    // Lider funnel from Lead model (ropLiderLeadsFull fetched above)
    const leadsReceived = ropLiderLeadsFull.length
    const qualifiedLeads = ropLiderLeadsFull.filter(l => l.isQualified).length
    // "Передано клоузеру" = leads assigned to a closer (any status past NEW/UNQUALIFIED)
    const meetingsScheduled = ropLiderLeadsFull.filter(l => l.assignedToId != null).length
    // "Консультация состоялась" = consultationStatus = happened OR lead already sold (safety net)
    const meetingsAttended = ropLiderLeadsFull.filter(l => l.consultationStatus === 'happened' || l.status === 'SOLD').length

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
      periodSalesByManager[s.userId].push({ id: s.id, amount: s.amount, netAmount: s.netAmount, paymentType: s.paymentType, paymentMethod: s.paymentMethod, bank: s.bank, months: s.months, crmLink: s.crmLink, comment: s.comment, date: s.date, productName: s.product?.name || null, leadId: s.leadId ?? null, isRefund: !!(s.leadId && ropRefundedLeadIds.has(s.leadId)) })
    }

    // Per-manager metrics from Lead model (source of truth — no manual reports needed)
    const consultationsByManager: Record<string, number> = {}
    const refusalsByManager: Record<string, number> = {}
    const inWorkByManager: Record<string, number> = {}
    for (const l of closerLeads) {
      if (!l.assignedToId) continue
      if (l.consultationStatus === 'happened' || l.status === 'SOLD')
        consultationsByManager[l.assignedToId] = (consultationsByManager[l.assignedToId] || 0) + 1
      if (l.status === 'REFUSED' && l.consultationStatus !== 'not_happened')
        refusalsByManager[l.assignedToId] = (refusalsByManager[l.assignedToId] || 0) + 1
      if (l.status === 'IN_WORK')
        inWorkByManager[l.assignedToId] = (inWorkByManager[l.assignedToId] || 0) + 1
    }

    // Company-level totals from Lead model
    // totalConsultations uses same source+filter as funnel.meetingsAttended so both cards show identical numbers
    const totalConsultations = meetingsAttended
    const totalRefusals = allCompanyLeads.filter(l => l.status === 'REFUSED' && (l as any).consultationStatus !== 'not_happened').length
    const totalRefusalsAmount = allCompanyLeads.filter(l => l.status === 'REFUSED' && (l as any).consultationStatus !== 'not_happened').reduce((s, l) => s + ((l as any).netAmount ?? (l as any).amount ?? 0), 0)
    const totalInWork = allCompanyLeads.filter(l => l.status === 'IN_WORK').length

    // Per-manager refunds map for ROP (using ropRefundedLeads fetched above)
    const ropRefundsByUser: Record<string, { count: number; amount: number }> = {}
    for (const l of ropRefundedLeads) {
      const uid = l.assignedTo?.id
      if (uid) {
        if (!ropRefundsByUser[uid]) ropRefundsByUser[uid] = { count: 0, amount: 0 }
        ropRefundsByUser[uid].count++
        ropRefundsByUser[uid].amount += l.amount ?? l.netAmount ?? 0
      }
    }

    const closers = managers.filter(m => m.managerType !== 'LIDER')
    const managerRating = closers.map(m => {
      const stats = salesByUser[m.id] || { salesCount: 0, salesAmount: 0 }
      const userRopRefunds = ropRefundsByUser[m.id] || { count: 0, amount: 0 }
      const mgrNetAmount = stats.salesAmount - userRopRefunds.amount
      const mgrNetCount = Math.max(0, stats.salesCount - userRopRefunds.count)
      const consultations = consultationsByManager[m.id] || 0
      const refusals = refusalsByManager[m.id] || 0
      const inWork = inWorkByManager[m.id] || 0
      const managerPlan = plans.find(p => p.userId === m.id && p.type === 'SALES_AMOUNT')?.value || 0
      const completion = managerPlan > 0 ? Math.round((mgrNetAmount / managerPlan) * 1000) / 10 : 0
      const reportedToday = todayReportedIds.has(m.id)
      let status: 'red' | 'yellow' | 'green' = 'green'
      if (completion === 0) status = 'red'
      else if (completion < 75) status = 'yellow'
      return {
        id: m.id, name: m.name, managerType: m.managerType,
        plan: managerPlan, salesAmount: mgrNetAmount, salesCount: mgrNetCount,
        completion, conversion: consultations > 0 ? Math.round((stats.salesCount / consultations) * 1000) / 10 : 0,
        avgCheck: mgrNetCount > 0 ? Math.round(mgrNetAmount / mgrNetCount) : 0,
        consultations, refusals, inWork,
        status, reportedToday,
        carryover: ropCarryoverByUser[m.id] || { count: 0, revenue: 0 },
        // Period sales for expanded view (matches selected date range)
        sales: periodSalesByManager[m.id] || [],
        // Today's detail for status tracking
        todayReport: todayReportByManager[m.id] || null,
        todaySales: todaySalesByManager[m.id] || [],
        todaySalesTotal: (todaySalesByManager[m.id] || []).reduce((s: number, x: any) => s + (x.netAmount ?? x.amount), 0),
      }
    }).sort((a, b) => b.completion - a.completion)

    // Lider rating — from Lead model (source of truth)
    const liderLeadStatsMap: Record<string, { leads: number; qualified: number; transmitted: number; inWork: number }> = {}
    for (const l of ropLiderLeadsFull) {
      const uid = l.createdById
      if (!liderLeadStatsMap[uid]) liderLeadStatsMap[uid] = { leads: 0, qualified: 0, transmitted: 0, inWork: 0 }
      liderLeadStatsMap[uid].leads++
      if (l.isQualified) liderLeadStatsMap[uid].qualified++
      if (l.assignedToId) liderLeadStatsMap[uid].transmitted++  // passed to a closer
      if (l.consultationStatus === 'happened') liderLeadStatsMap[uid].inWork++ // "Консультация состоялась"
    }

    const liderUsers = managers.filter(m => m.managerType === 'LIDER')
    const liderRating = liderUsers.map(m => {
      const s = liderLeadStatsMap[m.id] || { leads: 0, qualified: 0, transmitted: 0, inWork: 0 }
      const meetingsPlan = plans.find(p => p.userId === m.id && p.type === 'MEETINGS_ATTENDED')?.value || 0
      const leadsplan = plans.find(p => p.userId === m.id && p.type === 'LEADS')?.value || 0
      // Completion = transmitted vs plan (передано клоузеру)
      const completion = meetingsPlan > 0 ? Math.round((s.transmitted / meetingsPlan) * 1000) / 10 : 0
      const reportedToday = todayReportedIds.has(m.id)  // kept for expanded view
      let status: 'red' | 'yellow' | 'green' = 'green'
      if (s.leads === 0) status = 'red'
      else if (completion < 75) status = 'yellow'
      return {
        id: m.id, name: m.name,
        meetingsPlan, leadsplan,
        leads: s.leads, qualifiedLeads: s.qualified,
        meetingsScheduled: s.transmitted,  // "Передано"
        meetingsAttended: s.inWork,         // "В работе"
        completion,
        qualRate: s.leads > 0 ? Math.round((s.qualified / s.leads) * 1000) / 10 : 0,
        pctScheduled: s.leads > 0 ? Math.round((s.transmitted / s.leads) * 1000) / 10 : 0,
        pctAttended: s.transmitted > 0 ? Math.round((s.inWork / s.transmitted) * 1000) / 10 : 0,
        status, reportedToday,
        todayReport: null,  // liders no longer fill daily reports
      }
    }).sort((a, b) => b.completion - a.completion)

    // Marketing block — leads from Lead model (source of truth), budget from channelBudgets + marketer reports
    const totalLeads = leadsReceived // from ropLiderLeadsFull (Lead model)
    const channelBudgetsForROP = await prisma.channelBudget.findMany({
      where: { companyId: req.user!.companyId, date: { gte: fromStr, lte: toStr } },
      select: { spend: true },
    })
    const channelBudgetTotal = channelBudgetsForROP.reduce((s, b) => s + b.spend, 0)
    const reportBudgetTotal  = marketerReports.reduce((s, r) => s + (Number((r.data as any).budget) || Number((r.data as any).adBudget) || 0), 0)
    const totalBudget = channelBudgetTotal > 0 ? channelBudgetTotal : reportBudgetTotal
    const leadsplan = plans.find(p => !p.userId && !p.departmentId && p.type === 'LEADS')?.value || 0

    // ── Product stats (from Sale model) ────────────────────────────────────────
    const ropProductStatsMap: Record<string, { productId: string; productName: string; count: number; totalAmount: number }> = {}
    for (const s of periodSales) {
      if (s.productId && s.product) {
        if (!ropProductStatsMap[s.productId]) {
          ropProductStatsMap[s.productId] = { productId: s.productId, productName: s.product.name, count: 0, totalAmount: 0 }
        }
        ropProductStatsMap[s.productId].count++
        ropProductStatsMap[s.productId].totalAmount += s.amount
      }
    }
    const productStats = Object.values(ropProductStatsMap).sort((a, b) => b.totalAmount - a.totalAmount)

    // Fact = total sales minus dojim (carryover) — leads created THIS period
    const ropFactSalesAmount = totalSalesAmount - ropCarryoverRevenue
    const ropFactSalesCount  = Math.max(0, totalSalesCount - ropCarryoverCount - ropRefundCount)
    const ropFactNetSales    = ropFactSalesAmount - ropRefundTotal
    const ropFactAvgCheck    = ropFactSalesCount > 0 ? Math.round(ropFactNetSales / ropFactSalesCount) : 0
    const ropDojimAvgCheck   = ropCarryoverCount > 0 ? Math.round(ropCarryoverRevenue / ropCarryoverCount) : 0

    res.json({
      summary: {
        salesPlan, salesAmount: totalSalesAmount,
        salesCount: Math.max(0, totalSalesCount - ropRefundCount),
        salesCountGross: totalSalesCount,
        refundCount: ropRefundCount, refundTotal: ropRefundTotal, netSalesAmount: ropNetSales,
        // Fact = new-period leads sold this period (excludes dojim carryover)
        factSalesAmount: ropFactSalesAmount, factSalesCount: ropFactSalesCount, factNetSales: ropFactNetSales,
        // conversion uses factSalesCount — dojim sales don't count as conversions
        conversion: totalConsultations > 0 ? Math.round((ropFactSalesCount / totalConsultations) * 100) : 0,
        avgCheck: Math.max(0, totalSalesCount - ropRefundCount) > 0 ? Math.round(ropNetSales / Math.max(0, totalSalesCount - ropRefundCount)) : 0,
        factAvgCheck: ropFactAvgCheck,
        planCompletion: salesPlan > 0 ? Math.round((ropNetSales / salesPlan) * 1000) / 10 : 0,
        totalConsultations, totalRefusals, totalRefusalsAmount, totalInWork,
      },
      funnel: { leadsReceived, qualifiedLeads, meetingsScheduled, meetingsAttended, salesCount: Math.max(0, totalSalesCount - ropRefundCount) },
      marketing: { leadsplan, totalLeads, totalBudget, leadCost: totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0, qualifiedLeads },
      carryover: { count: ropCarryoverCount, revenue: ropCarryoverRevenue, avgCheck: ropDojimAvgCheck },
      managerRating,
      liderRating,
      productStats,
      gatewayAnalytics: buildGatewayAnalytics(periodSales),
      refundedLeads: ropRefundedLeads.map(l => ({
        id: l.id, clientName: l.clientName, phone: l.phone, date: l.date,
        amount: l.amount, netAmount: l.netAmount, refundComment: l.refundComment,
        crmLink: l.crmLink, assignedTo: l.assignedTo, salesChannel: l.salesChannel,
        refundedAt: l.refundedAt,
      })),
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

  // KZ timezone (UTC+5) boundaries for updatedAt/createdAt comparisons
  const periodStart = new Date(fromStr + 'T00:00:00+05:00')
  const periodEnd   = new Date(toStr   + 'T23:59:59+05:00')

  try {
    const [reports, plans, todayReport, salesByDate, soldLeadsInPeriod] = await Promise.all([
      prisma.report.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { date: 'desc' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey, userId } }),
      prisma.report.findFirst({ where: { userId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      // Primary: Sale.date string match OR Sale.createdAt in KZ period (covers manually-entered and old-date records)
      prisma.sale.findMany({
        where: { userId, OR: [{ date: { gte: fromStr, lte: toStr } }, { createdAt: { gte: periodStart, lte: periodEnd } }] },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      // Fallback: leads that were SOLD (updatedAt) in this KZ period (covers lead-linked Sales with wrong date)
      prisma.lead.findMany({ where: { assignedToId: userId, status: 'SOLD', updatedAt: { gte: periodStart, lte: periodEnd } }, select: { id: true } }),
    ])

    // Merge Sale records: by date/createdAt + by lead.updatedAt (deduplicate by sale id)
    const fallbackLeadIds = soldLeadsInPeriod.map(l => l.id)
    const salesByUpdatedAt = fallbackLeadIds.length > 0
      ? await prisma.sale.findMany({ where: { leadId: { in: fallbackLeadIds } }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] })
      : []
    const saleMap = new Map<string, any>()
    for (const s of [...salesByDate, ...salesByUpdatedAt]) saleMap.set(s.id, s)
    const periodSales = Array.from(saleMap.values())

    const isCloser = req.user!.managerType === 'CLOSER'

    if (isCloser) {
      // Sales come from Sale model (live, per-entry)
      const salesAmount = periodSales.reduce((s, x) => s + (x.netAmount ?? x.amount), 0)
      const salesCount = periodSales.length
      // Carryover: sold in this period from leads created before period start
      const mgrSaleLeadIds = periodSales.map((s: any) => s.leadId).filter(Boolean) as string[]
      const mgrCarryoverLeadSet = mgrSaleLeadIds.length > 0
        ? await prisma.lead.findMany({ where: { id: { in: mgrSaleLeadIds }, date: { lt: fromStr } }, select: { id: true } })
            .then(ls => new Set(ls.map(l => l.id)))
        : new Set<string>()
      const mgrCarryoverSales = periodSales.filter((s: any) => s.leadId && mgrCarryoverLeadSet.has(s.leadId))
      const mgrCarryoverCount = mgrCarryoverSales.length
      const mgrCarryoverRevenue = mgrCarryoverSales.reduce((sum: number, x: any) => sum + (x.netAmount ?? x.amount), 0)
      // Clients received from daily reports
      const clientsReceived = sumReportField(reports, 'clientsReceived')
      const consultations = sumReportField(reports, 'consultations')
      const refusals = sumReportField(reports, 'refusals')
      const inWork = Math.max(0, consultations - salesCount - refusals)
      const salesPlan = plans.find(p => p.type === 'SALES_AMOUNT')?.value || 0

      // Lead-based stats for closer
      const [pendingLeadsCount, inWorkLeadsCount, pendingTasksCount, leadRefusedCount, leadSoldCount, refundedLeads] = await Promise.all([
        prisma.lead.count({ where: { assignedToId: userId, status: 'ASSIGNED' } }),
        prisma.lead.count({ where: { assignedToId: userId, status: 'IN_WORK' } }),
        prisma.leadTask.count({ where: { userId, completed: false } }),
        prisma.lead.count({ where: { assignedToId: userId, status: 'REFUSED', consultationStatus: { not: 'not_happened' }, date: { gte: fromStr, lte: toStr } } }),
        prisma.lead.count({ where: { assignedToId: userId, status: 'SOLD', isRefund: false, updatedAt: { gte: periodStart, lte: periodEnd } } }),
        prisma.lead.findMany({
          where: { assignedToId: userId, status: 'SOLD', isRefund: true, updatedAt: { gte: periodStart, lte: periodEnd } },
          select: { id: true, netAmount: true, amount: true },
        }),
      ])

      const refundCount = refundedLeads.length
      const refundTotal = refundedLeads.reduce((s, l) => s + (l.amount ?? l.netAmount ?? 0), 0)
      const netSalesAmount = salesAmount - refundTotal
      const refundedLeadIds = new Set(refundedLeads.map(l => l.id))

      // Fact = new-period leads sold this period (excludes dojim carryover)
      const factSalesAmount = salesAmount - mgrCarryoverRevenue
      const factSalesCount  = Math.max(0, salesCount - mgrCarryoverCount)
      const factNetSales    = factSalesAmount - refundTotal
      const factAvgCheck    = factSalesCount > 0 ? Math.round(factNetSales / factSalesCount) : 0
      const dojimAvgCheck   = mgrCarryoverCount > 0 ? Math.round(mgrCarryoverRevenue / mgrCarryoverCount) : 0
      // conversion uses factSalesCount — dojim sales don't count as conversions
      const conversion = consultations > 0 ? Math.round((factSalesCount / consultations) * 1000) / 10 : 0

      // Lead-based totals for period stats display
      const leadTotal = inWorkLeadsCount + leadRefusedCount + leadSoldCount
      const leadConversion = leadTotal > 0 ? Math.round((leadSoldCount / leadTotal) * 1000) / 10 : 0

      res.json({
        type: 'CLOSER',
        summary: {
          salesPlan, salesAmount, salesCount,
          refundCount, refundTotal, netSalesAmount,
          // Fact = new-period leads (excludes dojim carryover); used for "Факт продаж" display
          factSalesAmount, factSalesCount, factNetSales,
          planCompletion: salesPlan > 0 ? Math.round((netSalesAmount / salesPlan) * 1000) / 10 : 0,
          conversion,
          avgCheck: Math.max(0, salesCount - refundCount) > 0 ? Math.round(netSalesAmount / Math.max(0, salesCount - refundCount)) : 0,
          factAvgCheck,
          consultations, refusals, inWork,
          pendingLeadsCount, inWorkLeadsCount, pendingTasksCount,
          leadRefusedCount, leadSoldCount, leadTotal, leadConversion,
          carryover: { count: mgrCarryoverCount, revenue: mgrCarryoverRevenue, avgCheck: dojimAvgCheck },
        },
        periodSales: periodSales.map(s => ({
          id: s.id, date: s.date, amount: s.amount, netAmount: s.netAmount,
          paymentType: s.paymentType, paymentMethod: s.paymentMethod,
          bank: s.bank, months: s.months, crmLink: s.crmLink, comment: s.comment,
          leadId: s.leadId, createdAt: s.createdAt,
          isRefund: !!(s.leadId && refundedLeadIds.has(s.leadId)),
        })),
        todayReport,
        recentReports: reports.slice(0, 7),
        gatewayAnalytics: buildGatewayAnalytics(periodSales),
      })
    } else {
      // LIDER — stats come from Lead model (live, per-lead)
      const liderLeads = await prisma.lead.findMany({
        where: { createdById: userId, date: { gte: fromStr, lte: toStr } },
        select: { isQualified: true, assignedToId: true, status: true, consultationStatus: true },
      })

      const leads = liderLeads.length
      const qualifiedLeads = liderLeads.filter(l => l.isQualified).length
      const meetingsScheduled = liderLeads.filter(l => l.assignedToId != null).length  // "Передано клоузеру"
      // "Консультация состоялась" = consultationStatus === 'happened'
      const meetingsAttended = liderLeads.filter(l => l.consultationStatus === 'happened').length

      const meetingsAttendedPlan = plans.find(p => p.type === 'MEETINGS_ATTENDED')?.value || 0
      const leadsplan = plans.find(p => p.type === 'LEADS')?.value || 0
      const schedToAttRate = meetingsScheduled > 0 ? Math.round((meetingsAttended / meetingsScheduled) * 1000) / 10 : 0
      const leadsToSchedRate = leads > 0 ? Math.round((meetingsScheduled / leads) * 1000) / 10 : 0

      // Counts by status for sidebar badges
      const newCount = liderLeads.filter(l => l.status === 'NEW').length
      const assignedCount = liderLeads.filter(l => l.status === 'ASSIGNED').length
      const unqualifiedCount = await prisma.lead.count({ where: { createdById: userId, status: 'UNQUALIFIED' } })
      // Несостоявшиеся = consultations that didn't happen (lider's metric)
      const notHappened = liderLeads.filter(l => l.consultationStatus === 'not_happened').length

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
          notHappened,
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
        select: { createdById: true, isQualified: true, assignedToId: true, status: true, consultationStatus: true },
      }),
    ])

    const statsMap: Record<string, { leads: number; qualifiedLeads: number; meetingsScheduled: number; meetingsAttended: number }> = {}
    for (const l of liderLeads) {
      if (!statsMap[l.createdById]) statsMap[l.createdById] = { leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
      statsMap[l.createdById].leads++
      if (l.isQualified) statsMap[l.createdById].qualifiedLeads++
      if (l.assignedToId) statsMap[l.createdById].meetingsScheduled++  // transmitted to closer
      if (l.consultationStatus === 'happened') statsMap[l.createdById].meetingsAttended++ // "Консультация состоялась"
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
  const fromStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const toStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  const periodStart = new Date(fromStr + 'T00:00:00+05:00')
  const periodEnd   = new Date(toStr   + 'T23:59:59+05:00')

  try {
    const [closers, plans, sales] = await Promise.all([
      prisma.user.findMany({ where: { companyId: req.user!.companyId, status: 'ACTIVE', role: 'MANAGER', managerType: 'CLOSER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.sale.findMany({ where: { user: { companyId: req.user!.companyId, managerType: 'CLOSER' }, OR: [{ date: { gte: fromStr, lte: toStr } }, { createdAt: { gte: periodStart, lte: periodEnd } }] }, include: { user: { select: { id: true } } } }),
    ])

    const salesMap: Record<string, { salesAmount: number; salesCount: number }> = {}
    for (const s of sales) {
      const uid = s.user.id
      if (!salesMap[uid]) salesMap[uid] = { salesAmount: 0, salesCount: 0 }
      salesMap[uid].salesAmount += Number(s.netAmount ?? s.amount) || 0
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
