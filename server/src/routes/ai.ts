import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { generateAIInsights } from '../services/ai.service'

const router = Router()

router.post('/insights', authenticate, async (req: AuthRequest, res: Response) => {
  const { summary, managerRating, liderRating, funnel, productStats, period, lang } = req.body

  // Guard: cap array sizes to prevent massive prompts burning API credits
  const MAX_MANAGERS = 20
  const safeSummary = summary && typeof summary === 'object' ? summary : {}
  const safeManagerRating = Array.isArray(managerRating) ? managerRating.slice(0, MAX_MANAGERS) : []
  const safeLiderRating = Array.isArray(liderRating) ? liderRating.slice(0, MAX_MANAGERS) : []
  const safeFunnel = funnel && typeof funnel === 'object' ? funnel : {}
  const safeProductStats = Array.isArray(productStats) ? productStats.slice(0, 20) : []
  const safePeriod = typeof period === 'string' ? period.slice(0, 100) : 'текущий месяц'
  const safeLang = lang === 'kk' ? 'kk' : 'ru'

  try {
    const insights = await generateAIInsights({
      role: req.user!.role,
      managerType: req.user!.managerType,
      summary: safeSummary,
      managerRating: safeManagerRating,
      liderRating: safeLiderRating,
      funnel: safeFunnel,
      productStats: safeProductStats,
      period: safePeriod,
      lang: safeLang,
    })
    res.json({ insights })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'AI service error' })
  }
})

export default router
