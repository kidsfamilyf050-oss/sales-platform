import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/lead-tasks — closer's tasks (active by default)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { completed } = req.query
  try {
    const where: any = { userId: req.user!.id }
    if (completed !== undefined) where.completed = completed === 'true'
    const tasks = await prisma.leadTask.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true, clientName: true, phone: true, status: true,
            salesChannel: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        },
      },
      orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }],
    })
    res.json(tasks)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/lead-tasks — create task
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { leadId, title, dueDate } = req.body
  if (!leadId || !title || !dueDate) return res.status(400).json({ error: 'leadId, title, dueDate required' })
  try {
    // Verify lead is assigned to this user
    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead) return res.status(404).json({ error: 'Lead not found' })
    if (lead.assignedToId !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const task = await prisma.leadTask.create({
      data: { leadId, userId: req.user!.id, title: title.trim(), dueDate, completed: false },
      include: {
        lead: { select: { id: true, clientName: true, phone: true, status: true } },
      },
    })
    res.json(task)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/lead-tasks/:id — update (toggle complete, change title/date)
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const task = await prisma.leadTask.findUnique({ where: { id: req.params.id } })
    if (!task) return res.status(404).json({ error: 'Not found' })
    if (task.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' })
    const { completed, title, dueDate } = req.body
    const updated = await prisma.leadTask.update({
      where: { id: req.params.id },
      data: {
        ...(completed !== undefined && { completed: completed === true || completed === 'true' }),
        ...(title !== undefined && { title: title.trim() }),
        ...(dueDate !== undefined && { dueDate }),
      },
      include: {
        lead: { select: { id: true, clientName: true, phone: true, status: true } },
      },
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/lead-tasks/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const task = await prisma.leadTask.findUnique({ where: { id: req.params.id } })
    if (!task) return res.status(404).json({ error: 'Not found' })
    if (task.userId !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ROP') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await prisma.leadTask.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

export default router
