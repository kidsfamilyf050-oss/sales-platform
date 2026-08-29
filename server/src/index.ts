import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

dotenv.config()

// ─── Guard: crash immediately if JWT_SECRET is missing ───────────────────────
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET env var is not set. Set it in Railway → Variables before deploying.')
  process.exit(1)
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

// Trust Railway's reverse proxy so rate-limit sees real client IPs
app.set('trust proxy', 1)

// ─── CORS — allow our client origins ─────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,           // set this in Railway env vars!
  process.env.ADMIN_URL,            // optional separate admin URL
  'https://sirius-track.kz',        // production domain (hardcoded fallback)
  'https://www.sirius-track.kz',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean) as string[]

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin header)
    if (!origin) return cb(null, true)
    // Allow whitelisted origins (exact match or prefix)
    if (ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o + '/'))) return cb(null, true)
    // Allow *.railway.app — our own infrastructure (frontend + API are both on Railway)
    if (origin.endsWith('.railway.app')) return cb(null, true)
    // Allow localhost in any form
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return cb(null, true)
    // Reject unknown origins with 403 (not 500 — never throw from CORS callback)
    console.warn(`[CORS] blocked origin: ${origin}`)
    cb(null, false)
  },
  credentials: true,
}))

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Tightest: login / register / password endpoints — 10 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток. Повторите через 15 минут.' },
  skipSuccessfulRequests: true, // only count failures toward the limit
})

// Broad: all other authenticated API calls — prevent scraping / DoS
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Пожалуйста, подождите.' },
})

// AI endpoint — strict limit to prevent burning API credits
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // max 10 AI requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов к AI. Подождите минуту.' },
})

app.use(express.json({ limit: '2mb' })) // cap request body size

// Global API rate limit — covers ALL /api/* routes
app.use('/api', apiLimiter)

app.use('/api/auth', authLimiter, authRoutes)  // stricter limit on auth
app.use('/api/admin', authLimiter, adminRoutes) // admin panel uses same strict limit
app.use('/api/company', companyRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/plans', plansRoutes)
app.use('/api/ai', aiLimiter, aiRoutes)
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
