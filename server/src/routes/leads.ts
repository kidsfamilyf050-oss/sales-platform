import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const INCLUDE_FULL = {
  createdBy: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  salesChannel: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, price: true } },
  lossReason: { select: { id: true, name: true } },
  tasks: { orderBy: { dueDate: 'asc' as const } },
}

// Payment gateway fee map (used to calculate netAmount = бюджет сделки)
const GATEWAY_FEE: Record<string, number> = {
  'GetPay': 0.13,
  'TipTopPay_KZ': 0.065,
  'TipTopPay_Foreign': 0.079,
  'Kaspi_Gold': 0.0395,
  'Kaspi_Account': 0.041,
  'Kaspi_Credit': 0.165,
  'Kaspi_Red': 0.143,
  'Kaspi_Terminal': 0.043,
  'Cash': 0.03,
  'Transfer_AE': 0.03,
  'Card_Sberbank': 0.03,
  'Kaspi_Bookkeeper': 0.03,
}

// Helper: today's date in Kazakhstan (UTC+5)
function getKzToday(): string {
  const nowKz = new Date(Date.now() + 5 * 60 * 60 * 1000)
  return nowKz.toISOString().slice(0, 10)
}

function calcNetAmount(amount: number, paymentMethod: string): number {
  const fee = GATEWAY_FEE[paymentMethod] ?? 0.03
  return Math.round(amount * (1 - fee) * 100) / 100
}

