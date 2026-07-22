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
  adminEmail?: string
}

function requireSuperAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any
    if (!payload.superAdmin) return res.status(403).json({ error: 'Forbidden' })
    req.adminId = payload.adminId
    req.adminEmail = payload.adminEmail
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// ─── Audit helper ─────────────────────────────────────────────────────────────
async function writeAudit(data: {
  action: string; description: string; adminEmail?: string;
  targetId?: string; targetType?: string; oldValue?: string; newValue?: string;
  companyId?: string; companyName?: string;
}) {
  await prisma.auditLog.create({ data }).catch(console.error)
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

    const token = jwt.sign({ adminId: admin.id, adminEmail: admin.email, superAdmin: true }, JWT_SECRET, { expiresIn: '7d' })
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

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const companiesByMonth = await prisma.company.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: sixMonthsAgo } },
      _count: true,
    })

    res.json({
      totalCompanies, activeCompanies,
      inactiveCompanies: totalCompanies - activeCompanies,
      totalUsers, activeUsers, totalReports, uniqueActiveToday, companiesByMonth,
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
        _count: { select: { users: true } },
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
            status: true, lastLoginAt: true, lastSeenAt: true, createdAt: true,
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
    const before = await prisma.company.findUnique({ where: { id: req.params.id }, select: { name: true, isActive: true, subscriptionPlan: true, trialEndsAt: true } })

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

    // Audit logging
    const adminEmail = req.adminEmail || 'admin'
    if (isActive !== undefined && before?.isActive !== isActive) {
      await writeAudit({
        action: isActive ? 'COMPANY_ACTIVATED' : 'COMPANY_BLOCKED',
        description: `${isActive ? 'Активировал' : 'Заблокировал'} компанию "${company.name}"`,
        adminEmail, targetId: company.id, targetType: 'company',
        oldValue: before?.isActive ? 'активна' : 'заблокирована',
        newValue: isActive ? 'активна' : 'заблокирована',
        companyId: company.id, companyName: company.name,
      })
    }
    if (subscriptionPlan !== undefined && before?.subscriptionPlan !== subscriptionPlan) {
      await writeAudit({
        action: 'COMPANY_PLAN_CHANGED',
        description: `Изменил тариф компании "${company.name}": ${before?.subscriptionPlan || '—'} → ${subscriptionPlan}`,
        adminEmail, targetId: company.id, targetType: 'company',
        oldValue: before?.subscriptionPlan || '—', newValue: subscriptionPlan,
        companyId: company.id, companyName: company.name,
      })
    }
    if (trialEndsAt !== undefined) {
      const oldDate = before?.trialEndsAt ? new Date(before.trialEndsAt).toLocaleDateString('ru') : '—'
      const newDate = trialEndsAt ? new Date(trialEndsAt).toLocaleDateString('ru') : '—'
      if (oldDate !== newDate) {
        await writeAudit({
          action: 'COMPANY_ACCESS_DATE_CHANGED',
          description: `Изменил дату доступа компании "${company.name}": ${oldDate} → ${newDate}`,
          adminEmail, targetId: company.id, targetType: 'company',
          oldValue: oldDate, newValue: newDate,
          companyId: company.id, companyName: company.name,
        })
      }
    }

    res.json(company)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── POST /api/admin/companies ─────────────────────────────────────────────────
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

    await writeAudit({
      action: 'COMPANY_CREATED',
      description: `Создал компанию "${companyName}" (владелец: ${ownerEmail}, тариф: ${subscriptionPlan || 'trial'})`,
      adminEmail: req.adminEmail || 'admin',
      targetId: company.id, targetType: 'company',
      companyId: company.id, companyName: companyName,
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
        status: true, lastLoginAt: true, lastSeenAt: true, createdAt: true,
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
  const { status, role, name, email, phone, managerType, newPassword } = req.body
  try {
    const before = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { name: true, email: true, role: true, status: true, managerType: true, company: { select: { id: true, name: true } } },
    })

    let passwordHash: string | undefined
    if (newPassword) passwordHash = await bcrypt.hash(newPassword, 10)

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing && existing.id !== req.params.id) {
        return res.status(400).json({ error: 'Email уже занят другим пользователем' })
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(role !== undefined && { role }),
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(managerType !== undefined && { managerType: managerType || null }),
        ...(passwordHash !== undefined && { passwordHash }),
      },
      select: {
        id: true, name: true, email: true, role: true, managerType: true,
        status: true, phone: true, lastLoginAt: true, lastSeenAt: true, createdAt: true,
        company: { select: { id: true, name: true, isActive: true } },
      },
    })

    const adminEmail = req.adminEmail || 'admin'
    const companyId = before?.company?.id
    const companyName = before?.company?.name

    if (status !== undefined && before?.status !== status) {
      await writeAudit({
        action: status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_BLOCKED',
        description: `${status === 'ACTIVE' ? 'Разблокировал' : 'Заблокировал'} пользователя "${before?.name || ''}" (${before?.email || ''})`,
        adminEmail, targetId: req.params.id, targetType: 'user',
        oldValue: before?.status, newValue: status,
        companyId, companyName,
      })
    }
    if (role !== undefined && before?.role !== role) {
      await writeAudit({
        action: 'USER_ROLE_CHANGED',
        description: `Изменил роль "${before?.name || ''}" (${before?.email || ''}): ${before?.role} → ${role}${managerType ? ' (' + managerType + ')' : ''}`,
        adminEmail, targetId: req.params.id, targetType: 'user',
        oldValue: before?.role, newValue: role + (managerType ? `/${managerType}` : ''),
        companyId, companyName,
      })
    }
    if (newPassword) {
      await writeAudit({
        action: 'USER_PASSWORD_RESET',
        description: `Сбросил пароль пользователя "${before?.name || ''}" (${before?.email || ''})`,
        adminEmail, targetId: req.params.id, targetType: 'user',
        companyId, companyName,
      })
    }
    if (name !== undefined && before?.name !== name) {
      await writeAudit({
        action: 'USER_NAME_CHANGED',
        description: `Переименовал пользователя "${before?.name}" → "${name}"`,
        adminEmail, targetId: req.params.id, targetType: 'user',
        oldValue: before?.name, newValue: name,
        companyId, companyName,
      })
    }

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

