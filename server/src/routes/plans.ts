import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// Get plans for current period
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { period, departmentId, userId } = req.query
  try {
    const where: any = { companyId: req.user!.companyId }
    if (period) where.period = period
    if (departmentId) where.departmentId = departmentId as string
    if (userId) where.userId = userId as string

    const plans = await prisma.plan.findMany({ where })
    res.json(plans)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Upsert plan
router.post('/', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { period, type, value, departmentId, userId } = req.body
  if (!period || !type || value === undefined) return res.status(400).json({ error: 'Missing fields' })

  try {
    // Check if old value exists for changelog
    const existing = await prisma.plan.findFirst({
      where: { period, type, companyId: req.user!.companyId, departmentId: departmentId || null, userId: userId || null },
    })

    const plan = await prisma.plan.upsert({
      where: {
        period_type_companyId_departmentId_userId: {
          period, type, companyId: req.user!.companyId,
          departmentId: departmentId || null,
          userId: userId || null,
        },
      },
      update: { value },
      create: { period, type, value, companyId: req.user!.companyId, departmentId: departmentId || null, userId: userId || null },
    })

    // Log change
    if (existing && existing.value !== value) {
      await prisma.planChange.create({
        data: { planId: plan.id, userId: req.user!.id, oldValue: existing.value, newValue: value },
      })
    }

    res.json(plan)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Bulk upsert plans (for onboarding)
router.post('/bulk', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { period, plans } = req.body // plans: [{type, value, departmentId?, userId?}]
  if (!period || !plans?.length) return res.status(400).json({ error: 'Missing fields' })

  try {
    const results = await Promise.all(
      plans.map(async (p: { type: string; value: number; departmentId?: string; userId?: string }) => {
        return prisma.plan.upsert({
          where: {
            period_type_companyId_departmentId_userId: {
              period, type: p.type, companyId: req.user!.companyId,
              departmentId: p.departmentId || null,
              userId: p.userId || null,
            },
          },
          update: { value: p.value },
          create: { period, type: p.type, value: p.value, companyId: req.user!.companyId, departmentId: p.departmentId || null, userId: p.userId || null },
        })
      })
    )
    res.json(results)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get plan change history
router.get('/changes', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { departmentId } = req.query
  try {
    const changes = await prisma.planChange.findMany({
      where: {
        plan: { companyId: req.user!.companyId, ...(departmentId && { departmentId: departmentId as string }) },
      },
      include: { plan: true, user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(changes)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
