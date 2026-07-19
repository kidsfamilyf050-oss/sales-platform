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

// Owner dashboard
router.get('/owner', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`

  try {
    const [salesDepts, marketingDepts, allUsers, plans, closerReports, liderReports, marketerReports] = await Promise.all([
      prisma.department.findMany({ where: { companyId: req.user!.companyId, type: 'SALES' }, include: { users: { where: { status: 'ACTIVE', role: 'MANAGER' } } } }),
      prisma.department.findMany({ where: { companyId: req.user!.companyId, type: 'MARKETING' } }),
      prisma.user.findMany({ where: { companyId: req.user!.companyId, status: 'ACTIVE', role: 'MANAGER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'CLOSER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true, departmentId: true, managerType: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'LIDER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true, departmentId: true, managerType: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'MARKETER', date: { gte: start, lte: end } } }),
    ])

    const totalSalesAmount = sumReportField(closerReports, 'salesAmount')
    const totalSalesCount = sumReportField(closerReports, 'salesCount')
    const totalClients = sumReportField(closerReports, 'clients')
    // Marketing: leads & budget come from MARKETER reports
    const totalLeads = marketerReports.reduce((s, r) => s + (Number((r.data as any).leads) || Number((r.data as any).leadsCount) || 0), 0)
    const totalBudget = marketerReports.reduce((s, r) => s + (Number((r.data as any).budget) || Number((r.data as any).adBudget) || 0), 0)
    // Qualified leads, meetings come from LIDER reports
    const totalQualifiedLeads = sumReportField(liderReports, 'qualifiedLeads')
    const totalMeetingsScheduled = sumReportField(liderReports, 'meetingsScheduled')
    const totalMeetingsAttended = sumReportField(liderReports, 'meetingsAttended')

    // Sum all department + company level plans (not per-user)
    const salesPlan = plans.filter(p => !p.userId && p.type === 'SALES_AMOUNT').reduce((s, p) => s + p.value, 0)
    // Company-level marketing plans (no userId, no departmentId)
    const leadsplan  = plans.find(p => !p.userId && !p.departmentId && p.type === 'LEADS')?.value  || 0
    const budgetPlan = plans.find(p => !p.userId && !p.departmentId && p.type === 'BUDGET')?.value || 0

    const avgCheck = totalSalesCount > 0 ? totalSalesAmount / totalSalesCount : 0
    // Конверсия: если есть лиды от маркетинга — от лидов; иначе — от входящих заявок (clients)
    const conversionBase = totalLeads > 0 ? totalLeads : totalClients
    const conversionLabel = totalLeads > 0 ? 'лиды → продажи' : 'заявки → продажи'
    const conversion = conversionBase > 0 ? (totalSalesCount / conversionBase) * 100 : 0
    // Стоимость лида: фактический бюджет если есть, иначе плановый
    const effectiveBudget = totalBudget > 0 ? totalBudget : budgetPlan
    const leadCost = totalLeads > 0 ? effectiveBudget / totalLeads : 0

    // Daily chart data (closers)
    const dailySales: Record<string, { sales: number; amount: number }> = {}
    for (const r of closerReports) {
      const d = r.date.toISOString().split('T')[0]
      if (!dailySales[d]) dailySales[d] = { sales: 0, amount: 0 }
      dailySales[d].sales += Number((r.data as any).salesCount) || 0
      dailySales[d].amount += Number((r.data as any).salesAmount) || 0
    }

    // Closer rating
    const closerStats: Record<string, { name: string; salesCount: number; salesAmount: number; clients: number }> = {}
    for (const r of closerReports) {
      const uid = r.user.id
      if (!closerStats[uid]) closerStats[uid] = { name: r.user.name, salesCount: 0, salesAmount: 0, clients: 0 }
      closerStats[uid].salesCount += Number((r.data as any).salesCount) || 0
      closerStats[uid].salesAmount += Number((r.data as any).salesAmount) || 0
      closerStats[uid].clients += Number((r.data as any).clients) || 0
    }
    const managerRating = Object.entries(closerStats)
      .map(([id, s]) => {
        const plan = plans.find(p => p.userId === id && p.type === 'SALES_AMOUNT')?.value || 0
        const completion = plan > 0 ? Math.round((s.salesAmount / plan) * 100) : 0
        return {
          id, name: s.name, type: 'CLOSER', plan,
          salesCount: s.salesCount, salesAmount: s.salesAmount, completion,
          conversion: s.clients > 0 ? Math.round((s.salesCount / s.clients) * 100) : 0,
          avgCheck: s.salesCount > 0 ? Math.round(s.salesAmount / s.salesCount) : 0,
        }
      })
      .sort((a, b) => b.completion - a.completion)

    // Lider rating
    const liderStats: Record<string, { name: string; leads: number; qualifiedLeads: number; meetingsScheduled: number; meetingsAttended: number }> = {}
    for (const r of liderReports) {
      const uid = r.user.id
      if (!liderStats[uid]) liderStats[uid] = { name: r.user.name, leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
      liderStats[uid].leads += Number((r.data as any).leads) || 0
      liderStats[uid].qualifiedLeads += Number((r.data as any).qualifiedLeads) || 0
      liderStats[uid].meetingsScheduled += Number((r.data as any).meetingsScheduled) || 0
      liderStats[uid].meetingsAttended += Number((r.data as any).meetingsAttended) || 0
    }
    const liderRating = Object.entries(liderStats)
      .map(([id, s]) => {
        const leadsplan = plans.find(p => p.userId === id && p.type === 'LEADS')?.value || 0
        const completion = leadsplan > 0 ? Math.round((s.leads / leadsplan) * 100) : 0
        return {
          id, name: s.name, type: 'LIDER', leadsplan,
          leads: s.leads, qualifiedLeads: s.qualifiedLeads,
          meetingsScheduled: s.meetingsScheduled, meetingsAttended: s.meetingsAttended,
          completion, qualRate: s.leads > 0 ? Math.round((s.qualifiedLeads / s.leads) * 100) : 0,
        }
      })
      .sort((a, b) => b.completion - a.completion)

    res.json({
      summary: {
        salesPlan, totalSalesAmount, totalSalesCount, avgCheck: Math.round(avgCheck),
        conversion: Math.round(conversion * 10) / 10,
        conversionLabel,
        planCompletion: salesPlan > 0 ? Math.round((totalSalesAmount / salesPlan) * 100) : 0,
        totalLeads, totalQualifiedLeads, totalBudget, budgetPlan, leadCost: Math.round(leadCost),
        totalMeetingsScheduled, totalMeetingsAttended,
        leadsplan, totalManagers: allUsers.length,
        bestManager: managerRating[0]?.name || '—',
        worstManager: managerRating[managerRating.length - 1]?.name || '—',
      },
      departments: salesDepts,
      dailyChart: Object.entries(dailySales).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
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

  try {
    const [managers, plans, closerReports, liderReports, marketerReports, todayReports] = await Promise.all([
      prisma.user.findMany({ where: { companyId: req.user!.companyId, departmentId: deptId || undefined, status: 'ACTIVE', role: 'MANAGER' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'CLOSER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true, managerType: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, type: 'LIDER', date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true } } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId }, type: 'MARKETER', date: { gte: start, lte: end } } }),
      prisma.report.findMany({ where: { user: { companyId: req.user!.companyId, departmentId: deptId || undefined }, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ])

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayReportedIds = new Set(todayReports.map(r => r.userId))

    const salesAmount = sumReportField(closerReports, 'salesAmount')
    const salesCount = sumReportField(closerReports, 'salesCount')
    const clientsReceived = sumReportField(closerReports, 'clients')
    const leadsReceived = sumReportField(liderReports, 'leads')
    const qualifiedLeads = sumReportField(liderReports, 'qualifiedLeads')
    const meetingsScheduled = sumReportField(liderReports, 'meetingsScheduled')
    const meetingsAttended = sumReportField(liderReports, 'meetingsAttended')

    const salesPlan = plans.find(p => p.departmentId === deptId && p.type === 'SALES_AMOUNT')?.value ||
      plans.find(p => !p.departmentId && p.type === 'SALES_AMOUNT')?.value || 0

    // Closer rating with status indicator
    const closerMap: Record<string, any> = {}
    for (const r of closerReports) {
      const uid = r.user.id
      if (!closerMap[uid]) closerMap[uid] = { salesCount: 0, salesAmount: 0, clients: 0 }
      closerMap[uid].salesCount += Number((r.data as any).salesCount) || 0
      closerMap[uid].salesAmount += Number((r.data as any).salesAmount) || 0
      closerMap[uid].clients += Number((r.data as any).clients) || 0
    }

    const closers = managers.filter(m => m.managerType !== 'LIDER')
    const managerRating = closers.map(m => {
      const stats = closerMap[m.id] || { salesCount: 0, salesAmount: 0, clients: 0 }
      const managerPlan = plans.find(p => p.userId === m.id && p.type === 'SALES_AMOUNT')?.value || 0
      const completion = managerPlan > 0 ? Math.round((stats.salesAmount / managerPlan) * 100) : 0
      const reportedToday = todayReportedIds.has(m.id)
      let status: 'red' | 'yellow' | 'green' = 'green'
      if (!reportedToday) status = 'red'
      else if (completion < 50) status = 'yellow'
      return {
        id: m.id, name: m.name, managerType: m.managerType,
        plan: managerPlan, salesAmount: stats.salesAmount, salesCount: stats.salesCount,
        completion, conversion: stats.clients > 0 ? Math.round((stats.salesCount / stats.clients) * 100) : 0,
        status, reportedToday,
      }
    }).sort((a, b) => b.completion - a.completion)

    // Lider rating with status indicator
    const liderMap: Record<string, any> = {}
    for (const r of liderReports) {
      const uid = r.user.id
      if (!liderMap[uid]) liderMap[uid] = { leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
      liderMap[uid].leads += Number((r.data as any).leads) || 0
      liderMap[uid].qualifiedLeads += Number((r.data as any).qualifiedLeads) || 0
      liderMap[uid].meetingsScheduled += Number((r.data as any).meetingsScheduled) || 0
      liderMap[uid].meetingsAttended += Number((r.data as any).meetingsAttended) || 0
    }

    const liderUsers = managers.filter(m => m.managerType === 'LIDER')
    const liderRating = liderUsers.map(m => {
      const stats = liderMap[m.id] || { leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
      const leadsplan = plans.find(p => p.userId === m.id && p.type === 'LEADS')?.value || 0
      const completion = leadsplan > 0 ? Math.round((stats.leads / leadsplan) * 100) : 0
      const reportedToday = todayReportedIds.has(m.id)
      let status: 'red' | 'yellow' | 'green' = 'green'
      if (!reportedToday) status = 'red'
      else if (completion < 50) status = 'yellow'
      return {
        id: m.id, name: m.name,
        leadsplan, leads: stats.leads, qualifiedLeads: stats.qualifiedLeads,
        meetingsScheduled: stats.meetingsScheduled, meetingsAttended: stats.meetingsAttended,
        completion, qualRate: stats.leads > 0 ? Math.round((stats.qualifiedLeads / stats.leads) * 100) : 0,
        status, reportedToday,
      }
    }).sort((a, b) => b.completion - a.completion)

    // Marketing block: leads & budget from MARKETER, qualified from LIDER
    const totalLeads = marketerReports.reduce((s, r) => s + (Number((r.data as any).leads) || Number((r.data as any).leadsCount) || 0), 0)
    const totalBudget = marketerReports.reduce((s, r) => s + (Number((r.data as any).budget) || Number((r.data as any).adBudget) || 0), 0)
    const leadsplan = plans.find(p => !p.userId && !p.departmentId && p.type === 'LEADS')?.value || 0

    res.json({
      summary: {
        salesPlan, salesAmount, salesCount,
        conversion: clientsReceived > 0 ? Math.round((salesCount / clientsReceived) * 100) : 0,
        avgCheck: salesCount > 0 ? Math.round(salesAmount / salesCount) : 0,
        planCompletion: salesPlan > 0 ? Math.round((salesAmount / salesPlan) * 100) : 0,
      },
      funnel: { leadsReceived, qualifiedLeads, meetingsScheduled, meetingsAttended, salesCount },
      marketing: { leadsplan, totalLeads, totalBudget, leadCost: totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0, qualifiedLeads },
      managerRating,
      liderRating,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Manager dashboard (personal)
router.get('/manager', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to } = req.query
  const { start, end } = getPeriodDates(period as string, from as string, to as string)
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  const userId = req.user!.id

  try {
    const [reports, plans, todayReport] = await Promise.all([
      prisma.report.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { date: 'desc' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey, userId } }),
      prisma.report.findFirst({ where: { userId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ])

    const isCloser = req.user!.managerType === 'CLOSER'

    if (isCloser) {
      const salesAmount = sumReportField(reports, 'salesAmount')
      const salesCount = sumReportField(reports, 'salesCount')
      const clientsReceived = sumReportField(reports, 'clientsReceived')
      const salesPlan = plans.find(p => p.type === 'SALES_AMOUNT')?.value || 0

      res.json({
        type: 'CLOSER',
        summary: {
          salesPlan, salesAmount, salesCount,
          planCompletion: salesPlan > 0 ? Math.round((salesAmount / salesPlan) * 100) : 0,
          conversion: clientsReceived > 0 ? Math.round((salesCount / clientsReceived) * 100) : 0,
          avgCheck: salesCount > 0 ? Math.round(salesAmount / salesCount) : 0,
        },
        todayReport,
        recentReports: reports.slice(0, 7),
      })
    } else {
      const leads = sumReportField(reports, 'leads')
      const qualifiedLeads = sumReportField(reports, 'qualifiedLeads')
      const meetingsScheduled = sumReportField(reports, 'meetingsScheduled')
      const meetingsAttended = sumReportField(reports, 'meetingsAttended')
      const leadsplan = plans.find(p => p.type === 'LEADS')?.value || 0

      res.json({
        type: 'LIDER',
        summary: {
          leadsplan, leads,
          planCompletion: leadsplan > 0 ? Math.round((leads / leadsplan) * 100) : 0,
          qualifiedLeads, meetingsScheduled, meetingsAttended,
          qualRate: leads > 0 ? Math.round((qualifiedLeads / leads) * 100) : 0,
        },
        todayReport,
        recentReports: reports.slice(0, 7),
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

  try {
    const [reports, plans, todayReport] = await Promise.all([
      prisma.report.findMany({ where: { userId, type: 'MARKETER', date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),
      prisma.plan.findMany({ where: { companyId: req.user!.companyId, period: periodKey } }),
      prisma.report.findFirst({ where: { userId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ])

    const totalLeads = sumReportField(reports, 'leadsCount')
    const totalQualified = sumReportField(reports, 'qualifiedLeads')
    const totalBudget = sumReportField(reports, 'adBudget')
    const leadsplan = plans.find(p => p.type === 'LEADS')?.value || 0
    const budgetPlan = plans.find(p => p.type === 'BUDGET')?.value || 0
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
        planCompletion: leadsplan > 0 ? Math.round((totalLeads / leadsplan) * 100) : 0,
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

export default router
