import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

function getPeriodDates(period: string, from?: string, to?: string) {
  if (from && to) return { fromStr: from, toStr: to }
  const now = new Date()
  if (period === 'today') {
    const s = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return { fromStr: s, toStr: s }
  }
  if (period === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    const s = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
    return { fromStr: s, toStr: s }
  }
  if (period === 'week') {
    const s = new Date(now); s.setDate(s.getDate() - 7)
    return {
      fromStr: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`,
      toStr: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    }
  }
  // month (default)
  const y = now.getFullYear(); const mo = now.getMonth() + 1
  return {
    fromStr: `${y}-${String(mo).padStart(2, '0')}-01`,
    toStr: `${y}-${String(mo).padStart(2, '0')}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`,
  }
}

// GET /api/deal-links — own links for a period (closer)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to, type } = req.query
  const { fromStr, toStr } = getPeriodDates(period as string, from as string, to as string)
  try {
    const where: any = {
      userId: req.user!.id,
      date: { gte: fromStr, lte: toStr },
    }
    if (type) where.type = type
    const links = await prisma.dealLink.findMany({ where, orderBy: { date: 'desc' } })
    res.json(links)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/deal-links/all — all closers' links in company (for ROP/owner)
router.get('/all', authenticate, async (req: AuthRequest, res: Response) => {
  const { period = 'month', from, to, type } = req.query
  const { fromStr, toStr } = getPeriodDates(period as string, from as string, to as string)
  const role = req.user!.role
  if (role !== 'ROP' && role !== 'OWNER') return res.status(403).json({ error: 'Forbidden' })
  try {
    const where: any = {
      companyId: req.user!.companyId,
      date: { gte: fromStr, lte: toStr },
    }
    if (type) where.type = type
    const links = await prisma.dealLink.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ user: { name: 'asc' } }, { date: 'desc' }],
    })
    res.json(links)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/deal-links — add a link
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { type, link, note, date } = req.body
  if (!type || !link || !date) return res.status(400).json({ error: 'type, link, date required' })
  if (!['REFUSAL', 'IN_WORK'].includes(type)) return res.status(400).json({ error: 'Invalid type' })
  try {
    const dl = await prisma.dealLink.create({
      data: {
        userId: req.user!.id,
        companyId: req.user!.companyId,
        type, link, note: note || null, date,
      },
    })
    res.json(dl)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/deal-links/:id — update link/note
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { link, note } = req.body
  if (!link) return res.status(400).json({ error: 'link required' })
  try {
    const dl = await prisma.dealLink.findUnique({ where: { id: req.params.id } })
    if (!dl) return res.status(404).json({ error: 'Not found' })
    if (dl.userId !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const updated = await prisma.dealLink.update({
      where: { id: req.params.id },
      data: { link, note: note || null },
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/deal-links/:id — delete own link
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const dl = await prisma.dealLink.findUnique({ where: { id: req.params.id } })
    if (!dl) return res.status(404).json({ error: 'Not found' })
    if (dl.userId !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await prisma.dealLink.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

export default router
