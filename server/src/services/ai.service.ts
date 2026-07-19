import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface DashboardData {
  role: string
  summary: Record<string, number | string>
  managerRating?: any[]
  funnel?: Record<string, number>
  period: string
}

export async function generateAIInsights(data: DashboardData): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateFallbackInsights(data)
  }

  const prompt = `Ты — AI-аналитик системы управления отделом продаж. Проанализируй данные и дай конкретные рекомендации на русском языке.

Данные за период: ${data.period}
Роль пользователя: ${data.role}

Показатели:
${JSON.stringify(data.summary, null, 2)}

${data.managerRating ? `Рейтинг менеджеров:\n${JSON.stringify(data.managerRating, null, 2)}` : ''}
${data.funnel ? `Воронка продаж:\n${JSON.stringify(data.funnel, null, 2)}` : ''}

Составь краткий аналитический отчёт (3-5 пунктов) с конкретными рекомендациями по улучшению показателей. Используй конкретные цифры из данных. Формат: сначала анализ ситуации, затем конкретные действия для руководителя.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    return (message.content[0] as any).text || generateFallbackInsights(data)
  } catch (e) {
    console.error('AI error:', e)
    return generateFallbackInsights(data)
  }
}

function generateFallbackInsights(data: DashboardData): string {
  const { summary } = data
  const completion = Number(summary.planCompletion) || 0
  const lines: string[] = []

  if (completion >= 100) {
    lines.push(`✅ План выполнен на ${completion}% — отличный результат!`)
  } else if (completion >= 75) {
    lines.push(`📊 План выполнен на ${completion}%. Хороший темп, продолжайте в том же духе.`)
  } else if (completion >= 50) {
    lines.push(`⚠️ План выполнен на ${completion}%. Необходимо ускорить темп для достижения цели.`)
  } else {
    lines.push(`🔴 План выполнен лишь на ${completion}%. Требуется немедленное вмешательство руководства.`)
  }

  if (summary.conversion) {
    const conv = Number(summary.conversion)
    if (conv < 20) lines.push(`📉 Конверсия ${conv}% ниже нормы. Рекомендуется провести разбор звонков и работу с возражениями.`)
    else lines.push(`📈 Конверсия ${conv}% — в пределах нормы.`)
  }

  if (summary.leadCost && Number(summary.leadCost) > 0) {
    lines.push(`💰 Стоимость лида: ${Number(summary.leadCost).toLocaleString('ru')} ₸.`)
  }

  if (data.managerRating) {
    const red = data.managerRating.filter((m: any) => m.status === 'red')
    if (red.length > 0) {
      lines.push(`🔴 ${red.length} менеджер(ов) не сдал(и) отчёт сегодня: ${red.map((m: any) => m.name).join(', ')}.`)
    }
  }

  lines.push(`💡 Совет: контролируйте ежедневную отчётность, проводите утренние планёрки и разбирайте сложные сделки.`)

  return lines.join('\n\n')
}
