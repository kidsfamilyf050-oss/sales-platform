import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

dotenv.config()

// ─── Guard: warn if JWT_SECRET is missing (set it in Railway env vars!) ───────
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set — using insecure fallback. Set it in Railway env vars immediately!')
}

import authRoutes from './routes/auth'
import companyRoutes from './routes/company'
import usersRoutes from './routes/users'
import reportsRoutes from './routes/reports'
import dashboardRoutes from './routes/dashboard'
import plansRoutes from './routes/plans'
import aiRoutes from './routes/ai'
import notificationsRoutes from './routes/notifications'
import adminRoutes from './routes/admin'
import salesRoutes from './routes/sales'
import exportRoutes from './routes/export'
import dealLinksRoutes from './routes/dealLinks'
import salesChannelsRoutes from './routes/salesChannels'
import leadsRoutes from './routes/leads'
import leadTasksRoutes from './routes/leadTasks'
import channelBudgetsRoutes from './routes/channelBudgets'
import productsRoutes from './routes/products'
import lossReasonsRoutes from './routes/lossReasons'
import paymentGatewaysRoutes from './routes/paymentGateways'

const app = express()
const PORT = process.env.PORT || 3001

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Railway CDN assets
}))

// ─── CORS — allow our client origins ─────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,           // set this in Railway env vars!
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean) as string[]

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin header)
    if (!origin) return cb(null, true)
    // Allow whitelisted origins
    if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true)
    // Allow *.railway.app as a safe fallback (our own infra)
    if (origin.endsWith('.railway.app')) return cb(null, true)
    // Allow localhost in any form
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Strict limit on auth endpoints (login, register, password reset)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток. Повторите через 15 минут.' },
})

// General API limit — prevent scraping / DoS
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Пожалуйста, подождите.' },
})

app.use(express.json({ limit: '2mb' })) // cap request body size

app.use('/api/auth', authLimiter, authRoutes)  // strict rate limit on auth
app.use('/api/admin', apiLimiter, adminRoutes) // admin panel also rate-limited
app.use('/api/company', companyRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/plans', plansRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/deal-links', dealLinksRoutes)
app.use('/api/sales-channels', salesChannelsRoutes)
app.use('/api/leads', leadsRoutes)
app.use('/api/lead-tasks', leadTasksRoutes)
app.use('/api/channel-budgets', channelBudgetsRoutes)
app.use('/api/products', productsRoutes)
app.use('/api/loss-reasons', lossReasonsRoutes)
app.use('/api/payment-gateways', paymentGatewaysRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
