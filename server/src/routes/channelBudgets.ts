import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

function pct(a: number, b: number) {
  if (b === 0) return 0
  return Math.round((a / b) * 1000) / 10
}

// GET /api/channel-budgets?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns per-channel spend for the period
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query
  try {
    const where: any = { companyId: req.user!.companyId }
    if (from || to) {
      where.date = {}
      if (from) where.date = { ...where.date, gte: from as string }
      if (to) where.date = { ...where.date, lte: to as string }
    }
    const budgets = await prisma.channelBudget.findMany({
      where,
      include: { channel: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { channel: { name: 'asc' } }],
    })
    res.json(budgets)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/channel-budgets  — upsert spend for a channel+date
// Body: { channelId, date, spend }
router.put('/', authenticate, requireRole('OWNER', 'ROP', 'MARKETER'), async (req: AuthRequest, res: Response) => {
  const { channelId, date, spend } = req.body
  if (!channelId || !date || spend === undefined) return res.status(400).json({ error: 'Missing fields' })
  try {
    const ch = await prisma.salesChannel.findFirst({ where: { id: channelId, companyId: req.user!.companyId } })
    if (!ch) return res.status(404).json({ error: 'Channel not found' })
    const budget = await prisma.channelBudget.upsert({
      where: { date_channelId_companyId: { date: date as string, channelId, companyId: req.user!.companyId } },
      update: { spend: Number(spend) },
      create: { date: date as string, channelId, companyId: req.user!.companyId, spend: Number(spend) },
    })
    res.json(budget)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/channel-budgets/dashboard?from=&to=
// Full marketing dashboard data
router.get('/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query
  const companyId = req.user!.companyId

  try {
    // Date range — use local date helper to avoid UTC offset issues
    function localDateStr(d: Date) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const now = new Date()
    const fromStr = (from as string) || localDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
    const toStr   = (to as string) || localDateStr(now)

    // 1. All leads in period
    const leads = await prisma.lead.findMany({
      where: {
        companyId,
        date: { gte: fromStr, lte: toStr },
      },
      select: {
        id: true, salesChannelId: true, isQualified: true, subStatus: true,
        consultationStatus: true, status: true,
      },
    })

    // 2. All channel budgets in period
    const budgets = await prisma.channelBudget.findMany({
      where: { companyId, date: { gte: fromStr, lte: toStr } },
      include: { channel: { select: { id: true, name: true } } },
    })

    // 3. Sales in period — Sale.date is a String (YYYY-MM-DD), use string comparison
    const sales = await prisma.sale.findMany({
      where: {
        companyId,
        date: { gte: fromStr, lte: toStr },
      },
      select: { id: true, amount: true },
    })

    // 4. All sales channels for company
    const channels = await prisma.salesChannel.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    })

    // 5. Plans — use toStr month so if period spans two months (e.g. Jun 30 – Jul 24), we get the current month's plans
    const monthKey = toStr.slice(0, 7)
    const plans = await prisma.plan.findMany({
      where: { companyId, period: monthKey, userId: null, departmentId: null },
    })

    // ── Aggregate totals ──────────────────────────────────────────────────────
    const totalLeads     = leads.length
    const qualLeads      = leads.filter(l => l.isQualified).length
    const scheduled      = leads.filter(l => l.subStatus === 'scheduled').length
    const happened       = leads.filter(l => l.consultationStatus === 'happened').length
    const totalSalesCount = sales.length
    const totalRevenue   = sales.reduce((s, sale) => s + Number(sale.amount), 0)
    const totalSpend     = budgets.reduce((s, b) => s + b.spend, 0)

    const cpl   = totalLeads > 0 && totalSpend > 0 ? Math.round(totalSpend / totalLeads) : 0
    const cpql  = qualLeads > 0 && totalSpend > 0 ? Math.round(totalSpend / qualLeads) : 0
    const cac   = totalSalesCount > 0 && totalSpend > 0 ? Math.round(totalSpend / totalSalesCount) : 0
    const drr   = totalRevenue > 0 ? pct(totalSpend, totalRevenue) : 0

    // ── Per-channel aggregation ───────────────────────────────────────────────
    const spendByChannel: Record<string, number> = {}
    budgets.forEach(b => {
      spendByChannel[b.channelId] = (spendByChannel[b.channelId] || 0) + b.spend
    })

    const leadsByChannel: Record<string, { total: number; qual: number; notQual: number }> = {}
    leads.forEach(l => {
      const cid = l.salesChannelId || '__none__'
      if (!leadsByChannel[cid]) leadsByChannel[cid] = { total: 0, qual: 0, notQual: 0 }
      leadsByChannel[cid].total++
      if (l.isQualified) leadsByChannel[cid].qual++
      else leadsByChannel[cid].notQual++
    })

    const channelRows = channels.map(ch => {
      const spend   = spendByChannel[ch.id] || 0
      const lc      = leadsByChannel[ch.id] || { total: 0, qual: 0, notQual: 0 }
      const chCpl   = lc.total > 0 && spend > 0 ? Math.round(spend / lc.total) : 0
      const chCpql  = lc.qual > 0 && spend > 0 ? Math.round(spend / lc.qual) : 0
      const chConv  = pct(lc.qual, lc.total)
      return {
        id: ch.id, name: ch.name,
        spend, leads: lc.total, qualLeads: lc.qual, notQual: lc.notQual,
        cpl: chCpl, cpql: chCpql, convLidToQual: chConv,
      }
    })

    // Add an "without channel" row if there are leads without channel
    const noneLeads = leadsByChannel['__none__']
    if (noneLeads && noneLeads.total > 0) {
      channelRows.push({
        id: '__none__', name: 'Без канала',
        spend: 0, leads: noneLeads.total, qualLeads: noneLeads.qual, notQual: noneLeads.notQual,
        cpl: 0, cpql: 0, convLidToQual: pct(noneLeads.qual, noneLeads.total),
      })
    }

    // ── Loss reasons ─────────────────────────────────────────────────────────
    const lostLeads = leads.filter(l => !l.isQualified || l.subStatus === 'refused' || l.consultationStatus === 'not_happened')
    const lossReasons = [
      { label: 'Не квал / нецелевой', count: leads.filter(l => !l.isQualified).length },
      { label: 'Отказ от записи', count: leads.filter(l => l.isQualified && l.subStatus === 'refused').length },
      { label: 'Не состоялась', count: leads.filter(l => l.consultationStatus === 'not_happened').length },
      { label: 'Думает', count: leads.filter(l => l.isQualified && l.subStatus === 'thinking').length },
      { label: 'Перенос без даты', count: leads.filter(l => l.consultationStatus === 'postponed').length },
    ].filter(r => r.count > 0)
    const totalLost = lossReasons.reduce((s, r) => s + r.count, 0)

    // ── Plan values ───────────────────────────────────────────────────────────
    const planLeads  = (plans as any[]).find((p: any) => p.type === 'LEADS')?.value || 0
    const planQual   = (plans as any[]).find((p: any) => p.type === 'QUALIFIED_LEADS')?.value || 0
    const planBudget = (plans as any[]).find((p: any) => p.type === 'BUDGET')?.value || 0

    res.json({
      overview: { totalLeads, qualLeads, scheduled, happened, totalSalesCount, totalRevenue, totalSpend },
      kpi: {
        cpl, cpql, cac, drr,
        convLidToQual: pct(qualLeads, totalLeads),
        convQualToScheduled: pct(scheduled, qualLeads),
        convScheduledToHappened: pct(happened, scheduled),
        convHappenedToSale: pct(totalSalesCount, happened),
        convOverall: pct(totalSalesCount, totalLeads),
      },
      channels: channelRows,
      lossReasons,
      totalLost,
      plans: { planLeads, planQual, planBudget },
    })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

export default router
