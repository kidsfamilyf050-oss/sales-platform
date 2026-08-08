import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const GATEWAY_FEE: Record<string, number> = {
  'GetPay': 0.13, 'TipTopPay_KZ': 0.065, 'TipTopPay_Foreign': 0.079,
  'Kaspi_Gold': 0.0395, 'Kaspi_Account': 0.041, 'Kaspi_Credit': 0.165,
  'Kaspi_Red': 0.143, 'Kaspi_Terminal': 0.043, 'Cash': 0.03,
  'Transfer_AE': 0.03, 'Card_Sberbank': 0.03, 'Kaspi_Bookkeeper': 0.03,
}
function calcNet(amount: number, method: string): number {
  const fee = GATEWAY_FEE[method] ?? 0.03
  return Math.round(amount * (1 - fee) * 100) / 100
}

// GET /api/sales?date=YYYY-MM-DD — sales for current user on that date
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const date = req.query.date as string
  if (!date) return res.status(400).json({ error: 'date required' })
  try {
    // Primary: Sales with matching Sale.date OR created on this KZ day (covers wrong-date records)
    const salesByDate = await prisma.sale.findMany({
      where: {
        userId: req.user!.id,
        OR: [
          { date },
          { createdAt: { gte: new Date(date + 'T00:00:00+05:00'), lte: new Date(date + 'T23:59:59+05:00') } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })
    // Fallback: lead-linked Sales where the lead was SOLD on this date (covers old records with wrong date)
    const dayStart = new Date(date + 'T00:00:00+05:00') // KZ timezone
    const dayEnd   = new Date(date + 'T23:59:59+05:00')
    const soldLeadsToday = await prisma.lead.findMany({
      where: { assignedToId: req.user!.id, status: 'SOLD', updatedAt: { gte: dayStart, lte: dayEnd } },
      select: { id: true },
    })
    const soldLeadIds = soldLeadsToday.map(l => l.id)
    const salesByUpdatedAt = soldLeadIds.length > 0
      ? await prisma.sale.findMany({ where: { leadId: { in: soldLeadIds } }, orderBy: { createdAt: 'asc' } })
      : []
    // Merge, deduplicate by sale id
    const saleMap = new Map<string, any>()
    for (const s of [...salesByDate, ...salesByUpdatedAt]) saleMap.set(s.id, s)
    res.json(Array.from(saleMap.values()))
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/sales/company-daily-stats?from=&to= — ROP/OWNER: daily sales stats per closer
// Returns: { userId: { date: { salesAmount, salesCount, clients, consultations } } }
router.get('/company-daily-stats', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as { from: string; to: string }
  if (!from || !to) return res.status(400).json({ error: 'from and to required' })
  try {
    const companyId = req.user!.companyId

    // Sales from Sale model
    const sales = await prisma.sale.findMany({
      where: { companyId, date: { gte: from, lte: to } },
      select: { userId: true, date: true, netAmount: true, amount: true },
    })
    // Leads assigned to closers (for clients count)
    const assignedLeads = await prisma.lead.findMany({
      where: { assignedTo: { companyId }, date: { gte: from, lte: to } },
      select: { assignedToId: true, date: true, status: true, consultationStatus: true },
    })

    const stats: Record<string, Record<string, { salesAmount: number; salesCount: number; clients: number; consultations: number }>> = {}

    for (const s of sales) {
      if (!stats[s.userId]) stats[s.userId] = {}
      if (!stats[s.userId][s.date]) stats[s.userId][s.date] = { salesAmount: 0, salesCount: 0, clients: 0, consultations: 0 }
      stats[s.userId][s.date].salesAmount += s.netAmount ?? s.amount
      stats[s.userId][s.date].salesCount += 1
    }
    for (const l of assignedLeads) {
      if (!l.assignedToId) continue
      if (!stats[l.assignedToId]) stats[l.assignedToId] = {}
      if (!stats[l.assignedToId][l.date]) stats[l.assignedToId][l.date] = { salesAmount: 0, salesCount: 0, clients: 0, consultations: 0 }
      stats[l.assignedToId][l.date].clients += 1
      if (l.consultationStatus === 'happened' || l.status === 'SOLD') {
        stats[l.assignedToId][l.date].consultations += 1
      }
    }

    res.json(stats)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/sales/range?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=... — for dashboard aggregation
router.get('/range', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, userId } = req.query as any
  if (!from || !to) return res.status(400).json({ error: 'from/to required' })
  try {
    const sales = await prisma.sale.findMany({
      where: {
        companyId: req.user!.companyId,
        ...(userId ? { userId } : {}),
        date: { gte: from, lte: to },
      },
      include: { user: { select: { id: true, name: true, managerType: true } } },
      orderBy: { date: 'asc' },
    })
    res.json(sales)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/sales — create a sale
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { date, amount, paymentType, paymentMethod, bank, months, crmLink, comment } = req.body
  if (!date || !amount || !paymentType || !paymentMethod) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  try {
    const numAmount = Number(amount)
    const netAmount = calcNet(numAmount, paymentMethod)
    const sale = await prisma.sale.create({
      data: {
        userId: req.user!.id,
        companyId: req.user!.companyId,
        date,
        amount: numAmount,
        netAmount,
        paymentType,
        paymentMethod,
        bank: bank || null,
        months: months ? Number(months) : null,
        crmLink: crmLink || null,
        comment: comment || null,
      },
    })
    res.json(sale)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/sales/:id — update a sale
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { amount, paymentType, paymentMethod, bank, months, crmLink, comment } = req.body
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!sale) return res.status(404).json({ error: 'Not found' })

    const numAmount = amount !== undefined ? Number(amount) : sale.amount
    const method = paymentMethod || sale.paymentMethod
    const netAmount = calcNet(numAmount, method)
    const updated = await prisma.sale.update({
      where: { id: req.params.id },
      data: {
        ...(amount !== undefined && { amount: numAmount }),
        netAmount,
        ...(paymentType && { paymentType }),
        ...(paymentMethod && { paymentMethod }),
        bank: bank || null,
        months: months ? Number(months) : null,
        crmLink: crmLink || null,
        comment: comment !== undefined ? (comment || null) : undefined,
      },
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/sales/:id/installment — add a доплата (installment) to an existing sale
router.post('/:id/installment', authenticate, async (req: AuthRequest, res: Response) => {
  const { date, amount, paymentMethod, bank, months, comment } = req.body
  if (!date || !amount || !paymentMethod) {
    return res.status(400).json({ error: 'date, amount, paymentMethod required' })
  }
  try {
    // Find the parent sale — must belong to same company (owner/rop can add on behalf of manager)
    const parent = await prisma.sale.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    })
    if (!parent) return res.status(404).json({ error: 'Sale not found' })

    const numAmount = Number(amount)
    const netAmount = calcNet(numAmount, paymentMethod)
    const installment = await prisma.sale.create({
      data: {
        userId:       parent.userId,      // belongs to the same manager
        companyId:    parent.companyId,
        date,
        amount:       numAmount,
        netAmount,
        paymentType:  'additional',
        paymentMethod,
        bank:         bank || null,
        months:       months ? Number(months) : null,
        crmLink:      parent.crmLink || null,  // inherit CRM link from parent
        comment:      comment || null,
        parentSaleId: parent.id,
      },
    })
    res.json(installment)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/sales/:id — delete a sale
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!sale) return res.status(404).json({ error: 'Not found' })
    await prisma.sale.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