// ─── GET /api/admin/audit-logs ────────────────────────────────────────────────
router.get('/audit-logs', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { from, to, companyId, search, page = '1', limit = '50' } = req.query
  const skip = (parseInt(String(page)) - 1) * parseInt(String(limit))
  try {
    const where: any = {}
    if (from || to) {
      where.createdAt = {
        ...(from && { gte: new Date(String(from)) }),
        ...(to && { lte: new Date(String(to) + 'T23:59:59Z') }),
      }
    }
    if (companyId) where.companyId = String(companyId)
    if (search) {
      where.OR = [
        { description: { contains: String(search), mode: 'insensitive' } },
        { adminEmail: { contains: String(search), mode: 'insensitive' } },
        { companyName: { contains: String(search), mode: 'insensitive' } },
      ]
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: parseInt(String(limit)) }),
      prisma.auditLog.count({ where }),
    ])

    res.json({ logs, total, page: parseInt(String(page)), limit: parseInt(String(limit)) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── DELETE /api/admin/audit-logs ─────────────────────────────────────────────
router.delete('/audit-logs', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { from, to } = req.body
  try {
    const where: any = {}
    if (from || to) {
      where.createdAt = {
        ...(from && { gte: new Date(String(from)) }),
        ...(to && { lte: new Date(String(to) + 'T23:59:59Z') }),
      }
    }
    const { count } = await prisma.auditLog.deleteMany({ where })

    await writeAudit({
      action: 'AUDIT_LOGS_CLEARED',
      description: `Очистил историю изменений за период ${from || '—'} — ${to || '—'} (удалено ${count} записей)`,
      adminEmail: req.adminEmail || 'admin',
    })

    res.json({ deleted: count })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── POST /api/admin/reset-all-data ───────────────────────────────────────────
// Deletes ALL Sales, Reports, and DealLinks across every company. Plans, Users,
// Leads, LeadTasks, SalesChannels and everything else are kept intact.
router.post('/reset-all-data', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { confirm } = req.body
  if (confirm !== 'RESET_ALL') return res.status(400).json({ error: 'Передайте confirm: "RESET_ALL"' })
  try {
    const [sales, reports, dealLinks] = await Promise.all([
      prisma.sale.deleteMany({}),
      prisma.report.deleteMany({}),
      prisma.dealLink.deleteMany({}),
    ])

    await writeAudit({
      action: 'GLOBAL_DATA_RESET',
      description: `Глобальный сброс данных: удалено ${sales.count} продаж, ${reports.count} отчётов, ${dealLinks.count} CRM-ссылок`,
      adminEmail: req.adminEmail || 'admin',
    })

    res.json({ ok: true, deleted: { sales: sales.count, reports: reports.count, dealLinks: dealLinks.count } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
