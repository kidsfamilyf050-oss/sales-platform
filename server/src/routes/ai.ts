import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { generateAIInsights } from '../services/ai.service'

const router = Router()

router.post('/insights', authenticate, async (req: AuthRequest, res: Response) => {
  const { summary, managerRating, funnel, period } = req.body
  try {
    const insights = await generateAIInsights({
      role: req.user!.role,
      summary,
      managerRating,
      funnel,
      period: period || 'текущий месяц',
    })
    res.json({ insights })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'AI service error' })
  }
})

export default router
