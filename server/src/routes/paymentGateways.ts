import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const DEFAULT_GATEWAYS = [
  { name: 'GetPay',                                   value: 'GetPay',            feePct: 0.13,   sortOrder: 0 },
  { name: 'Tip Top Pay (карта КЗ)',                   value: 'TipTopPay_KZ',      feePct: 0.065,  sortOrder: 1 },
  { name: 'Tip Top Pay (карта зарубежного банка)',    value: 'TipTopPay_Foreign',  feePct: 0.079,  sortOrder: 2 },
  { name: 'Каспи Пэй (GOLD)',                         value: 'Kaspi_Gold',         feePct: 0.0395, sortOrder: 3 },
  { name: 'Каспи Пэй (Счет в Kaspi Pay)',             value: 'Kaspi_Account',      feePct: 0.041,  sortOrder: 4 },
  { name: 'Каспи Пэй (CREDIT)',                       value: 'Kaspi_Credit',       feePct: 0.165,  sortOrder: 5 },
  { name: 'Каспи Пэй (RED)',                          value: 'Kaspi_Red',          feePct: 0.143,  sortOrder: 6 },
  { name: 'Apple Pay / Google Pay Терминал Каспи',   value: 'Kaspi_Terminal',     feePct: 0.043,  sortOrder: 7 },
  { name: 'Наличные',                                 value: 'Cash',               feePct: 0.03,   sortOrder: 8 },
  { name: 'Перевод на карту АЕ',                      value: 'Transfer_AE',        feePct: 0.03,   sortOrder: 9 },
  { name: 'Карта / СберБанк',                         value: 'Card_Sberbank',      feePct: 0.03,   sortOrder: 10 },
  { name: 'Каспи счет (через бухгалтера)',            value: 'Kaspi_Bookkeeper',   feePct: 0.03,   sortOrder: 11 },
]

// GET /api/payment-gateways — all gateways for company (seeds defaults if none exist)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.paymentGateway.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    if (existing.length === 0) {
      // Seed defaults for this company
      await prisma.paymentGateway.createMany({
        data: DEFAULT_GATEWAYS.map(g => ({ ...g, companyId: req.user!.companyId })),
        skipDuplicates: true,
      })
      const seeded = await prisma.paymentGateway.findMany({
        where: { companyId: req.user!.companyId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      return res.json(seeded)
    }

    res.json(existing)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/payment-gateways — create new gateway
router.post('/', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { name, value, feePct, isActive } = req.body
  if (!name?.trim() || !value?.trim()) return res.status(400).json({ error: 'name и value обязательны' })

  try {
    const maxOrder = await prisma.paymentGateway.aggregate({
      where: { companyId: req.user!.companyId },
      _max: { sortOrder: true },
    })
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1

    const gw = await prisma.paymentGateway.create({
      data: {
        companyId: req.user!.companyId,
        name: name.trim(),
        value: value.trim(),
        feePct: feePct !== undefined ? Number(feePct) : 0.03,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        sortOrder,
      },
    })
    res.json(gw)
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(400).json({ error: 'Шлюз с таким value уже существует' })
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/payment-gateways/:id — update
router.put('/:id', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  try {
    const gw = await prisma.paymentGateway.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    })
    if (!gw) return res.status(404).json({ error: 'Not found' })

    const { name, feePct, isActive, sortOrder } = req.body
    const updated = await prisma.paymentGateway.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(feePct !== undefined && { feePct: Number(feePct) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      },
    })
    res.json(updated)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/payment-gateways/:id
router.delete('/:id', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  try {
    const gw = await prisma.paymentGateway.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    })
    if (!gw) return res.status(404).json({ error: 'Not found' })

    await prisma.paymentGateway.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
