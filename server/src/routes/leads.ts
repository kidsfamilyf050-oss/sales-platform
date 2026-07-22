import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const INCLUDE_FULL = {
  createdBy: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  salesChannel: { select: { id: true, name: true } },
  tasks: { orderBy: { dueDate: 'asc' as const } },
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

// ── POST /api/leads — create lead (lider) ────────────────────────────────────
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { clientName, phone, date, salesChannelId, isQualified, isScheduled, comment, assignedToId } = req.body
  if (!clientName || !phone || !date) return res.status(400).json({ error: 'clientName, phone, date required' })

  const qualified = isQualified !== false && isQualified !== 'false'
  let status: any = qualified ? 'NEW' : 'UNQUALIFIED'
  if (qualified && assignedToId) status = 'ASSIGNED'

  try {
    const lead = await prisma.lead.create({
      data: {
        companyId: req.user!.companyId,
        createdById: req.user!.id,
        assignedToId: (qualified && assignedToId) ? assignedToId : null,
        clientName: clientName.trim(),
        phone: phone.trim(),
        date,
        salesChannelId: salesChannelId || null,
        isQualified: qualified,
        isScheduled: isScheduled === true || isScheduled === 'true',
        comment: comment?.trim() || null,
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
            amount, paymentType, paymentMethod, bank, months, crmLink, closerComment } = req.body

    // Recalculate status if qualification or assignment changes
    let status = lead.status as string
    const newQualified = isQualified !== undefined ? (isQualified !== false && isQualified !== 'false') : lead.isQualified
    const newAssigned = assignedToId !== undefined ? assignedToId : lead.assignedToId

    if (isCreator || isAdmin) {
      if (!newQualified) {
        status = 'UNQUALIFIED'
      } else if (status === 'UNQUALIFIED') {
        status = newAssigned ? 'ASSIGNED' : 'NEW'
      } else if (status === 'NEW' && newAssigned) {
        status = 'ASSIGNED'
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
  const { crmLink } = req.body
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    if (lead.assignedToId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' })
    const finalCrmLink = crmLink?.trim() || lead.crmLink
    if (!finalCrmLink) return res.status(400).json({ error: 'Нужна CRM-ссылка для отказа' })
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: { status: 'REFUSED', crmLink: finalCrmLink },
      include: INCLUDE_FULL,
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── PUT /api/leads/:id/sell — closer marks as sold (fills sale details) ───────
router.put('/:id/sell', authenticate, async (req: AuthRequest, res: Response) => {
  const { amount, paymentType, paymentMethod, bank, months, crmLink, closerComment } = req.body
  if (!amount || !paymentType || !paymentMethod) {
    return res.status(400).json({ error: 'amount, paymentType, paymentMethod required' })
  }
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    if (lead.assignedToId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' })

    const [updated] = await Promise.all([
      prisma.lead.update({
        where: { id: req.params.id },
        data: {
          status: 'SOLD',
          amount: Number(amount),
          paymentType, paymentMethod,
          bank: bank?.trim() || null,
          months: months ? Number(months) : null,
          crmLink: crmLink?.trim() || null,
          closerComment: closerComment?.trim() || null,
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
          amount: Number(amount),
          paymentType, paymentMethod,
          bank: bank?.trim() || null,
          months: months ? Number(months) : null,
          crmLink: crmLink?.trim() || null,
          comment: closerComment?.trim() || null,
          leadId: req.params.id,
        },
        update: {
          date: lead.date,
          amount: Number(amount),
          paymentType, paymentMethod,
          bank: bank?.trim() || null,
          months: months ? Number(months) : null,
          crmLink: crmLink?.trim() || null,
          comment: closerComment?.trim() || null,
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
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead) return res.status(404).json({ error: 'Not found' })
    const role = req.user!.role
    if (lead.createdById !== req.user!.id && role !== 'OWNER' && role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await prisma.lead.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// ── Helper ────────────────────────────────────────────────────────────────────
function getPeriodStr(period: string, from?: string, to?: string) {
  if (from && to) return { fromStr: from, toStr: to }
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const str = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (period === 'today') { const s = str(now); return { fromStr: s, toStr: s } }
  if (period === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); const s = str(y); return { fromStr: s, toStr: s } }
  if (period === 'week') { const s = new Date(now); s.setDate(s.getDate() - 7); return { fromStr: str(s), toStr: str(now) } }
  // month
  const y = now.getFullYear(); const mo = now.getMonth() + 1
  return { fromStr: `${y}-${pad(mo)}-01`, toStr: `${y}-${pad(mo)}-${pad(new Date(y, mo, 0).getDate())}` }
}

export default router
