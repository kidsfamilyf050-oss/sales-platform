import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    managerType: string | null
    companyId: string
    departmentId: string | null
  }
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true, email: true, role: true, managerType: true,
        companyId: true, departmentId: true, status: true, accessExpiresAt: true,
        company: { select: { isActive: true, trialEndsAt: true, subscriptionPlan: true } },
      },
    })
    if (!user || user.status === 'ARCHIVED') return res.status(401).json({ error: 'Unauthorized' })

    const trialExpired = user.company?.subscriptionPlan === 'trial'
      && user.company?.trialEndsAt
      && new Date(user.company.trialEndsAt) < new Date()

    if (user.role === 'OWNER') {
      // OWNER always passes authentication — they manage billing.
      // But block write operations (POST/PUT/PATCH/DELETE) when trial has expired.
      const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      if (isWriteOperation && trialExpired) {
        return res.status(403).json({ error: 'TRIAL_EXPIRED', message: 'Пробный период истёк. Перейдите на платный тариф для продолжения работы.' })
      }
    } else if (user.company) {
      // Non-owners: block all access when subscription inactive or trial expired
      if (!user.company.isActive) {
        return res.status(403).json({ error: 'SUBSCRIPTION_INACTIVE', message: 'Доступ к платформе приостановлен. Обратитесь к руководителю.' })
      }
      if (trialExpired) {
        return res.status(403).json({ error: 'TRIAL_EXPIRED', message: 'Пробный период истёк. Обратитесь к руководителю для продления.' })
      }
      // Per-user expiry — blocks this user even if company subscription is still active
      if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) {
        return res.status(403).json({ error: 'USER_ACCESS_EXPIRED', message: 'Ваш индивидуальный доступ истёк. Обратитесь к руководителю.' })
      }
    }

    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
