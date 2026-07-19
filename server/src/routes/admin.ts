import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'secret'

// ─── Super Admin Auth Middleware ───────────────────────────────────────────────
interface AdminRequest extends Request {
  adminId?: string
}

function requireSuperAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any
    if (!payload.superAdmin) return res.status(403).json({ error: 'Forbidden' })
    req.adminId = payload.adminId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// ─── POST /api/admin/login ─────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })

  try {
    const admin = await prisma.superAdmin.findUnique({ where: { email } })
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, admin.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign({ adminId: admin.id, superAdmin: true }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, admin: { id: admin.id, email: admin.email } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', requireSuperAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const [totalCompanies, activeCompanies, totalUsers, activeUsers, totalReports, recentSessions] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.report.count(),
      prisma.userSession.findMany({
        where: { loginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: { userId: true },
      }),
    ])

    const uniqueActiveToday = new Set(recentSessions.map(s => s.userId)).size

    // Companies registered per month (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const companiesByMonth = await prisma.company.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: sixMonthsAgo } },
      _count: true,
    })

    res.json({
      totalCompanies,
      activeCompanies,
      inactiveCompanies: totalCompanies - activeCompanies,
      totalUsers,
      activeUsers,
      totalReports,
      uniqueActiveToday,
      companiesByMonth,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── GET /api/admin/companies ──────────────────────────────────────────────────
router.get('/companies', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, reports: true } },
        users: {
          where: { role: 'OWNER' },
          select: { name: true, email: true, lastLoginAt: true },
          take: 1,
        },
      },
    })
    res.json(companies)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── GET /api/admin/companies/:id ─────────────────────────────────────────────
router.get('/companies/:id', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          select: {
            id: true, name: true, email: true, role: true, managerType: true,
            status: true, lastLoginAt: true, createdAt: true,
            sessions: { orderBy: { loginAt: 'desc' }, take: 5 },
          },
        },
        departments: true,
        _count: { select: { reports: true, plans: true } },
      },
    })
    if (!company) return res.status(404).json({ error: 'Not found' })
    res.json(company)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── PATCH /api/admin/companies/:id ───────────────────────────────────────────
router.patch('/companies/:id', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { isActive, subscriptionPlan, trialEndsAt, notes, name } = req.body
  try {
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(subscriptionPlan !== undefined && { subscriptionPlan }),
        ...(trialEndsAt !== undefined && { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null }),
        ...(notes !== undefined && { notes }),
        ...(name !== undefined && { name }),
      },
    })
    res.json(company)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── POST /api/admin/companies ─────────────────────────────────────────────────
// Manually create company + owner account
router.post('/companies', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { companyName, ownerName, ownerEmail, ownerPassword, subscriptionPlan, trialEndsAt } = req.body
  if (!companyName || !ownerName || !ownerEmail || !ownerPassword) {
    return res.status(400).json({ error: 'Missing fields' })
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email: ownerEmail } })
    if (existing) return res.status(400).json({ error: 'Email already taken' })

    const passwordHash = await bcrypt.hash(ownerPassword, 10)
    const company = await prisma.company.create({
      data: {
        name: companyName,
        subscriptionPlan: subscriptionPlan || 'trial',
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
        users: {
          create: { name: ownerName, email: ownerEmail, passwordHash, role: 'OWNER' },
        },
      },
      include: { users: { where: { role: 'OWNER' } } },
    })
    res.json(company)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { search } = req.query
  try {
    const users = await prisma.user.findMany({
      where: search ? {
        OR: [
          { name: { contains: String(search), mode: 'insensitive' } },
          { email: { contains: String(search), mode: 'insensitive' } },
        ],
      } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, name: true, email: true, role: true, managerType: true,
        status: true, lastLoginAt: true, createdAt: true,
        company: { select: { id: true, name: true, isActive: true } },
      },
    })
    res.json(users)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── PATCH /api/admin/users/:id ───────────────────────────────────────────────
router.patch('/users/:id', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { status, role } = req.body
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(role && { role }),
      },
    })
    res.json(user)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── GET /api/admin/sessions ──────────────────────────────────────────────────
router.get('/sessions', requireSuperAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const sessions = await prisma.userSession.findMany({
      orderBy: { loginAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, company: { select: { name: true } } } },
      },
    })
    res.json(sessions)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
