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
// Protected by REGISTRATION_SECRET env variable if set
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, companyName, secret } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' })

  const registrationSecret = process.env.REGISTRATION_SECRET
  if (registrationSecret && secret !== registrationSecret) {
    return res.status(403).json({ error: 'Регистрация закрыта. Обратитесь к администратору.' })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Этот email уже зарегистрирован' })

    // Set 14-day trial on registration
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    const company = await prisma.company.create({
      data: {
        name: companyName || 'Моя компания',
        subscriptionPlan: 'trial',
        trialEndsAt,
      },
    })
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
    // Track session
    await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string || null,
        userAgent: req.headers['user-agent'] || null,
      },
    }).catch(() => {}) // non-critical
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

// Forgot password — generates a reset token (JWT, 1h expiry)
// In production this would send an email; for now returns the reset URL
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email обязателен' })
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    // Always return success to avoid user enumeration
    if (!user) return res.json({ message: 'Если email найден, вы получите инструкции.' })

    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'reset-password' },
      JWT_SECRET,
      { expiresIn: '1h' },
    )
    // In production: send email with resetUrl
    // For now: return the token so admin can share the link manually
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`

    console.log(`[RESET PASSWORD] ${email} → ${resetUrl}`)

    res.json({
      message: 'Инструкции по сбросу пароля сгенерированы.',
      // Only expose resetUrl if no email provider configured
      ...(!process.env.SMTP_HOST && { resetUrl, note: 'Email-провайдер не настроен. Скопируйте ссылку и передайте пользователю.' }),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Reset password — verifies JWT reset token, sets new password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Missing fields' })
  if (password.length < 6) return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' })
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; purpose: string }
    if (payload.purpose !== 'reset-password') return res.status(400).json({ error: 'Invalid token' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash },
    })
    res.json({ message: 'Пароль успешно изменён', userId: user.id })
  } catch (e: any) {
    if (e.name === 'TokenExpiredError') return res.status(400).json({ error: 'Ссылка для сброса пароля истекла. Запросите новую.' })
    if (e.name === 'JsonWebTokenError') return res.status(400).json({ error: 'Недействительная ссылка для сброса пароля.' })
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

// Heartbeat — keeps lastSeenAt fresh (call every 5 min from client)
router.post('/heartbeat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({ where: { id: req.user!.id }, data: { lastSeenAt: new Date() } }).catch(() => {})
    res.json({ ok: true })
  } catch {
    res.json({ ok: true })
  }
})

export default router
