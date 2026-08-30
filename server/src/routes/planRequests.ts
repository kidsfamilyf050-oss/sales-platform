import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// POST /api/plan-requests — public endpoint, no auth required
// Called from landing page pricing cards and from expired trial overlay
router.post('/', async (req: Request, res: Response) => {
  const { name, phone, email, companyName, plan } = req.body

  if (!name?.trim() || !phone?.trim() || !email?.trim() || !companyName?.trim() || !plan) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' })
  }
  if (!['starter', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'Неверный тариф' })
  }

  try {
    const request = await prisma.planRequest.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        companyName: companyName.trim(),
        plan,
      },
    })
    res.json({ success: true, id: request.id })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