// ── GET /api/leads — lider: their active (NEW) leads ─────────────────────────
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, period = 'month' } = req.query
  const { fromStr, toStr } = getPeriodStr(period as string, from as string, to as string)
  try {
    const leads = await prisma.lead.findMany({
      where: {
        createdById: req.user!.id,
        status: 'NEW',
        date: { gte: fromStr, lte: toStr },
      },
      include: INCLUDE_FULL,
      orderBy: { createdAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/assigned — lider: leads assigned to closers ───────────────
router.get('/assigned', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, period = 'month' } = req.query
  const { fromStr, toStr } = getPeriodStr(period as string, from as string, to as string)
  try {
    const leads = await prisma.lead.findMany({
      where: {
        createdById: req.user!.id,
        status: 'ASSIGNED',
        date: { gte: fromStr, lte: toStr },
      },
      include: INCLUDE_FULL,
      orderBy: { createdAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/unqualified — lider: unqualified leads ────────────────────
router.get('/unqualified', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, period = 'month' } = req.query
  const { fromStr, toStr } = getPeriodStr(period as string, from as string, to as string)
  try {
    const leads = await prisma.lead.findMany({
      where: {
        createdById: req.user!.id,
        status: 'UNQUALIFIED',
        date: { gte: fromStr, lte: toStr },
      },
      include: INCLUDE_FULL,
      orderBy: { createdAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/today-appointments — lider: leads CREATED today (by server timestamp) ──
// Uses createdAt (not the manually-entered date field), so a lead entered today
// but with yesterday's date still appears. Ignores the period filter.
router.get('/today-appointments', authenticate, async (req: AuthRequest, res: Response) => {
  const today = getKzToday() // KZ UTC+5 date string YYYY-MM-DD
  try {
    // Start/end of today in KZ time, expressed as UTC for Prisma createdAt query
    const startUtc = new Date(`${today}T00:00:00+05:00`)
    const endUtc   = new Date(`${today}T23:59:59+05:00`)
    const leads = await prisma.lead.findMany({
      where: {
        createdById: req.user!.id,
        createdAt: { gte: startUtc, lte: endUtc },
      },
      include: INCLUDE_FULL,
      orderBy: { createdAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/overdue-appointments — lider: past meetings needing action ──
// Excludes happened/not_happened. Includes:
//   1. Leads with appointmentDate in the past and no status or planned
//   2. Postponed leads where postponedDate (or appointmentDate if no postponedDate) is in the past
router.get('/overdue-appointments', authenticate, async (req: AuthRequest, res: Response) => {
  const today = getKzToday()
  try {
    const leads = await prisma.lead.findMany({
      where: {
        createdById: req.user!.id,
        OR: [
          // Plain overdue: appointment in the past, status null or planned
          { appointmentDate: { lt: today }, consultationStatus: null },
          { appointmentDate: { lt: today }, consultationStatus: 'planned' },
          // Postponed: postponedDate in the past
          { consultationStatus: 'postponed', postponedDate: { lt: today } },
          // Postponed but no postponedDate set → fall back to original appointmentDate
          { consultationStatus: 'postponed', postponedDate: null, appointmentDate: { lt: today } },
        ],
      },
      include: INCLUDE_FULL,
      orderBy: { appointmentDate: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/lider-report — lider: full report with stats ──────────────
router.get('/lider-report', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, period = 'month', search, channelId, ktsStatus, subStatus, consultationStatus, date: dateFilter } = req.query
  const { fromStr, toStr } = getPeriodStr(period as string, from as string, to as string)
  try {
    // Filtered query for table
    const where: any = {
      createdById: req.user!.id,
      date: { gte: fromStr, lte: toStr },
    }
    if (search) {
      where.OR = [
        { clientName: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
        { leadLink: { contains: search as string, mode: 'insensitive' } },
      ]
    }
    if (channelId) where.salesChannelId = channelId as string
    if (subStatus) where.subStatus = subStatus as string
    // 'needUpdate' is a special combined filter: planned OR postponed (for "Обновить статус" button)
    if (consultationStatus === 'needUpdate') {
      where.consultationStatus = { in: ['planned', 'postponed'] } as any
    } else if (consultationStatus) {
      where.consultationStatus = consultationStatus as string
    }
    if (dateFilter) where.appointmentDate = dateFilter as string
    if (ktsStatus === 'qualified') {
      where.isQualified = true
      // KtsBadge shows "В работе КЦ" in TWO cases — both must be excluded from "Квал":
      // 1. subStatus === 'in_work_kc' (lider manually set)  → exclude via AND/OR
      // 2. status === 'IN_WORK' (closer accepted the lead)  → exclude via status filter
      where.status = { not: 'IN_WORK' } as any
      if (!subStatus) {
        // IMPORTANT: Prisma { not: 'in_work_kc' } generates SQL "!= 'in_work_kc'"
        // which EXCLUDES NULLs (SQL NULL != x → NULL, not TRUE).
        // "Квал •" leads have subStatus = null → we must explicitly include null.
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          { OR: [{ subStatus: null }, { subStatus: { not: 'in_work_kc' } }] } as any,
        ]
      }
    } else if (ktsStatus === 'unqualified') {
      where.isQualified = false
    } else if (ktsStatus === 'in_work') {
      // "В работе КЦ" bucket = subStatus in_work_kc OR status IN_WORK
      where.OR = [
        { subStatus: 'in_work_kc' },
        { status: 'IN_WORK' },
      ]
    }

    const leads = await prisma.lead.findMany({ where, include: INCLUDE_FULL, orderBy: { createdAt: 'desc' } })

    // Stats from ALL leads in period (no filter)
    const allLeads = await prisma.lead.findMany({
      where: { createdById: req.user!.id, date: { gte: fromStr, lte: toStr } },
      select: { isQualified: true, subStatus: true, consultationStatus: true, status: true, appointmentDate: true, postponedDate: true, date: true },
    })

    const today = getKzToday() // KZ-correct date
    const totalLeads = allLeads.length
    // п.10: count all leads scheduled today regardless of consultationStatus
    const totalScheduledToday = allLeads.filter(l =>
      l.appointmentDate === today || l.postponedDate === today
    ).length
    // SOLD leads always count as "happened" even if closer didn't explicitly mark consultationStatus
    const totalHappened = allLeads.filter(l => l.consultationStatus === 'happened' || l.status === 'SOLD').length
    const totalCancelled = allLeads.filter(l => l.consultationStatus === 'not_happened').length
    const totalPostponed = allLeads.filter(l => l.consultationStatus === 'postponed').length
    const totalScheduled = allLeads.filter(l => l.subStatus === 'scheduled').length
    const conversionToScheduled = totalLeads > 0 ? Math.round(totalScheduled / totalLeads * 100) : 0

    // п.6: needStatusUpdate — only planned or no-status past appointments (not already resolved)
    const reminders = {
      needStatusUpdate: allLeads.filter(l => {
        // Leads with planned status and past appointment date
        const plannedPast = l.appointmentDate && l.appointmentDate < today &&
          (!l.consultationStatus || l.consultationStatus === 'planned')
        // Postponed leads where the postponedDate is in the past (or no new date set)
        const postponedPast = l.consultationStatus === 'postponed' &&
          (!l.postponedDate || l.postponedDate < today)
        return plannedPast || postponedPast
      }).length,
      thinkingTooLong: (() => {
        const twoDaysAgo = new Date(Date.now() + 5 * 60 * 60 * 1000); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
        const cutoff = twoDaysAgo.toISOString().slice(0, 10)
        return allLeads.filter(l => l.subStatus === 'thinking' && l.date < cutoff).length
      })(),
      postponedNoDate: allLeads.filter(l => l.consultationStatus === 'postponed' && !l.postponedDate).length,
    }

    // Plan completion for this lider
    const liderPlans = await prisma.plan.findMany({ where: { userId: req.user!.id } })
    const meetingsAttendedPlan = liderPlans.find(p => p.type === 'MEETINGS_ATTENDED')?.value || 0
    const planCompletion = meetingsAttendedPlan > 0 ? Math.round((totalHappened / meetingsAttendedPlan) * 1000) / 10 : 0

    // п.17: department stats for the lider's own department
    const deptStats = req.user!.departmentId ? await (async () => {
      const deptLeads = await prisma.lead.findMany({
        where: {
          createdBy: { departmentId: req.user!.departmentId },
          date: { gte: fromStr, lte: toStr },
        },
        select: { subStatus: true, consultationStatus: true, status: true },
      })
      return {
        total: deptLeads.length,
        scheduled: deptLeads.filter(l => l.subStatus === 'scheduled').length,
        happened: deptLeads.filter(l => l.consultationStatus === 'happened' || l.status === 'SOLD').length,
      }
    })() : null

    res.json({
      leads,
      stats: {
        totalLeads,
        totalScheduledToday,
        totalHappened,
        totalCancelled,
        totalPostponed,
        totalScheduled,
        conversionToScheduled,
        meetingsAttendedPlan,
        planCompletion,
        funnel: {
          total: totalLeads,
          qualified: allLeads.filter(l => l.isQualified).length,
          scheduled: totalScheduled,
          happened: allLeads.filter(l => l.consultationStatus === 'happened' || l.status === 'SOLD').length,
          sold: allLeads.filter(l => l.status === 'SOLD').length,
        },
        deptStats,
      },
      reminders,
    })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/incoming — closer: ASSIGNED leads (need to accept) ────────
router.get('/incoming', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { assignedToId: req.user!.id, status: 'ASSIGNED' },
      include: INCLUDE_FULL,
      orderBy: { createdAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/in-work — closer: IN_WORK leads ───────────────────────────
router.get('/in-work', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, period = 'month' } = req.query
  const { fromStr, toStr } = getPeriodStr(period as string, from as string, to as string)
  try {
    const leads = await prisma.lead.findMany({
      where: {
        assignedToId: req.user!.id,
        status: 'IN_WORK',
        date: { gte: fromStr, lte: toStr },
      },
      include: INCLUDE_FULL,
      orderBy: { updatedAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/refused — closer: REFUSED leads ───────────────────────────
router.get('/refused', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, period = 'month' } = req.query
  const { fromStr, toStr } = getPeriodStr(period as string, from as string, to as string)
  try {
    const leads = await prisma.lead.findMany({
      where: {
        assignedToId: req.user!.id,
        status: 'REFUSED',
        date: { gte: fromStr, lte: toStr },
      },
      include: INCLUDE_FULL,
      orderBy: { updatedAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/sold — closer: SOLD leads ─────────────────────────────────
router.get('/sold', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, period = 'month' } = req.query
  const { fromStr, toStr } = getPeriodStr(period as string, from as string, to as string)
  try {
    const leads = await prisma.lead.findMany({
      where: {
        assignedToId: req.user!.id,
        status: 'SOLD',
        date: { gte: fromStr, lte: toStr },
      },
      include: INCLUDE_FULL,
      orderBy: { updatedAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/all — ROP/OWNER: all leads in company ─────────────────────
router.get('/all', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, period = 'month', status } = req.query
  const { fromStr, toStr } = getPeriodStr(period as string, from as string, to as string)
  const role = req.user!.role
  if (role !== 'ROP' && role !== 'OWNER') return res.status(403).json({ error: 'Forbidden' })
  try {
    const where: any = {
      companyId: req.user!.companyId,
      date: { gte: fromStr, lte: toStr },
    }
    if (status) where.status = status
    const leads = await prisma.lead.findMany({
      where,
      include: INCLUDE_FULL,
      orderBy: { createdAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/company-daily-stats — lider stats per day (for ROP/OWNER tracking table) ─────
router.get('/company-daily-stats', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from and to required' })
  try {
    const leads = await prisma.lead.findMany({
      where: {
        createdBy: { companyId: req.user!.companyId },
        date: { gte: from as string, lte: to as string },
      },
      select: { createdById: true, date: true, isQualified: true, assignedToId: true, status: true, consultationStatus: true },
    })

    // Aggregate by userId → date → stats
    const stats: Record<string, Record<string, { leads: number; qualifiedLeads: number; meetingsScheduled: number; meetingsAttended: number }>> = {}
    for (const l of leads) {
      const uid = l.createdById
      const d = l.date // YYYY-MM-DD string
      if (!stats[uid]) stats[uid] = {}
      if (!stats[uid][d]) stats[uid][d] = { leads: 0, qualifiedLeads: 0, meetingsScheduled: 0, meetingsAttended: 0 }
      stats[uid][d].leads++
      if (l.isQualified) stats[uid][d].qualifiedLeads++
      if (l.assignedToId) stats[uid][d].meetingsScheduled++
      if (l.consultationStatus === 'happened' || l.status === 'SOLD') stats[uid][d].meetingsAttended++
    }

    res.json(stats)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/leads — create lead (lider) ────────────────────────────────────
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { clientName, phone, date, salesChannelId, isQualified, isScheduled, comment, assignedToId,
          leadLink, subStatus, appointmentDate, appointmentTime, consultationStatus, postponedDate, postponedTime } = req.body
  if (!clientName || !date) return res.status(400).json({ error: 'clientName, date required' })

  const qualified = isQualified !== false && isQualified !== 'false'
  let status: any = qualified ? 'NEW' : 'UNQUALIFIED'
  // Only set ASSIGNED if explicitly passing assignedToId (ktsMode = 'inwork')
  if (qualified && assignedToId) status = 'ASSIGNED'

  try {
    const lead = await prisma.lead.create({
      data: {
        companyId: req.user!.companyId,
        createdById: req.user!.id,
        assignedToId: (qualified && assignedToId) ? assignedToId : null,
        clientName: clientName.trim(),
        phone: (phone || '').trim(),
        date,
        salesChannelId: salesChannelId || null,
        isQualified: qualified,
        isScheduled: isScheduled === true || isScheduled === 'true',
        comment: comment?.trim() || null,
        leadLink: leadLink?.trim() || null,
        subStatus: subStatus || null,
        appointmentDate: appointmentDate || null,
        appointmentTime: appointmentTime || null,
        consultationStatus: consultationStatus || null,
        postponedDate: postponedDate || null,
        postponedTime: postponedTime || null,
        status,
      },
      include: INCLUDE_FULL,
    })
    res.json(lead)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/leads/:id — update lead fields (lider or owner) ─────────────────
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })

    const role = req.user!.role
    const isCreator = lead.createdById === req.user!.id
    const isAssigned = lead.assignedToId === req.user!.id
    const isAdmin = role === 'OWNER' || role === 'ROP'
    if (!isCreator && !isAssigned && !isAdmin) return res.status(403).json({ error: 'Forbidden' })

    const { clientName, phone, date, salesChannelId, isQualified, isScheduled, comment, assignedToId,
            amount, paymentType, paymentMethod, bank, months, crmLink, closerComment,
            leadLink, subStatus, appointmentDate, appointmentTime, consultationStatus, postponedDate, postponedTime } = req.body

    // Recalculate status if qualification or assignment changes
    let status = lead.status as string
    const newQualified = isQualified !== undefined ? (isQualified !== false && isQualified !== 'false') : lead.isQualified
    const newAssigned = assignedToId !== undefined ? assignedToId : lead.assignedToId

    if (isCreator || isAdmin) {
      // Terminal states (sold/refused) are never overridden by lider edits
      if (status !== 'SOLD' && status !== 'REFUSED') {
        if (!newQualified) {
          status = 'UNQUALIFIED'
        } else {
          // Qualified lead: always recalculate based on closer assignment.
          // Closer must accept (ASSIGNED → Новые) every time lider saves.
          status = newAssigned ? 'ASSIGNED' : 'NEW'
        }
      }
    }

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...(clientName !== undefined && { clientName: clientName.trim() }),
        ...(phone !== undefined && { phone: phone.trim() }),
        ...(date !== undefined && { date }),
        ...(salesChannelId !== undefined && { salesChannelId: salesChannelId || null }),
        ...(isQualified !== undefined && { isQualified: newQualified }),
        ...(isScheduled !== undefined && { isScheduled: isScheduled === true || isScheduled === 'true' }),
        ...(comment !== undefined && { comment: comment?.trim() || null }),
        ...(assignedToId !== undefined && { assignedToId: newAssigned || null }),
        // Closer fields
        ...(amount !== undefined && { amount: amount ? Number(amount) : null }),
        ...(paymentType !== undefined && { paymentType: paymentType || null }),
        ...(paymentMethod !== undefined && { paymentMethod: paymentMethod || null }),
        ...(bank !== undefined && { bank: bank?.trim() || null }),
        ...(months !== undefined && { months: months ? Number(months) : null }),
        ...(crmLink !== undefined && { crmLink: crmLink?.trim() || null }),
        ...(closerComment !== undefined && { closerComment: closerComment?.trim() || null }),
        ...(leadLink !== undefined && { leadLink: leadLink?.trim() || null }),
        ...(subStatus !== undefined && { subStatus: subStatus || null }),
        ...(appointmentDate !== undefined && { appointmentDate: appointmentDate || null }),
        ...(appointmentTime !== undefined && { appointmentTime: appointmentTime || null }),
        ...(consultationStatus !== undefined && { consultationStatus: consultationStatus || null }),
        ...(postponedDate !== undefined && { postponedDate: postponedDate || null }),
        ...(postponedTime !== undefined && { postponedTime: postponedTime || null }),
        status: status as any,
      },
      include: INCLUDE_FULL,
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/leads/:id/assign — lider assigns to closer ──────────────────────
router.put('/:id/assign', authenticate, async (req: AuthRequest, res: Response) => {
  const { assignedToId } = req.body
  if (!assignedToId) return res.status(400).json({ error: 'assignedToId required' })
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    if (lead.createdById !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: { assignedToId, status: 'ASSIGNED' },
      include: INCLUDE_FULL,
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/leads/:id/transfer — closer transfers lead to another closer ─────
router.put('/:id/transfer', authenticate, async (req: AuthRequest, res: Response) => {
  const { newCloserId } = req.body
  if (!newCloserId) return res.status(400).json({ error: 'newCloserId required' })
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    // Current assignee OR admin can transfer
    const role = req.user!.role
    if (lead.assignedToId !== req.user!.id && role !== 'OWNER' && role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: { assignedToId: newCloserId, status: 'ASSIGNED' },
      include: INCLUDE_FULL,
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/leads/:id/accept — closer accepts (ASSIGNED → IN_WORK) ───────────
router.put('/:id/accept', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    if (lead.assignedToId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' })
    if (lead.status !== 'ASSIGNED') return res.status(400).json({ error: 'Lead is not in ASSIGNED state' })
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: { status: 'IN_WORK' },
      include: INCLUDE_FULL,
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/leads/:id/refuse — closer refuses (requires CRM link) ───────────
router.put('/:id/refuse', authenticate, async (req: AuthRequest, res: Response) => {
  const { crmLink, lossReasonId } = req.body
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    if (lead.assignedToId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' })
    const finalCrmLink = crmLink?.trim() || lead.crmLink
    if (!finalCrmLink) return res.status(400).json({ error: 'Нужна CRM-ссылка для отказа' })
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        status: 'REFUSED',
        crmLink: finalCrmLink,
        lossReasonId: lossReasonId || null,
        // Auto-mark consultation as not_happened if appointment existed but status wasn't set
        ...(lead.appointmentDate && !lead.consultationStatus && { consultationStatus: 'not_happened' }),
      },
      include: INCLUDE_FULL,
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/leads/:id/sell — closer marks as sold (fills sale details) ───────
router.put('/:id/sell', authenticate, async (req: AuthRequest, res: Response) => {
  const { amount, paymentType, paymentMethod, bank, months, crmLink, closerComment, productId } = req.body
  if (!amount || !paymentType || !paymentMethod) {
    return res.status(400).json({ error: 'amount, paymentType, paymentMethod required' })
  }
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    if (lead.assignedToId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' })

    const numAmount = Number(amount)
    const netAmount = calcNetAmount(numAmount, paymentMethod)

    const [updated] = await Promise.all([
      prisma.lead.update({
        where: { id: req.params.id },
        data: {
          status: 'SOLD',
          amount: numAmount,
          netAmount,
          paymentType, paymentMethod,
          bank: bank?.trim() || null,
          months: months ? Number(months) : null,
          crmLink: crmLink?.trim() || null,
          closerComment: closerComment?.trim() || null,
          productId: productId || null,
          // Auto-mark consultation as happened when lead is sold (if not already set)
          ...(!lead.consultationStatus && { consultationStatus: 'happened' }),
        },
        include: INCLUDE_FULL,
      }),
      // Also upsert a Sale record so it appears in the dashboard
      prisma.sale.upsert({
        where: { leadId: req.params.id },
        create: {
          userId: req.user!.id,
          companyId: req.user!.companyId,
          date: lead.date,
          amount: numAmount,
          netAmount,
          paymentType, paymentMethod,
          bank: bank?.trim() || null,
          months: months ? Number(months) : null,
          crmLink: crmLink?.trim() || null,
          comment: closerComment?.trim() || null,
          leadId: req.params.id,
          productId: productId || null,
        },
        update: {
          date: lead.date,
          amount: numAmount,
          netAmount,
          paymentType, paymentMethod,
          bank: bank?.trim() || null,
          months: months ? Number(months) : null,
          crmLink: crmLink?.trim() || null,
          comment: closerComment?.trim() || null,
          productId: productId || null,
        },
      }),
    ])
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/leads/:id/restore — restore REFUSED lead back to IN_WORK ────────
router.put('/:id/restore', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    if (lead.assignedToId !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: { status: 'IN_WORK' },
      include: INCLUDE_FULL,
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/leads/:id/qualify — move unqualified back to active ──────────────
router.put('/:id/qualify', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    if (lead.createdById !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: { isQualified: true, status: 'NEW' },
      include: INCLUDE_FULL,
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── DELETE /api/leads/:id ─────────────────────────────────────────────────────
// Soft delete — sets status=DELETED + deletedAt, preserves in archive
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    const role = req.user!.role
    if (lead.createdById !== req.user!.id && role !== 'OWNER' && role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    // Soft delete: mark as DELETED to preserve history
    await prisma.lead.update({
      where: { id: req.params.id },
      data: { status: 'DELETED' as any, deletedAt: new Date(), deletedById: req.user!.id },
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── Refund a SOLD lead ─────────────────────────────────────────────────────
router.put('/:id/refund', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    if (lead.assignedToId !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (lead.status !== 'SOLD') return res.status(400).json({ error: 'Только SOLD лид можно вернуть' })
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        isRefund: true,
        refundedAt: new Date(),
        refundComment: req.body.refundComment || null,
      },
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/refunds — returns refunded leads for closer (or all company for ROP/OWNER) ─────
router.get('/refunds', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, period = 'month' } = req.query
  const { fromStr, toStr } = getPeriodStr(period as string, from as string, to as string)
  try {
    const isManager = req.user!.role === 'MANAGER'
    const where: any = {
      isRefund: true,
      status: 'SOLD',
    }
    if (isManager) {
      where.assignedToId = req.user!.id
    } else {
      // ROP/OWNER — filter by company via createdBy
      where.createdBy = { companyId: req.user!.companyId }
    }
    // Filter by refundedAt date range
    where.refundedAt = {
      gte: new Date(fromStr + 'T00:00:00+05:00'),
      lte: new Date(toStr + 'T23:59:59+05:00'),
    }
    const leads = await prisma.lead.findMany({
      where,
      include: INCLUDE_FULL,
      orderBy: { refundedAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/leads/closer-archive — full audit log for closer (all statuses + deleted) ─────────
router.get('/closer-archive', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, period = 'month', search, status } = req.query
  const { fromStr, toStr } = getPeriodStr(period as string, from as string, to as string)
  try {
    const where: any = {
      assignedToId: req.user!.id,
      createdAt: { gte: new Date(fromStr + 'T00:00:00+05:00'), lte: new Date(toStr + 'T23:59:59+05:00') },
    }
    if (search) where.OR = [
      { clientName: { contains: search as string, mode: 'insensitive' } },
      { phone: { contains: search as string } },
    ]
    if (status && status !== 'all') where.status = status as string
    const leads = await prisma.lead.findMany({
      where,
      include: {
        ...INCLUDE_FULL,
        // createdBy included in INCLUDE_FULL
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(leads)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── Helper ────────────────────────────────────────────────────────────────────
function getPeriodStr(period: string, from?: string, to?: string) {
  if (from && to) return { fromStr: from, toStr: to }
  // Use KZ timezone (UTC+5) for all date calculations
  const nowKz = new Date(Date.now() + 5 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const str = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  if (period === 'today') { const s = str(nowKz); return { fromStr: s, toStr: s } }
  if (period === 'yesterday') {
    const y = new Date(nowKz); y.setUTCDate(y.getUTCDate() - 1); const s = str(y)
    return { fromStr: s, toStr: s }
  }
  if (period === 'week') {
    const s = new Date(nowKz); s.setUTCDate(s.getUTCDate() - 7)
    return { fromStr: str(s), toStr: str(nowKz) }
  }
  // month
  const y = nowKz.getUTCFullYear(); const mo = nowKz.getUTCMonth() + 1
  return { fromStr: `${y}-${pad(mo)}-01`, toStr: `${y}-${pad(mo)}-${pad(new Date(y, mo, 0).getDate())}` }
}

export default router
