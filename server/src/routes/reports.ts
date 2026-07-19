import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// Submit daily report
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { date, type, data, comment, departmentId } = req.body
  if (!date || !type || !data) return res.status(400).json({ error: 'Missing fields' })

  const reportDate = new Date(date)
  reportDate.setHours(0, 0, 0, 0)

  try {
    const report = await prisma.report.upsert({
      where: { date_userId_type: { date: reportDate, userId: req.user!.id, type } },
      update: { data, comment, departmentId },
      create: { date: reportDate, userId: req.user!.id, type, data, comment, departmentId: departmentId || req.user!.departmentId },
    })
    res.json(report)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get my reports
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, limit } = req.query
  try {
    const where: any = { userId: req.user!.id }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from as string)
      if (to) where.date.lte = new Date(to as string)
    }
    const reports = await prisma.report.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit ? parseInt(limit as string) : 30,
    })
    res.json(reports)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Check today's report status
router.get('/my/today', authenticate, async (req: AuthRequest, res: Response) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  try {
    const report = await prisma.report.findFirst({ where: { userId: req.user!.id, date: today } })
    res.json({ submitted: !!report, report })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Get reports for department (ROP/OWNER)
router.get('/department/:departmentId', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to, userId } = req.query
  try {
    const dept = await prisma.department.findFirst({ where: { id: req.params.departmentId, companyId: req.user!.companyId } })
    if (!dept) return res.status(404).json({ error: 'Not found' })

    const where: any = { departmentId: req.params.departmentId }
    if (userId) where.userId = userId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from as string)
      if (to) where.date.lte = new Date(to as string)
    }

    const reports = await prisma.report.findMany({
      where,
      include: { user: { select: { id: true, name: true, role: true, managerType: true } } },
      orderBy: { date: 'desc' },
    })
    res.json(reports)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Get user's report history (for ROP to view individual manager)
router.get('/user/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query
  try {
    const target = await prisma.user.findFirst({ where: { id: req.params.userId, companyId: req.user!.companyId } })
    if (!target) return res.status(404).json({ error: 'Not found' })

    const where: any = { userId: req.params.userId }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from as string)
      if (to) where.date.lte = new Date(to as string)
    }

    const reports = await prisma.report.findMany({ where, orderBy: { date: 'desc' }, take: 60 })
    res.json(reports)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
