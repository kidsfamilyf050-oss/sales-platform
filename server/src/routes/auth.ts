import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'
import { sendWelcomeEmail, sendResetPasswordEmail, sendPasswordChangedEmail } from '../services/email.service'

const router = Router()
const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET!  // must be set in Railway env vars — server refuses to start without it
const JWT_EXPIRES = '7d'

// ─── Password strength validation ────────────────────────────────────────────
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Пароль должен быть минимум 8 символов'
  if (!/[0-9]/.test(password)) return 'Пароль должен содержать хотя бы одну цифру'
  return null
}

// ─── Per-email brute-force protection ────────────────────────────────────────
// In-memory store; resets on server restart. Upgrade to Redis for multi-instance setups.
interface LoginRecord { count: number; firstAttempt: number; lockedUntil?: number }
const loginAttempts = new Map<string, LoginRecord>()
const MAX_ATTEMPTS  = 10
const WINDOW_MS     = 15 * 60 * 1000  // 15 minutes
const LOCKOUT_MS    = 30 * 60 * 1000  // 30-minute lockout after MAX_ATTEMPTS

function checkLoginAllowed(email: string): { allowed: boolean; retryAfterMs?: number } {
  const now  = Date.now()
  const key  = email.toLowerCase()
  const rec  = loginAttempts.get(key)
  if (!rec) return { allowed: true }
  // Locked out?
  if (rec.lockedUntil && now < rec.lockedUntil) {
    return { allowed: false, retryAfterMs: rec.lockedUntil - now }
  }
  // Window expired — reset
  if (now - rec.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(key)
    return { allowed: true }
  }
  return { allowed: true }
}

function recordLoginFailure(email: string) {
  const now = Date.now()
  const key = email.toLowerCase()
  const rec = loginAttempts.get(key)
  if (!rec) {
    loginAttempts.set(key, { count: 1, firstAttempt: now })
    return
  }
  // Reset window if expired
  if (now - rec.firstAttempt > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now })
    return
  }
  rec.count++
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_MS
  }
}

function clearLoginFailures(email: string) {
  loginAttempts.delete(email.toLowerCase())
}

