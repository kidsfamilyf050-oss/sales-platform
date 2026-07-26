import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface DashboardData {
  role: string
  managerType?: string
  summary: Record<string, number | string>
  managerRating?: any[]
  liderRating?: any[]
  funnel?: Record<string, number>
  productStats?: any[]
  period: string
  lang?: string
}

// ── Role-specific system prompts ─────────────────────────────────────────────

function buildPrompt(data: DashboardData): string {
  const isKk = data.lang === 'kk'
  const s = data.summary
  const lang = isKk ? 'казахском' : 'русском'

  const fmtNum = (n: any) => Number(n || 0).toLocaleString('ru')
  const fmtPct = (n: any) => `${Number(n || 0).toFixed(1)}%`

  // ── Common blocks ──
  const periodBlock = `📅 Период: ${data.period}`

  // ── OWNER prompt ──
  if (data.role === 'OWNER') {
    const completion = Number(s.planCompletion || 0)
    const daysInMonth = 30
    const today = new Date().getDate()
    const paceNeeded = s.salesPlan && Number(s.salesPlan) > 0
      ? Math.round(((Number(s.salesPlan) - Number(s.totalSalesAmount || 0)) / Math.max(1, daysInMonth - today)) )
      : 0

    const statusLabel = (s: string) => s === 'red' ? 'нет продаж' : s === 'yellow' ? 'отстаёт (<75% плана)' : 'в норме (≥75%)'
    const managerBlock = data.managerRating?.length
      ? `\nРейтинг клоузеров:\n${data.managerRating.slice(0, 8).map(m =>
          `  • ${m.name}: продаж ${m.salesCount}, сумма ₸${fmtNum(m.salesAmount)}, конверсия ${fmtPct(m.conversion)}, выполнение ${fmtPct(m.completion)}, оценка: ${statusLabel(m.status)}`
        ).join('\n')}`
      : ''

    const liderBlock = data.liderRating?.length
      ? `\nРейтинг лидорубов:\n${data.liderRating.slice(0, 5).map(m =>
          `  • ${m.name}: лидов ${m.leads}, квал ${m.qualifiedLeads}, передано ${m.transmitted ?? m.meetingsScheduled ?? 0}, конверсия в запись ${fmtPct(m.pctScheduled)}, оценка: ${statusLabel(m.status)}`
        ).join('\n')}`
      : ''

    const productBlock = data.productStats?.length
      ? `\nПродуктовая аналитика (топ-продукты):\n${data.productStats.slice(0, 5).map((p, i) =>
          `  ${i+1}. ${p.productName}: ${p.count} продаж, ₸${fmtNum(p.totalAmount)}`
        ).join('\n')}`
      : ''

    const funnelBlock = data.funnel
      ? `\nВоронка продаж:\n  Лидов получено: ${data.funnel.leadsReceived}\n  Квалифицировано: ${data.funnel.qualifiedLeads}\n  Передано клоузеру: ${data.funnel.meetingsScheduled}\n  Консультаций состоялось: ${data.funnel.meetingsAttended}\n  Продаж: ${data.funnel.salesCount}`
      : ''

    return `Ты — опытный бизнес-аналитик системы управления отделом продаж. Ты отвечаешь на ${lang} языке.

${periodBlock}
📊 ФИНАНСОВЫЕ ПОКАЗАТЕЛИ СОБСТВЕННИКА:
  План продаж: ₸${fmtNum(s.salesPlan)}
  Факт продаж (бюджет): ₸${fmtNum(s.totalSalesAmount)}
  Выполнение плана: ${fmtPct(completion)}
  Кол-во сделок: ${fmtNum(s.totalSalesCount)}
  Средний чек: ₸${fmtNum(s.avgCheck)}
  Конверсия встречи→продажи: ${fmtPct(s.conversion)}
  Консультаций: ${fmtNum(s.totalConsultations)}
  Отказов: ${fmtNum(s.totalRefusals)}
  В работе: ${fmtNum(s.totalInWork)}
  Необходимый темп (₸/день до конца месяца): ₸${fmtNum(paceNeeded)}

📣 МАРКЕТИНГ:
  Факт лидов: ${fmtNum(s.marketingLeads)} / Plan: ${fmtNum(s.leadsplan)}
  Бюджет: ₸${fmtNum(s.totalBudget)} / Plan: ₸${fmtNum(s.budgetPlan)}
  Стоимость лида: ₸${fmtNum(s.leadCost)}
${funnelBlock}
${managerBlock}
${liderBlock}
${productBlock}

Задача: проведи глубокий анализ показателей собственника и дай КОНКРЕТНЫЕ, ДЕЙСТВЕННЫЕ рекомендации.

Структура ответа (строго придерживайся):
🔥 СИТУАЦИЯ (1-2 предложения — общая оценка)

⚡ КРИТИЧЕСКИЕ ПРОБЛЕМЫ (если есть):
• [конкретная проблема с числами и именами менеджеров]

📈 КЛОУЗЕРЫ — что делать:
• [конкретное действие с именами отстающих/лидирующих]

🎯 ЛИДОРУБЫ — что делать:
• [конкретное действие]

💰 ДЕНЬГИ — финансовые решения:
• [конкретное действие]

🚀 ТОП-3 приоритета на эту неделю:
1. [действие]
2. [действие]
3. [действие]

Используй КОНКРЕТНЫЕ ЧИСЛА из данных. Называй менеджеров по именам. Не давай общих советов — только то, что требует немедленного действия. ВАЖНО: в системе нет ежедневных отчётов — оценка менеджеров строится по продажам и активности лидов, не по отчётам.`
  }

  // ── ROP prompt ──
  if (data.role === 'ROP') {
    const statusLabel = (st: string) => st === 'red' ? 'нет продаж' : st === 'yellow' ? 'отстаёт (<75% плана)' : 'в норме (≥75%)'
    const managerBlock = data.managerRating?.length
      ? `\nРейтинг клоузеров:\n${data.managerRating.slice(0, 8).map(m =>
          `  • ${m.name}: продаж ${m.salesCount}, сумма ₸${fmtNum(m.salesAmount)}, конверсия ${fmtPct(m.conversion)}, консультаций ${m.consultations}, отказов ${m.refusals}, в работе ${m.inWork}, план выполнен на ${fmtPct(m.completion)}, оценка: ${statusLabel(m.status)}`
        ).join('\n')}`
      : ''

    const liderBlock = data.liderRating?.length
      ? `\nРейтинг лидорубов:\n${data.liderRating.slice(0, 5).map(m =>
          `  • ${m.name}: лидов ${m.leads}, квал ${m.qualifiedLeads}, передано ${m.transmitted ?? m.meetingsScheduled ?? 0}, конверсия в передачу ${fmtPct(m.pctScheduled)}, оценка: ${statusLabel(m.status)}`
        ).join('\n')}`
      : ''

    const funnelBlock = data.funnel
      ? `\nВоронка продаж:\n  Лидов: ${data.funnel.leadsReceived} → Квал: ${data.funnel.qualifiedLeads} → Передано: ${data.funnel.meetingsScheduled} → Консультации: ${data.funnel.meetingsAttended} → Продажи: ${data.funnel.salesCount}`
      : ''

    return `Ты — опытный РОП-аналитик (руководитель отдела продаж). Ты отвечаешь на ${lang} языке.

${periodBlock}
📊 ПОКАЗАТЕЛИ ОТДЕЛА:
  План продаж: ₸${fmtNum(s.salesPlan)}
  Факт продаж: ₸${fmtNum(s.salesAmount)}
  Выполнение: ${fmtPct(s.planCompletion)}
  Кол-во сделок: ${fmtNum(s.salesCount)}
  Средний чек: ₸${fmtNum(s.avgCheck)}
  Конверсия: ${fmtPct(s.conversion)}
  Консультаций: ${fmtNum(s.totalConsultations)}
  Отказов: ${fmtNum(s.totalRefusals)}
  В работе: ${fmtNum(s.totalInWork)}
${funnelBlock}
${managerBlock}
${liderBlock}

Задача: как РОП, проведи детальный анализ команды и дай операционные рекомендации.

Структура ответа:
📊 ОЦЕНКА ОТДЕЛА (1-2 предложения с главными числами)

🏆 ЛИДЕРЫ (кто молодец и почему):
• [имя: конкретный результат]

⚠️ ОТСТАЮЩИЕ (кому нужна помощь и почему):
• [имя: конкретная проблема с числами]

🔍 ВОРОНКА — где теряем (с %):
• [конкретный этап потерь]

📋 ДЕЙСТВИЯ НА НЕДЕЛЮ:
• [конкретное действие с именами]
• [конкретное действие]
• [конкретное действие]

💡 ИНСАЙТ НЕДЕЛИ:
• [одно самое важное наблюдение]

Называй менеджеров по именам. Используй только конкретные числа из данных. ВАЖНО: в системе нет ежедневных отчётов — оценка строится по продажам, конверсии и статусам лидов. Не упоминай "нет отчёта" или "не сдал отчёт".`
  }

  // ── MANAGER (CLOSER) prompt ──
  if (data.role === 'MANAGER' && data.managerType !== 'LIDER') {
    return `Ты — персональный AI-коуч для клоузера (менеджера по продажам). Ты отвечаешь на ${lang} языке.

${periodBlock}
📊 МОИ ПОКАЗАТЕЛИ:
  План: ₸${fmtNum(s.salesPlan)}
  Факт: ₸${fmtNum(s.salesAmount)}
  Выполнение: ${fmtPct(s.planCompletion)}
  Кол-во продаж: ${s.salesCount}
  Средний чек: ₸${fmtNum(s.avgCheck)}
  Конверсия: ${fmtPct(s.conversion)}
  Консультаций проведено: ${s.consultations}
  Отказов: ${s.refusals}
  В работе: ${s.inWork}
  До конца плана: ₸${fmtNum(Math.max(0, Number(s.salesPlan || 0) - Number(s.salesAmount || 0)))}

Задача: дай персональный разбор и конкретный план действий для клоузера.

Структура ответа:
💪 МОЙ РЕЗУЛЬТАТ (честная оценка ситуации)

🎯 КОНВЕРСИЯ — что делать:
• [конкретный совет для улучшения процента закрытия]

📞 РАБОТА СО ВСТРЕЧАМИ:
• [как работать с очередью "в работе" и снизить отказы]

💰 ПЛАН — как закрыть:
• [конкретный расчёт: сколько сделок/по какой сумме нужно]

⚡ ФОКУС НА НЕДЕЛЮ:
1. [действие]
2. [действие]
3. [действие]

Говори как коуч — прямо, конкретно, мотивирующе. Используй числа.`
  }

  // ── MANAGER (LIDER) prompt ──
  if (data.role === 'MANAGER' && data.managerType === 'LIDER') {
    return `Ты — персональный AI-коуч для лидоруба (специалист по квалификации лидов). Ты отвечаешь на ${lang} языке.

${periodBlock}
📊 МОИ ПОКАЗАТЕЛИ:
  Всего лидов: ${s.totalLeads ?? s.leads ?? 0}
  Квалифицировано: ${s.qualifiedLeads}
  Конверсия в квалификацию: ${fmtPct(s.qualRate)}
  Записано на встречи: ${s.meetingsScheduled}
  Встреч состоялось: ${s.meetingsAttended}
  Конверсия в запись: ${fmtPct(s.pctScheduled)}
  Конверсия в состоявшуюся встречу: ${fmtPct(s.pctAttended)}
  План встреч: ${s.meetingsPlan ?? '—'}
  Выполнение плана: ${fmtPct(s.completion)}

Задача: дай персональный разбор для лидоруба и конкретный план улучшений.

Структура ответа:
💪 МОЙ РЕЗУЛЬТАТ (оценка воронки)

🔍 КВАЛИФИКАЦИЯ — где теряю:
• [конкретный этап, где падает конверсия]

📅 ВСТРЕЧИ — как улучшить доходимость:
• [конкретный совет]

🎯 ФОКУС НА НЕДЕЛЮ:
1. [действие]
2. [действие]
3. [действие]

Говори конкретно, с числами.`
  }

  // ── MARKETER prompt ──
  if (data.role === 'MARKETER') {
    return `Ты — AI-аналитик для маркетолога. Ты отвечаешь на ${lang} языке.

${periodBlock}
📊 МОИ ПОКАЗАТЕЛИ:
  План лидов: ${fmtNum(s.leadsplan)}
  Факт лидов: ${fmtNum(s.totalLeads)}
  Выполнение: ${fmtPct(s.planCompletion)}
  Квалифицировано: ${fmtNum(s.totalQualified)}
  Бюджет план: ₸${fmtNum(s.budgetPlan)}
  Бюджет факт: ₸${fmtNum(s.totalBudget)}
  Стоимость лида (CPL): ₸${fmtNum(s.leadCost)}
  Стоимость квал лида (CPQL): ₸${fmtNum(s.qualifiedLeadCost)}
  Прогноз лидов: ${fmtNum(s.projectedLeads)}

Задача: дай аналитику и рекомендации для маркетолога.

Структура ответа:
📊 СИТУАЦИЯ (оценка эффективности)

💰 СТОИМОСТЬ ЛИДА — что делать:
• [конкретное действие для снижения CPL]

🎯 КАЧЕСТВО ЛИДОВ:
• [как улучшить конверсию в квалификацию]

📈 ПРОГНОЗ:
• [выполнимо ли план, что надо сделать]

⚡ ПРИОРИТЕТЫ:
1. [действие]
2. [действие]
3. [действие]

Используй числа. Будь конкретным.`
  }

  // ── Default fallback prompt ──
  return `Ты — AI-аналитик системы продаж. Проанализируй данные и дай рекомендации на ${lang} языке.

${periodBlock}
Данные: ${JSON.stringify(data.summary, null, 2)}

Дай краткий анализ (4-5 пунктов) с конкретными числами и действиями.`
}

