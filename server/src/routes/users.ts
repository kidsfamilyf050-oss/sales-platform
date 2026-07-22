import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { sendInviteEmail } from '../services/email.service'

const router = Router()
const prisma = new PrismaClient()

// Get closers in company — accessible to all authenticated users (liders need this to assign leads)
router.get('/closers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const closers = await prisma.user.findMany({
      where: { companyId: req.user!.companyId, role: 'MANAGER', managerType: 'CLOSER', status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    res.json(closers)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Get all users in company
router.get('/', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  try {
    const where: any = { companyId: req.user!.companyId }
    if (req.user!.role === 'ROP' && req.user!.departmentId) {
      where.departmentId = req.user!.departmentId
    }
    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, phone: true, role: true, managerType: true, status: true, departmentId: true, department: { select: { name: true } }, lastLoginAt: true, createdAt: true, invitedAt: true, inviteToken: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json(users)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Invite new user
router.post('/invite', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { name, email, phone, role, managerType, departmentId } = req.body
  if (!name || !email || !role) return res.status(400).json({ error: 'Missing fields' })

  try {
    const company = await prisma.company.findUnique({ where: { id: req.user!.companyId } })
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email already registered' })

    const inviteToken = uuidv4()
    const user = await prisma.user.create({
      data: {
        name, email,
        phone: phone || null,
        role,
        managerType: managerType || null,
        companyId: req.user!.companyId,
        departmentId: departmentId || null,
        inviteToken,
        invitedAt: new Date(),
      },
    })

    // Send invite email (non-blocking)
    if (process.env.SMTP_USER) {
      sendInviteEmail(email, name, inviteToken, company?.name || 'Компания').catch(console.error)
    }

    res.json({ message: 'Invite sent', userId: user.id, inviteToken })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update user (status, department, role, email)
router.put('/:id', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { name, email, phone, role, managerType, departmentId, status } = req.body
  try {
    const target = await prisma.user.findFirst({ where: { id: req.params.id, companyId: req.user!.companyId } })
    if (!target) return res.status(404).json({ error: 'Not found' })

    // ROP can only manage MANAGERs (cannot change status/role of OWNER or ROP)
    if (req.user!.role === 'ROP' && target.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Недостаточно прав' })
    }

    // Check email uniqueness if changing
    if (email && email !== target.email) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) return res.status(400).json({ error: 'Email уже используется другим пользователем' })
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(role && { role }),
        ...(managerType !== undefined && { managerType }),
        ...(departmentId !== undefined && { departmentId }),
        ...(status && { status }),
      },
      select: { id: true, name: true, email: true, phone: true, role: true, managerType: true, status: true, departmentId: true },
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Archive user (soft delete)
router.delete('/:id', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  try {
    const target = await prisma.user.findFirst({ where: { id: req.params.id, companyId: req.user!.companyId } })
    if (!target) return res.status(404).json({ error: 'Not found' })

    // ROP can only archive MANAGERs
    if (req.user!.role === 'ROP' && target.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Недостаточно прав' })
    }

    await prisma.user.update({ where: { id: req.params.id }, data: { status: 'ARCHIVED' } })
    res.json({ message: 'User archived' })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Regenerate invite link (for users who haven't accepted yet or link expired)
router.post('/:id/resend-invite', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  try {
    const target = await prisma.user.findFirst({ where: { id: req.params.id, companyId: req.user!.companyId } })
    if (!target) return res.status(404).json({ error: 'Not found' })

    // ROP can only manage MANAGERs
    if (req.user!.role === 'ROP' && target.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Недостаточно прав' })
    }

    const inviteToken = uuidv4()
    await prisma.user.update({
      where: { id: req.params.id },
      data: { inviteToken, invitedAt: new Date() },
    })

    res.json({ inviteToken })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
