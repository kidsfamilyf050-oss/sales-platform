import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// Get company info
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.user!.companyId },
      include: { departments: { include: { users: { where: { status: 'ACTIVE' } } } } },
    })
    res.json(company)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Update company settings (onboarding + settings page)
router.put('/', authenticate, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
  const { name, businessSphere, reportingStart } = req.body
  try {
    const company = await prisma.company.update({
      where: { id: req.user!.companyId },
      data: {
        ...(name && { name }),
        ...(businessSphere && { businessSphere }),
        ...(reportingStart !== undefined && { reportingStart }),
      },
    })
    res.json(company)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Create department
router.post('/departments', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { name, type, hasLiders } = req.body
  try {
    const department = await prisma.department.create({
      data: { name, type, hasLiders: hasLiders || false, companyId: req.user!.companyId },
    })
    res.json(department)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Update department
router.put('/departments/:id', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { name, hasLiders } = req.body
  try {
    const dept = await prisma.department.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    })
    if (!dept) return res.status(404).json({ error: 'Not found' })

    const updated = await prisma.department.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(hasLiders !== undefined && { hasLiders }) },
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Delete department (only if empty — no users)
router.delete('/departments/:id', authenticate, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
  try {
    const dept = await prisma.department.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
      include: { _count: { select: { users: true } } },
    })
    if (!dept) return res.status(404).json({ error: 'Not found' })
    if (dept._count.users > 0) return res.status(400).json({ error: 'Нельзя удалить отдел с сотрудниками' })

    await prisma.department.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get departments
router.get('/departments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      where: { companyId: req.user!.companyId },
      include: { users: { where: { status: 'ACTIVE' }, select: { id: true, name: true, role: true, managerType: true } } },
    })
    res.json(departments)
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
