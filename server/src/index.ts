import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

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

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: (origin, cb) => cb(null, true), // allow all origins (same-domain Railway + dev)
  credentials: true,
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/company', companyRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/plans', plansRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/export', exportRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
