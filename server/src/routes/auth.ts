import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'secret'
const JWT_EXPIRES = '30d'

// Register (Owner creates company + account)
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' })

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email already registered' })

    const company = await prisma.company.create({ data: { name: 'Моя компания' } })
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: 'OWNER', companyId: company.id },
    })

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' })
    if (user.status === 'ARCHIVED') return res.status(401).json({ error: 'Account archived' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, managerType: user.managerType, companyId: user.companyId, departmentId: user.departmentId },
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Accept invite & set password
router.post('/accept-invite', async (req: Request, res: Response) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Missing fields' })

  try {
    const user = await prisma.user.findUnique({ where: { inviteToken: token } })
    if (!user) return res.status(404).json({ error: 'Invalid invite link' })

    const passwordHash = await bcrypt.hash(password, 10)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, inviteToken: null },
    })

    const jwtToken = jwt.sign({ userId: updated.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({
      token: jwtToken,
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, managerType: updated.managerType, companyId: updated.companyId, departmentId: updated.departmentId },
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, phone: true, role: true, managerType: true, companyId: true, departmentId: true, status: true, lastLoginAt: true },
    })
    res.json(user)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
