import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/sales?date=YYYY-MM-DD — sales for current user on that date
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const date = req.query.date as string
  if (!date) return res.status(400).json({ error: 'date required' })
  try {
    const sales = await prisma.sale.findMany({
      where: { userId: req.user!.id, date },
      orderBy: { createdAt: 'asc' },
    })
    res.json(sales)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
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
  const { date, amount, paymentType, paymentMethod, bank, months, crmLink } = req.body
  if (!date || !amount || !paymentType || !paymentMethod) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  try {
    const sale = await prisma.sale.create({
      data: {
        userId: req.user!.id,
        companyId: req.user!.companyId,
        date,
        amount: Number(amount),
        paymentType,
        paymentMethod,
        bank: bank || null,
        months: months ? Number(months) : null,
        crmLink: crmLink || null,
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
  const { amount, paymentType, paymentMethod, bank, months, crmLink } = req.body
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!sale) return res.status(404).json({ error: 'Not found' })

    const updated = await prisma.sale.update({
      where: { id: req.params.id },
      data: {
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(paymentType && { paymentType }),
        ...(paymentMethod && { paymentMethod }),
        bank: bank || null,
        months: months ? Number(months) : null,
        crmLink: crmLink || null,
      },
    })
    res.json(updated)
  } catch (e) {
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
