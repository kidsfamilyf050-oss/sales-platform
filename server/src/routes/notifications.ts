import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// Get my notifications
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(notifications)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Mark as read
router.put('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { read: true } })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Mark all as read
router.put('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Unread count (legacy — kept for compatibility)
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({ where: { userId: req.user!.id, read: false } })
    res.json({ count })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Smart alerts — role-based live alerts from real data
router.get('/alerts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const nowKz = new Date(Date.now() + 5 * 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const today = `${nowKz.getUTCFullYear()}-${pad(nowKz.getUTCMonth() + 1)}-${pad(nowKz.getUTCDate())}`

    const alerts: { type: string; title: string; count: number; url: string; color: string }[] = []

    if (user.role === 'MANAGER' && user.managerType === 'LIDER') {
      // Lider: get their leads
      const leads = await prisma.lead.findMany({
        where: { createdById: user.id },
        select: { subStatus: true, consultationStatus: true, appointmentDate: true, postponedDate: true, date: true },
      })

      const overdueCount = leads.filter(l => {
        const plannedPast = l.appointmentDate && l.appointmentDate < today &&
          (!l.consultationStatus || l.consultationStatus === 'planned')
        const postponedPast = l.consultationStatus === 'postponed' &&
          (!l.postponedDate || l.postponedDate < today)
        return plannedPast || postponedPast
      }).length

      const thinkingCount = (() => {
        const cutoff = new Date(Date.now() + 5 * 60 * 60 * 1000)
        cutoff.setUTCDate(cutoff.getUTCDate() - 2)
        const cutoffStr = cutoff.toISOString().slice(0, 10)
        return leads.filter(l => l.subStatus === 'thinking' && l.date < cutoffStr).length
      })()

      const postponedNoDate = leads.filter(l =>
        l.consultationStatus === 'postponed' && !l.postponedDate
      ).length

      const todayMeetings = leads.filter(l =>
        l.appointmentDate === today || l.postponedDate === today
      ).length

      if (todayMeetings > 0) alerts.push({ type: 'today', title: 'Встреч сегодня', count: todayMeetings, url: '/lider/leads', color: 'blue' })
      if (overdueCount > 0) alerts.push({ type: 'overdue', title: 'Нужно отметить статус', count: overdueCount, url: '/lider/leads', color: 'red' })
      if (thinkingCount > 0) alerts.push({ type: 'thinking', title: 'Думают слишком долго', count: thinkingCount, url: '/lider/leads', color: 'orange' })
      if (postponedNoDate > 0) alerts.push({ type: 'nodate', title: 'Перенос без новой даты', count: postponedNoDate, url: '/lider/leads', color: 'yellow' })

    } else if (user.role === 'MANAGER' && user.managerType === 'CLOSER') {
      // Closer: due tasks + today's meetings
      const leads = await prisma.lead.findMany({
        where: { assignedToId: user.id },
        select: { consultationStatus: true, appointmentDate: true, postponedDate: true,
          tasks: { select: { completed: true, dueDate: true } } },
      })

      const dueTasks = leads.flatMap(l => l.tasks).filter(t =>
        !t.completed && t.dueDate && t.dueDate <= today
      ).length

      const todayMeetings = leads.filter(l =>
        l.appointmentDate === today || l.postponedDate === today
      ).length

      const overdueUnmarked = leads.filter(l => {
        const apptDate = l.postponedDate || l.appointmentDate
        return apptDate && apptDate < today && !l.consultationStatus
      }).length

      if (todayMeetings > 0) alerts.push({ type: 'today', title: 'Консультаций сегодня', count: todayMeetings, url: '/closer/leads', color: 'blue' })
      if (overdueUnmarked > 0) alerts.push({ type: 'overdue', title: 'Не отмечены встречи', count: overdueUnmarked, url: '/closer/leads', color: 'red' })
      if (dueTasks > 0) alerts.push({ type: 'tasks', title: 'Задач к выполнению', count: dueTasks, url: '/closer/tasks', color: 'orange' })

    } else if (user.role === 'ROP') {
      // ROP: overdue leads needing action across their team
      const teamLeads = await prisma.lead.findMany({
        where: { createdBy: { companyId: user.companyId! } },
        select: { consultationStatus: true, appointmentDate: true, postponedDate: true, subStatus: true, date: true },
      })

      const overdueCount = teamLeads.filter(l => {
        const plannedPast = l.appointmentDate && l.appointmentDate < today &&
          (!l.consultationStatus || l.consultationStatus === 'planned')
        const postponedPast = l.consultationStatus === 'postponed' && (!l.postponedDate || l.postponedDate < today)
        return plannedPast || postponedPast
      }).length

      const todayCount = teamLeads.filter(l =>
        l.appointmentDate === today || l.postponedDate === today
      ).length

      if (todayCount > 0) alerts.push({ type: 'today', title: 'Встреч команды сегодня', count: todayCount, url: '/dashboard/rop', color: 'blue' })
      if (overdueCount > 0) alerts.push({ type: 'overdue', title: 'Встреч без статуса', count: overdueCount, url: '/dashboard/rop', color: 'red' })
    }

    res.json({ alerts, total: alerts.reduce((s, a) => s + a.count, 0) })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
