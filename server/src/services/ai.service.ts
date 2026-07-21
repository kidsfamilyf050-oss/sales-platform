import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface DashboardData {
  role: string
  summary: Record<string, number | string>
  managerRating?: any[]
  funnel?: Record<string, number>
  period: string
  lang?: string
}

export async function generateAIInsights(data: DashboardData): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateFallbackInsights(data)
  }

  const isKk = data.lang === 'kk'

  const prompt = isKk
    ? `Сіз — сату бөлімін басқару жүйесінің AI-аналитигісіз. Деректерді талдап, қазақ тілінде нақты ұсыныстар беріңіз.

Кезең деректері: ${data.period}
Пайдаланушы рөлі: ${data.role}

Көрсеткіштер:
${JSON.stringify(data.summary, null, 2)}

${data.managerRating ? `Менеджерлер рейтингі:\n${JSON.stringify(data.managerRating, null, 2)}` : ''}
${data.funnel ? `Сату шұңқыры:\n${JSON.stringify(data.funnel, null, 2)}` : ''}

Көрсеткіштерді жақсартуға арналған нақты ұсыныстармен қысқа аналитикалық есеп (3-5 тармақ) жасаңыз. Деректерден нақты сандарды пайдаланыңыз. Формат: алдымен жағдай талдауы, содан кейін басшыға арналған нақты іс-қимылдар.`
    : `Ты — AI-аналитик системы управления отделом продаж. Проанализируй данные и дай конкретные рекомендации на русском языке.

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
  const isKk = data.lang === 'kk'
  const lines: string[] = []

  if (isKk) {
    if (completion >= 100) {
      lines.push(`✅ Жоспар ${completion}% орындалды — тамаша нәтиже!`)
    } else if (completion >= 75) {
      lines.push(`📊 Жоспар ${completion}% орындалды. Жақсы қарқын, осылай жалғастырыңыз.`)
    } else if (completion >= 50) {
      lines.push(`⚠️ Жоспар ${completion}% орындалды. Мақсатқа жету үшін қарқынды арттыру қажет.`)
    } else {
      lines.push(`🔴 Жоспар тек ${completion}% орындалды. Басшылықтың дереу араласуы қажет.`)
    }

    if (summary.conversion) {
      const conv = Number(summary.conversion)
      if (conv < 20) lines.push(`📉 Конверсия ${conv}% нормадан төмен. Қоңырауларды талдау және қарсылықтармен жұмыс жасау ұсынылады.`)
      else lines.push(`📈 Конверсия ${conv}% — норма шегінде.`)
    }

    if (summary.leadCost && Number(summary.leadCost) > 0) {
      lines.push(`💰 Лид құны: ${Number(summary.leadCost).toLocaleString('ru')} ₸.`)
    }

    if (data.managerRating) {
      const red = data.managerRating.filter((m: any) => m.status === 'red')
      if (red.length > 0) {
        lines.push(`🔴 ${red.length} менеджер бүгін есеп бермеді: ${red.map((m: any) => m.name).join(', ')}.`)
      }
    }

    lines.push(`💡 Кеңес: күнделікті есептілікті бақылаңыз, таңертеңгі жиналыстар өткізіңіз және күрделі мәмілелерді талдаңыз.`)
  } else {
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
  }

  return lines.join('\n\n')
}
