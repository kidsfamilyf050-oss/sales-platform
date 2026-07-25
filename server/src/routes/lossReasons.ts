import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/loss-reasons — list all loss reasons for company
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const reasons = await prisma.lossReason.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { createdAt: 'asc' },
    })
    res.json(reasons)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/loss-reasons — create reason (OWNER/ROP only)
router.post('/', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  try {
    const reason = await prisma.lossReason.create({
      data: { name: name.trim(), companyId: req.user!.companyId },
    })
    res.json(reason)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/loss-reasons/:id — update reason (OWNER/ROP only)
router.put('/:id', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  try {
    const reason = await prisma.lossReason.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    })
    if (!reason) return res.status(404).json({ error: 'Not found' })

    const updated = await prisma.lossReason.update({
      where: { id: req.params.id },
      data: { name: name.trim() },
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/loss-reasons/:id — delete reason (OWNER/ROP only)
router.delete('/:id', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  try {
    const reason = await prisma.lossReason.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    })
    if (!reason) return res.status(404).json({ error: 'Not found' })

    await prisma.lossReason.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

export default router
