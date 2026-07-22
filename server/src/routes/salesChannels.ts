import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/sales-channels — list all for company
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const channels = await prisma.salesChannel.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { createdAt: 'asc' },
    })
    res.json(channels)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/sales-channels — create
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  try {
    const ch = await prisma.salesChannel.create({
      data: { name: name.trim(), companyId: req.user!.companyId },
    })
    res.json(ch)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/sales-channels/:id — rename
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  try {
    const ch = await prisma.salesChannel.findUnique({ where: { id: req.params.id } })
    if (!ch) return res.status(404).json({ error: 'Not found' })
    if (ch.companyId !== req.user!.companyId) return res.status(403).json({ error: 'Forbidden' })
    const updated = await prisma.salesChannel.update({
      where: { id: req.params.id },
      data: { name: name.trim() },
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/sales-channels/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ch = await prisma.salesChannel.findUnique({ where: { id: req.params.id } })
    if (!ch) return res.status(404).json({ error: 'Not found' })
    if (ch.companyId !== req.user!.companyId) return res.status(403).json({ error: 'Forbidden' })
    await prisma.salesChannel.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

export default router
