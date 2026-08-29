import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { sendAccessApprovedEmail } from '../services/email.service'

const router = Router()
const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET!  // must be set in Railway env vars — server refuses to start without it

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

    const token = jwt.sign({ adminId: admin.id, adminEmail: admin.email, superAdmin: true }, JWT_SECRET, { expiresIn: '24h' })
    res.json({ token, admin: { id: admin.id, email: admin.email } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', requireSuperAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const in7Days  = new Date(now.getTime() +  7 * 24 * 60 * 60 * 1000)

    // Последние 6 месяцев для помесячной выручки
    const monthsRange: { label: string; from: Date; to: Date }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const from = new Date(d.getFullYear(), d.getMonth(), 1)
      const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const label = from.toLocaleString('ru', { month: 'long', year: 'numeric' })
      monthsRange.push({ label, from, to })
    }

    const [
      totalCompanies, activeCompanies, totalUsers, activeUsers, totalReports, recentSessions,
      companiesExpiringSoon, companiesExpired,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.report.count(),
      prisma.userSession.findMany({
        where: { loginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: { userId: true },
      }),
      prisma.company.findMany({
        where: { isActive: true, trialEndsAt: { gte: now, lte: in30Days } },
        select: {
          id: true, name: true, trialEndsAt: true, subscriptionPlan: true, paidAt: true, paidAmount: true,
          users: { where: { role: 'OWNER' }, select: { name: true, email: true }, take: 1 },
          payments: { orderBy: { periodTo: 'desc' }, take: 1, select: { periodTo: true, amount: true, months: true } },
        },
        orderBy: { trialEndsAt: 'asc' },
      }),
      prisma.company.count({ where: { isActive: true, trialEndsAt: { lt: now } } }),
    ])

    // Помесячная выручка из Payment
    const revenueByMonth = await Promise.all(monthsRange.map(async m => {
      const agg = await prisma.payment.aggregate({
        where: { paidAt: { gte: m.from, lte: m.to } },
        _sum: { amount: true },
        _count: true,
      })
      return { label: m.label, amount: agg._sum.amount || 0, count: agg._count }
    }))

    // Активные платящие клиенты (у которых есть хоть один Payment)
    const paidCompanyIds = await prisma.payment.findMany({
      distinct: ['companyId'],
      select: { companyId: true },
    })
    const paidCompanies = paidCompanyIds.length

    // MRR — сумма платежей за текущий месяц
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const revenueThisMonthAgg = await prisma.payment.aggregate({
      where: { paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    })
    const revenueThisMonth = revenueThisMonthAgg._sum.amount || 0

    // ARR/MRR: сумма активных подписок (последний платёж каждой активной компании / месяцы * 1)
    const latestPayments = await prisma.payment.findMany({
      where: { company: { isActive: true } },
      orderBy: { paidAt: 'desc' },
      distinct: ['companyId'],
      select: { amount: true, months: true },
    })
    const mrr = latestPayments.reduce((s, p) => s + (p.amount / (p.months || 1)), 0)

    const uniqueActiveToday = new Set(recentSessions.map(s => s.userId)).size
    const expiringSoon = companiesExpiringSoon.map(c => ({
      ...c,
      urgent: c.trialEndsAt ? new Date(c.trialEndsAt) <= in7Days : false,
    }))

    res.json({
      totalCompanies, activeCompanies,
      inactiveCompanies: totalCompanies - activeCompanies,
      totalUsers, activeUsers, totalReports, uniqueActiveToday,
      paidCompanies, companiesExpired,
      revenueThisMonth, mrr,
      revenueByMonth,
      expiringSoon,
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
    // Добавляем поля оплаты — они уже в модели, просто возвращаем как есть
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
            accessExpiresAt: true,
            sessions: { orderBy: { loginAt: 'desc' }, take: 5 },
          },
        },
        departments: true,
        _count: { select: { plans: true, leads: true } },
      },
    })
    if (!company) return res.status(404).json({ error: 'Not found' })
    res.json(company)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── GET /api/admin/companies/:id/payments ────────────────────────────────────
router.get('/companies/:id/payments', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { companyId: req.params.id },
      orderBy: { paidAt: 'desc' },
    })
    res.json(payments)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── DELETE /api/admin/companies/:id/payments/:paymentId ──────────────────────