// Register (Owner creates company + account)
// Protected by REGISTRATION_SECRET env variable if set
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, companyName, secret } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' })
  const pwErr = validatePasswordStrength(password)
  if (pwErr) return res.status(400).json({ error: pwErr })

  const registrationSecret = process.env.REGISTRATION_SECRET
  if (registrationSecret && secret !== registrationSecret) {
    return res.status(403).json({ error: 'Регистрация закрыта. Обратитесь к администратору.' })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Этот email уже зарегистрирован' })

    // Set 24-hour trial on registration
    const trialEndsAt = new Date()
    trialEndsAt.setHours(trialEndsAt.getHours() + 24)

    const company = await prisma.company.create({
      data: {
        name: companyName || 'Моя компания',
        subscriptionPlan: 'trial',
        trialEndsAt,
      },
    })
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: 'OWNER', companyId: company.id },
    })

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES })

    // Отправляем приветственное письмо (fire-and-forget — не блокируем ответ)
    sendWelcomeEmail(user.email, user.name, password, company.name).catch((err) => {
      console.error('[EMAIL] Welcome email failed:', err)
    })

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId, managerType: null, departmentId: null, canManageGateways: false, businessSphere: null, subscriptionPlan: 'trial', trialEndsAt: company.trialEndsAt } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })

  // Per-email lockout check (guards against distributed brute-force across IPs)
  const lock = checkLoginAllowed(email)
  if (!lock.allowed) {
    const mins = Math.ceil((lock.retryAfterMs ?? LOCKOUT_MS) / 60000)
    return res.status(429).json({ error: `Слишком много неудачных попыток. Повторите через ${mins} мин.` })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      recordLoginFailure(email)
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    if (user.status === 'ARCHIVED') return res.status(401).json({ error: 'Account archived' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      recordLoginFailure(email)
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    clearLoginFailures(email)

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    // Track session
    await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string || null,
        userAgent: req.headers['user-agent'] || null,
      },
    }).catch(() => {}) // non-critical
    const company = await prisma.company.findUnique({ where: { id: user.companyId }, select: { businessSphere: true, subscriptionPlan: true, trialEndsAt: true } })
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, managerType: user.managerType, companyId: user.companyId, departmentId: user.departmentId, canManageGateways: user.canManageGateways, businessSphere: company?.businessSphere ?? null, subscriptionPlan: company?.subscriptionPlan ?? 'trial', trialEndsAt: company?.trialEndsAt ?? null },
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET invite info — returns user name and whether this is a password reset (user already registered)
router.get('/invite-info', async (req: Request, res: Response) => {
  const token = req.query.token as string
  if (!token) return res.status(400).json({ error: 'Missing token' })
  try {
    const user = await prisma.user.findUnique({ where: { inviteToken: token }, select: { name: true, email: true, passwordHash: true, invitedAt: true } })
    if (!user) return res.status(404).json({ error: 'Invalid invite link' })
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
    if (user.invitedAt && Date.now() - new Date(user.invitedAt).getTime() > THREE_DAYS_MS) {
      return res.status(410).json({ error: 'Ссылка устарела.' })
    }
    res.json({ name: user.name, email: user.email, isPasswordReset: !!user.passwordHash })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Accept invite & set password
router.post('/accept-invite', async (req: Request, res: Response) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Missing fields' })
  const pwErr = validatePasswordStrength(password)
  if (pwErr) return res.status(400).json({ error: pwErr })

  try {
    const user = await prisma.user.findUnique({ where: { inviteToken: token } })
    if (!user) return res.status(404).json({ error: 'Invalid invite link' })

    // Check 3-day expiry
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
    if (user.invitedAt && Date.now() - new Date(user.invitedAt).getTime() > THREE_DAYS_MS) {
      return res.status(410).json({ error: 'Ссылка устарела. Попросите администратора сгенерировать новую.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, inviteToken: null },
    })

    const company = await prisma.company.findUnique({ where: { id: updated.companyId }, select: { businessSphere: true, subscriptionPlan: true, trialEndsAt: true } })
    const jwtToken = jwt.sign({ userId: updated.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({
      token: jwtToken,
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, managerType: updated.managerType, companyId: updated.companyId, departmentId: updated.departmentId, canManageGateways: (updated as any).canManageGateways, businessSphere: company?.businessSphere ?? null, subscriptionPlan: company?.subscriptionPlan ?? 'trial', trialEndsAt: company?.trialEndsAt ?? null },
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
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`

    console.log(`[RESET PASSWORD] request for ${email}`)

    // Send reset email
    sendResetPasswordEmail(email, user.name, resetUrl).catch((err) => {
      console.error('[EMAIL] Reset password email failed:', err)
    })

    res.json({ message: 'Если email найден, вы получите инструкции по сбросу пароля.' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Reset password — verifies JWT reset token, sets new password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Missing fields' })
  const resetPwErr = validatePasswordStrength(password)
  if (resetPwErr) return res.status(400).json({ error: resetPwErr })
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; purpose: string }
    if (payload.purpose !== 'reset-password') return res.status(400).json({ error: 'Invalid token' })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash },
    })
    // Send confirmation email with new password (non-blocking)
    sendPasswordChangedEmail(user.email, user.name, password).catch(console.error)
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
      select: { id: true, name: true, email: true, phone: true, role: true, managerType: true, companyId: true, departmentId: true, canManageGateways: true, status: true, lastLoginAt: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const company = await prisma.company.findUnique({ where: { id: user.companyId }, select: { businessSphere: true, subscriptionPlan: true, trialEndsAt: true } })
    res.json({ ...user, businessSphere: company?.businessSphere ?? null, subscriptionPlan: company?.subscriptionPlan ?? 'trial', trialEndsAt: company?.trialEndsAt ?? null })
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