// ── Main function ────────────────────────────────────────────────────────────

export async function generateAIInsights(data: DashboardData): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateFallbackInsights(data)
  }

  const prompt = buildPrompt(data)

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    return (message.content[0] as any).text || generateFallbackInsights(data)
  } catch (e) {
    console.error('AI error:', e)
    return generateFallbackInsights(data)
  }
}

// ── Fallback (no API key or error) ───────────────────────────────────────────

function generateFallbackInsights(data: DashboardData): string {
  const { summary: s, managerRating, liderRating, funnel } = data
  const isKk = data.lang === 'kk'
  const lines: string[] = []
  const fmtNum = (n: any) => Number(n || 0).toLocaleString('ru')
  const fmtPct = (n: any) => `${Number(n || 0).toFixed(1)}%`

  const completion = Number(s.planCompletion || 0)
  const conversion = Number(s.conversion || 0)
  const today = new Date().getDate()
  const daysLeft = 30 - today

  // ── Plan status ──
  if (completion >= 100) {
    lines.push(`✅ План выполнен на ${fmtPct(completion)} — отличный результат! Сумма продаж: ₸${fmtNum(s.totalSalesAmount ?? s.salesAmount)}.`)
  } else if (completion >= 75) {
    const remaining = Number(s.salesPlan || 0) - Number(s.totalSalesAmount ?? s.salesAmount ?? 0)
    const needed = daysLeft > 0 ? Math.round(remaining / daysLeft) : remaining
    lines.push(`📊 План выполнен на ${fmtPct(completion)}. Осталось ₸${fmtNum(remaining)} — нужно ₸${fmtNum(needed)}/день до конца месяца.`)
  } else if (completion >= 40) {
    const remaining = Number(s.salesPlan || 0) - Number(s.totalSalesAmount ?? s.salesAmount ?? 0)
    const needed = daysLeft > 0 ? Math.round(remaining / daysLeft) : remaining
    lines.push(`⚠️ План выполнен лишь на ${fmtPct(completion)}. Критическое отставание! Нужно ₸${fmtNum(needed)}/день — ускорьте темп немедленно.`)
  } else if (completion > 0) {
    lines.push(`🔴 Критическая ситуация: план выполнен только на ${fmtPct(completion)}. Немедленно требуется вмешательство и разбор причин отставания.`)
  }

  // ── Conversion analysis ──
  if (conversion > 0) {
    const consultations = Number(s.totalConsultations || s.consultations || 0)
    const salesCount = Number(s.totalSalesCount ?? s.salesCount ?? 0)
    const refusals = Number(s.totalRefusals || s.refusals || 0)
    if (conversion >= 40) {
      lines.push(`📈 Конверсия ${fmtPct(conversion)} — отличный показатель. Из ${consultations} консультаций ${salesCount} продаж, ${refusals} отказов.`)
    } else if (conversion >= 20) {
      lines.push(`📉 Конверсия ${fmtPct(conversion)} — есть резервы роста. Из ${consultations} консультаций только ${salesCount} продаж. Разберите причины ${refusals} отказов.`)
    } else if (conversion > 0) {
      lines.push(`🔴 Конверсия ${fmtPct(conversion)} — критически низкая! Из ${consultations} консультаций лишь ${salesCount} продаж. Срочно проведите разбор звонков.`)
    }
  }

  // ── Funnel drop-off ──
  if (funnel && funnel.leadsReceived > 0) {
    const qualRate = Math.round((funnel.qualifiedLeads / funnel.leadsReceived) * 100)
    const scheduleRate = funnel.qualifiedLeads > 0 ? Math.round((funnel.meetingsScheduled / funnel.qualifiedLeads) * 100) : 0
    const attendRate = funnel.meetingsScheduled > 0 ? Math.round((funnel.meetingsAttended / funnel.meetingsScheduled) * 100) : 0
    const closeRate = funnel.meetingsAttended > 0 ? Math.round((funnel.salesCount / funnel.meetingsAttended) * 100) : 0

    const bottleneck = [
      { stage: 'квалификация', rate: qualRate },
      { stage: 'запись на встречу', rate: scheduleRate },
      { stage: 'доходимость на встречу', rate: attendRate },
      { stage: 'закрытие в продажу', rate: closeRate },
    ].reduce((min, cur) => cur.rate < min.rate && cur.rate > 0 ? cur : min, { stage: '', rate: 100 })

    if (bottleneck.stage) {
      lines.push(`🔍 Воронка: ${funnel.leadsReceived} лидов → ${funnel.qualifiedLeads} квал (${qualRate}%) → ${funnel.meetingsScheduled} записано (${scheduleRate}%) → ${funnel.meetingsAttended} состоялось (${attendRate}%) → ${funnel.salesCount} продаж (${closeRate}%). Узкое место: ${bottleneck.stage} (${bottleneck.rate}%).`)
    }
  }

  // ── Manager performance ──
  if (managerRating && managerRating.length > 0) {
    const redManagers = managerRating.filter((m: any) => m.status === 'red')
    const top = managerRating.find((m: any) => m.status === 'green' || m.completion > 80)
    const bottom = [...managerRating].reverse().find((m: any) => m.completion < 30)

    if (top) {
      lines.push(`🏆 Лидер: ${top.name} — выполнение ${fmtPct(top.completion)}, ${top.salesCount} продаж на ₸${fmtNum(top.salesAmount)}, конверсия ${fmtPct(top.conversion)}.`)
    }
    if (bottom && bottom.name !== top?.name) {
      lines.push(`⚠️ Нуждается в поддержке: ${bottom.name} — только ${fmtPct(bottom.completion)} плана, конверсия ${fmtPct(bottom.conversion)}. Запланируйте разбор сделок.`)
    }
    if (redManagers.length > 0) {
      lines.push(`🔴 Нет продаж: ${redManagers.map((m: any) => m.name).join(', ')} (${redManagers.length} чел.). Проведите разбор и помогите с первыми сделками.`)
    }
  }

  // ── Lider performance ──
  if (liderRating && liderRating.length > 0) {
    const totalLeads = liderRating.reduce((s: number, m: any) => s + (m.leads || 0), 0)
    const totalQual = liderRating.reduce((s: number, m: any) => s + (m.qualifiedLeads || 0), 0)
    const avgQualRate = totalLeads > 0 ? Math.round((totalQual / totalLeads) * 100) : 0
    lines.push(`👥 Лидорубы: ${totalLeads} лидов, ${totalQual} квалифицировано (${avgQualRate}% квалификации). ${liderRating.map((m: any) => `${m.name}: ${m.leads} лидов`).join(', ')}.`)
  }

  // ── Lead cost / marketing ──
  if (s.leadCost && Number(s.leadCost) > 0) {
    const leadsplan = Number(s.leadsplan || 0)
    const marketingLeads = Number(s.marketingLeads || 0)
    if (leadsplan > 0 && marketingLeads < leadsplan) {
      lines.push(`💰 Маркетинг: ${marketingLeads} лидов из ${leadsplan} плана (${Math.round(marketingLeads/leadsplan*100)}%). Стоимость лида: ₸${fmtNum(s.leadCost)}. Необходимо усилить каналы привлечения.`)
    } else {
      lines.push(`💰 Стоимость лида: ₸${fmtNum(s.leadCost)}. Лидов факт: ${fmtNum(s.marketingLeads)}.`)
    }
  }

  // ── Marketer-specific ──
  if (data.role === 'MARKETER') {
    const cpl = Number(s.leadCost || 0)
    const cpql = Number(s.qualifiedLeadCost || 0)
    const projected = Number(s.projectedLeads || 0)
    const plan = Number(s.leadsplan || 0)
    lines.length = 0 // reset for marketer
    lines.push(`📊 Маркетинг: план ${fmtNum(plan)} лидов, факт ${fmtNum(s.totalLeads)}, выполнение ${fmtPct(completion)}.`)
    if (cpl > 0) lines.push(`💰 CPL: ₸${fmtNum(cpl)}, CPQL: ₸${fmtNum(cpql)}. ${cpql > cpl * 3 ? 'Качество лидов низкое — много неквалифицированных.' : 'Качество лидов в норме.'}`)
    if (projected > 0 && plan > 0) {
      lines.push(projected >= plan
        ? `📈 Прогноз: ${fmtNum(projected)} лидов — план будет выполнен.`
        : `⚠️ Прогноз: ${fmtNum(projected)} лидов — план под угрозой. Нужно увеличить интенсивность на ${Math.round((plan - projected) / Math.max(1, 30 - today))} лидов/день.`
      )
    }
    if (!lines.some(l => l.includes('💡'))) {
      lines.push(`💡 Фокус: улучшить качество трафика и снизить стоимость квалифицированного лида.`)
    }
  }

  // ── Manager (closer) self-view ──
  if (data.role === 'MANAGER' && data.managerType !== 'LIDER') {
    lines.length = 0
    const inWork = Number(s.inWork || 0)
    const refusals = Number(s.refusals || 0)
    const salesCount = Number(s.salesCount || 0)
    const avgCheck = Number(s.avgCheck || 0)
    const remaining = Math.max(0, Number(s.salesPlan || 0) - Number(s.salesAmount || 0))
    const needDeals = avgCheck > 0 ? Math.ceil(remaining / avgCheck) : '?'

    lines.push(`${completion >= 75 ? '📊' : completion >= 40 ? '⚠️' : '🔴'} Результат: ₸${fmtNum(s.salesAmount)} — ${fmtPct(completion)} плана. ${salesCount} продаж.`)
    if (inWork > 0) lines.push(`📋 В работе ${inWork} клиентов — проработайте каждого. При конверсии ${fmtPct(conversion)} можно закрыть ещё ${Math.round(inWork * conversion / 100)} сделок.`)
    if (refusals > 0) lines.push(`📉 Отказов: ${refusals}. Разберите причины — возможно, нужна работа с возражениями.`)
    if (remaining > 0) lines.push(`🎯 До плана осталось ₸${fmtNum(remaining)} — нужно ещё ~${needDeals} сделок по среднему чеку ₸${fmtNum(avgCheck)}.`)
    lines.push(`⚡ Фокус: закрывайте клиентов "в работе", запрашивайте обратную связь по отказам, работайте с возражениями.`)
  }

  // ── Lider self-view ──
  if (data.role === 'MANAGER' && data.managerType === 'LIDER') {
    lines.length = 0
    const leads = Number(s.totalLeads ?? s.leads ?? 0)
    const qual = Number(s.qualifiedLeads || 0)
    const scheduled = Number(s.meetingsScheduled || 0)
    const attended = Number(s.meetingsAttended || 0)

    lines.push(`📊 Воронка: ${leads} лидов → ${qual} квал (${leads > 0 ? Math.round(qual/leads*100) : 0}%) → ${scheduled} записано → ${attended} состоялось.`)
    const dropSchedule = qual > 0 ? Math.round((1 - scheduled/qual) * 100) : 0
    const dropAttend = scheduled > 0 ? Math.round((1 - attended/scheduled) * 100) : 0
    if (dropSchedule > 30) lines.push(`⚠️ Из ${qual} квалифицированных не записано ${qual - scheduled} (${dropSchedule}%) — проверьте работу с клиентами после квалификации.`)
    if (dropAttend > 30) lines.push(`⚠️ Из ${scheduled} записанных не пришли ${scheduled - attended} (${dropAttend}%) — усильте подтверждение встреч накануне.`)
    if (completion > 0) lines.push(`🎯 Выполнение плана встреч: ${fmtPct(completion)}.`)
    lines.push(`⚡ Фокус: качество квалификации и доходимость клиентов на встречи.`)
  }

  if (lines.length === 0) {
    lines.push(`📊 Нет достаточно данных для анализа за период. Убедитесь, что менеджеры фиксируют результаты.`)
  }

  return lines.join('\n\n')
}