router.delete('/companies/:id/payments/:paymentId', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    await prisma.payment.delete({ where: { id: req.params.paymentId } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// ─── PATCH /api/admin/companies/:id ───────────────────────────────────────────
router.patch('/companies/:id', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { isActive, subscriptionPlan, trialEndsAt, notes, name, paidAt, paidAmount, paymentNote, months } = req.body
  try {
    const before = await prisma.company.findUnique({
      where: { id: req.params.id },
      select: { name: true, isActive: true, subscriptionPlan: true, trialEndsAt: true, paidAt: true, paidAmount: true },
    })

    // Если фиксируем оплату с указанием периода — автоматически продлеваем trialEndsAt
    let newTrialEndsAt = trialEndsAt !== undefined ? (trialEndsAt ? new Date(trialEndsAt) : null) : undefined
    let periodFrom: Date | undefined
    let periodTo: Date | undefined

    if (paidAt && months) {
      const m = Number(months) || 1
      // Начало периода = max(сегодня, текущий trialEndsAt)
      const base = before?.trialEndsAt && new Date(before.trialEndsAt) > new Date()
        ? new Date(before.trialEndsAt)
        : new Date(paidAt)
      periodFrom = base
      periodTo = new Date(base)
      periodTo.setMonth(periodTo.getMonth() + m)
      // Автоматически обновляем trialEndsAt если не передан явно
      if (trialEndsAt === undefined) newTrialEndsAt = periodTo
    }

    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(subscriptionPlan !== undefined && { subscriptionPlan }),
        ...(newTrialEndsAt !== undefined && { trialEndsAt: newTrialEndsAt }),
        ...(notes !== undefined && { notes }),
        ...(name !== undefined && { name }),
        ...(paidAt !== undefined && { paidAt: paidAt ? new Date(paidAt) : null }),
        ...(paidAmount !== undefined && { paidAmount: paidAmount ? Number(paidAmount) : null }),
        ...(paymentNote !== undefined && { paymentNote }),
      },
    })

    // Создаём запись в истории платежей
    if (paidAt && paidAmount && periodFrom && periodTo) {
      await prisma.payment.create({
        data: {
          companyId: company.id,
          amount: Number(paidAmount),
          paidAt: new Date(paidAt),
          periodFrom,
          periodTo,
          months: Number(months) || 1,
          note: paymentNote || null,
        },
      })
    }

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

      // Если компания активирована — отправляем письмо владельцу (OWNER)
      if (isActive) {
        const owner = await prisma.user.findFirst({
          where: { companyId: company.id, role: 'OWNER' },
          select: { email: true, name: true },
        })
        if (owner) {
          sendAccessApprovedEmail(owner.email, owner.name, company.name).catch((err) => {
            console.error('[EMAIL] Access approved email failed:', err)
          })
        }
      }
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
    if (paidAt !== undefined && paidAt) {
      await writeAudit({
        action: 'COMPANY_PAYMENT_RECORDED',
        description: `Зафиксировал оплату компании "${company.name}": ${paidAmount ? Number(paidAmount).toLocaleString('ru') + ' ₸' : 'сумма не указана'} от ${new Date(paidAt).toLocaleDateString('ru')}${paymentNote ? ` (${paymentNote})` : ''}`,
        adminEmail, targetId: company.id, targetType: 'company',
        oldValue: before?.paidAmount ? String(before.paidAmount) : '0',
        newValue: paidAmount ? String(paidAmount) : '0',
        companyId: company.id, companyName: company.name,
      })
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

    const passwordHash = await bcrypt.hash(ownerPassword, 12)
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
  const { status, role, name, email, phone, managerType, newPassword, accessExpiresAt } = req.body
  try {
    const before = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { name: true, email: true, role: true, status: true, managerType: true, accessExpiresAt: true, company: { select: { id: true, name: true } } },
    })

    let passwordHash: string | undefined
    if (newPassword) passwordHash = await bcrypt.hash(newPassword, 12)

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
        ...(accessExpiresAt !== undefined && { accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null }),
      },
      select: {
        id: true, name: true, email: true, role: true, managerType: true,
        status: true, phone: true, lastLoginAt: true, lastSeenAt: true, createdAt: true,
        accessExpiresAt: true,
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
    if (accessExpiresAt !== undefined) {
      const oldVal = before?.accessExpiresAt ? before.accessExpiresAt.toISOString().slice(0, 10) : 'без ограничений'
      const newVal = accessExpiresAt ? String(accessExpiresAt).slice(0, 10) : 'без ограничений'
      if (oldVal !== newVal) {
        await writeAudit({
          action: 'USER_ACCESS_EXPIRY_CHANGED',
          description: `Изменил срок доступа пользователя "${before?.name || ''}" (${before?.email || ''}): ${oldVal} → ${newVal}`,
          adminEmail, targetId: req.params.id, targetType: 'user',
          oldValue: oldVal, newValue: newVal,
          companyId, companyName,
        })
      }
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
// Wipes ALL transactional data across every company:
//   Sales, Reports, DealLinks, LeadTasks, Leads
// Keeps: Plans, Users, Companies, Departments, SalesChannels
router.post('/reset-all-data', requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  const { confirm } = req.body
  if (confirm !== 'RESET_ALL') return res.status(400).json({ error: 'Передайте confirm: "RESET_ALL"' })
  try {
    // Order matters: delete children before parents
    const [sales, reports, dealLinks, leadTasks, leads] = await Promise.all([
      prisma.sale.deleteMany({}),
      prisma.report.deleteMany({}),
      prisma.dealLink.deleteMany({}),
      prisma.leadTask.deleteMany({}),
      prisma.lead.deleteMany({}),
    ])

    await writeAudit({
      action: 'GLOBAL_DATA_RESET',
      description: `Глобальный сброс данных: продаж ${sales.count}, отчётов ${reports.count}, CRM-ссылок ${dealLinks.count}, задач ${leadTasks.count}, лидов ${leads.count}`,
      adminEmail: req.adminEmail || 'admin',
    })

    res.json({ ok: true, deleted: { sales: sales.count, reports: reports.count, dealLinks: dealLinks.count, leadTasks: leadTasks.count, leads: leads.count } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
