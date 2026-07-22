import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const TASK_INCLUDE = {
  lead: {
    select: {
      id: true, clientName: true, phone: true, status: true,
      salesChannel: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  },
  createdBy: { select: { id: true, name: true, role: true } },
} as const

// GET /api/lead-tasks — my tasks (assigned to me)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { completed } = req.query
  try {
    const where: any = { userId: req.user!.id }
    if (completed !== undefined) where.completed = completed === 'true'
    const tasks = await prisma.leadTask.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    })
    res.json(tasks)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/lead-tasks/team — ROP/OWNER: all tasks for company team members
router.get('/team', authenticate, async (req: AuthRequest, res: Response) => {
  const { completed, userId } = req.query
  if (req.user!.role !== 'ROP' && req.user!.role !== 'OWNER') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const where: any = {
      user: { companyId: req.user!.companyId },
    }
    if (completed !== undefined) where.completed = completed === 'true'
    if (userId) where.userId = userId as string
    const tasks = await prisma.leadTask.findMany({
      where,
      include: {
        ...TASK_INCLUDE,
        user: { select: { id: true, name: true, managerType: true } },
      },
      orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    })
    res.json(tasks)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/lead-tasks — create task (self or ROP assigns to team member)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { leadId, title, dueDate, userId: targetUserId } = req.body
  if (!title?.trim() || !dueDate) return res.status(400).json({ error: 'title и dueDate обязательны' })

  try {
    // Determine who the task is assigned to
    const isRopOrOwner = req.user!.role === 'ROP' || req.user!.role === 'OWNER'
    let assignedUserId = req.user!.id
    let createdById: string | null = null

    if (targetUserId && targetUserId !== req.user!.id) {
      if (!isRopOrOwner) return res.status(403).json({ error: 'Forbidden' })
      // Verify target user is in same company
      const target = await prisma.user.findUnique({ where: { id: targetUserId } })
      if (!target || target.companyId !== req.user!.companyId) {
        return res.status(404).json({ error: 'User not found' })
      }
      assignedUserId = targetUserId
      createdById = req.user!.id
    }

    // If leadId provided, verify the lead
    if (leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } })
      if (!lead) return res.status(404).json({ error: 'Lead not found' })
      if (lead.assignedToId !== assignedUserId && !isRopOrOwner) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    const task = await prisma.leadTask.create({
      data: {
        leadId: leadId || null,
        userId: assignedUserId,
        createdById,
        title: title.trim(),
        dueDate,
        completed: false,
      },
      include: {
        ...TASK_INCLUDE,
        user: { select: { id: true, name: true, managerType: true } },
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
    // Allow: assignee, creator (ROP), OWNER/ROP
    const isAllowed = task.userId === req.user!.id
      || task.createdById === req.user!.id
      || req.user!.role === 'OWNER'
      || req.user!.role === 'ROP'
    if (!isAllowed) return res.status(403).json({ error: 'Forbidden' })
    const { completed, title, dueDate } = req.body
    const updated = await prisma.leadTask.update({
      where: { id: req.params.id },
      data: {
        ...(completed !== undefined && { completed: completed === true || completed === 'true' }),
        ...(title !== undefined && { title: title.trim() }),
        ...(dueDate !== undefined && { dueDate }),
      },
      include: TASK_INCLUDE,
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
    const isAllowed = task.userId === req.user!.id
      || task.createdById === req.user!.id
      || req.user!.role === 'OWNER'
      || req.user!.role === 'ROP'
    if (!isAllowed) return res.status(403).json({ error: 'Forbidden' })
    await prisma.leadTask.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

export default router
