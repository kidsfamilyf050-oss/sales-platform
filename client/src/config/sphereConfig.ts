// ─── Sphere-specific field label configuration ───────────────────────────────
//
// All spheres use the SAME underlying DB fields (consultations, clients,
// meetingsScheduled, meetingsAttended, etc.) — only the labels change.
//
// Spheres: edu | med | realty | it | retail | services | construction | other

export type SphereKey =
  | 'edu'
  | 'med'
  | 'realty'
  | 'it'
  | 'retail'
  | 'services'
  | 'construction'
  | 'other'

export interface SphereConfig {
  /** Display name of this sphere */
  name: string

  /** Labels used in the Closer daily report form */
  closer: {
    /** "Входящих заявок" / "Обращений" / "Посетителей" */
    clients: string
    /** "Консультаций" / "Приёмов" / "Показов" / "Демо" */
    consultations: string
    /** "Отказов" / "Отмен" / "Ушли без покупки" */
    refusals: string
    /** Placeholder for comment field */
    commentPlaceholder: string
    /** Hint text inside the form card */
    hint: string
  }

  /** Labels used in the Lider daily report form */
  lider: {
    /** "Лидов получено" */
    leadsReceived: string
    /** "Обработано" */
    processed: string
    /** "Квалифицировано" */
    qualified: string
    /** "Записано на встречу" / "Записано на приём" / "Показ запланирован" */
    meetingScheduled: string
    /** "Консультация состоялась" / "Пришло на приём" / "Показ состоялся" */
    meetingAttended: string
    /** Placeholder for comment field */
    commentPlaceholder: string
  }

  /** Labels used in TrackingPage column headers and dashboards */
  tracking: {
    clients: string
    consultations: string
    meetingsScheduled: string
    meetingsAttended: string
  }

  /** Funnel step labels for Owner/ROP dashboards */
  funnel: {
    leads: string
    qualified: string
    meetingsScheduled: string
    meetingsAttended: string
    sales: string
  }
}

// ─── Sphere definitions ──────────────────────────────────────────────────────

const SPHERES: Record<SphereKey, SphereConfig> = {

  // ── EdTech / Образование ──────────────────────────────────────────────────
  edu: {
    name: 'Образование / EdTech',
    closer: {
      clients:           'Входящих заявок',
      consultations:     'Консультаций проведено',
      refusals:          'Отказов',
      commentPlaceholder:'Что мешало? Какие сложности?',
      hint:              'Продажи вносятся отдельно — кнопка «+ Продажа» в кабинете. Здесь только статистика дня.',
    },
    lider: {
      leadsReceived:     'Лидов получено',
      processed:         'Обработано лидов',
      qualified:         'Квалифицировано',
      meetingScheduled:  'Записано на консультацию',
      meetingAttended:   'Консультация состоялась',
      commentPlaceholder:'Качество лидов, источники, замечания...',
    },
    tracking: {
      clients:           'Входящих заявок',
      consultations:     'Консультаций',
      meetingsScheduled: 'Записано',
      meetingsAttended:  'Консультации',
    },
    funnel: {
      leads:             'Лидов получено',
      qualified:         'Квалифицировано',
      meetingsScheduled: 'Записано на консультацию',
      meetingsAttended:  'Консультаций состоялось',
      sales:             'Продажи',
    },
  },

  // ── Медицинский центр ─────────────────────────────────────────────────────
  med: {
    name: 'Медицинский центр',
    closer: {
      clients:           'Пациентов обратилось',
      consultations:     'Приёмов проведено',
      refusals:          'Отказов от лечения',
      commentPlaceholder:'Замечания по качеству записей, сложным случаям...',
      hint:              'Оплаты / назначения лечения вносятся отдельно — кнопка «+ Продажа» в кабинете.',
    },
    lider: {
      leadsReceived:     'Обращений получено',
      processed:         'Обработано обращений',
      qualified:         'Квалифицировано',
      meetingScheduled:  'Записано на приём',
      meetingAttended:   'Пришло на приём',
      commentPlaceholder:'Качество обращений, источники, проблемные моменты...',
    },
    tracking: {
      clients:           'Пациентов',
      consultations:     'Приёмов',
      meetingsScheduled: 'Записано',
      meetingsAttended:  'Пришло',
    },
    funnel: {
      leads:             'Обращений получено',
      qualified:         'Квалифицировано',
      meetingsScheduled: 'Записано на приём',
      meetingsAttended:  'Пришло на приём',
      sales:             'Лечений назначено',
    },
  },

  // ── Недвижимость ──────────────────────────────────────────────────────────
  realty: {
    name: 'Недвижимость',
    closer: {
      clients:           'Входящих обращений',
      consultations:     'Показов объекта',
      refusals:          'Отказов',
      commentPlaceholder:'Возражения, предпочтения клиентов, объекты интереса...',
      hint:              'Сделки / авансы вносятся отдельно — кнопка «+ Продажа» в кабинете.',
    },
    lider: {
      leadsReceived:     'Лидов получено',
      processed:         'Обработано лидов',
      qualified:         'Квалифицировано',
      meetingScheduled:  'Показ запланирован',
      meetingAttended:   'Показ состоялся',
      commentPlaceholder:'Качество лидов, предпочтения по объектам...',
    },
    tracking: {
      clients:           'Обращений',
      consultations:     'Показов',
      meetingsScheduled: 'Показов план.',
      meetingsAttended:  'Показов факт.',
    },
    funnel: {
      leads:             'Лидов получено',
      qualified:         'Квалифицировано',
      meetingsScheduled: 'Показов запланировано',
      meetingsAttended:  'Показов состоялось',
      sales:             'Сделок закрыто',
    },
  },

  // ── IT и технологии ───────────────────────────────────────────────────────
  it: {
    name: 'IT и технологии',
    closer: {
      clients:           'Лидов / запросов',
      consultations:     'Демо / звонков',
      refusals:          'Отказов',
      commentPlaceholder:'Возражения, технические вопросы, следующие шаги...',
      hint:              'Договоры / оплаты вносятся отдельно — кнопка «+ Продажа» в кабинете.',
    },
    lider: {
      leadsReceived:     'Лидов получено',
      processed:         'Обработано лидов',
      qualified:         'Квалифицировано',
      meetingScheduled:  'Запись на демо',
      meetingAttended:   'Демо состоялось',
      commentPlaceholder:'Качество лидов, источники, технические детали...',
    },
    tracking: {
      clients:           'Лидов',
      consultations:     'Демо / звонков',
      meetingsScheduled: 'Запись на демо',
      meetingsAttended:  'Демо факт.',
    },
    funnel: {
      leads:             'Лидов получено',
      qualified:         'Квалифицировано',
      meetingsScheduled: 'Запись на демо',
      meetingsAttended:  'Демо состоялось',
      sales:             'Договоров подписано',
    },
  },

  // ── Розничная торговля ────────────────────────────────────────────────────
  retail: {
    name: 'Розничная торговля',
    closer: {
      clients:           'Посетителей',
      consultations:     'Обслужено покупателей',
      refusals:          'Ушли без покупки',
      commentPlaceholder:'Популярные товары, возражения, акции...',
      hint:              'Чеки / продажи вносятся отдельно — кнопка «+ Продажа» в кабинете.',
    },
    lider: {
      leadsReceived:     'Обращений получено',
      processed:         'Обработано',
      qualified:         'Заинтересованных',
      meetingScheduled:  'Визит запланирован',
      meetingAttended:   'Визит состоялся',
      commentPlaceholder:'Качество трафика, источники, акции...',
    },
    tracking: {
      clients:           'Посетителей',
      consultations:     'Обслужено',
      meetingsScheduled: 'Визитов план.',
      meetingsAttended:  'Визитов факт.',
    },
    funnel: {
      leads:             'Обращений',
      qualified:         'Заинтересованных',
      meetingsScheduled: 'Визитов план.',
      meetingsAttended:  'Визитов факт.',
      sales:             'Продаж / чеков',
    },
  },

  // ── Услуги ────────────────────────────────────────────────────────────────
  services: {
    name: 'Услуги',
    closer: {
      clients:           'Заявок получено',
      consultations:     'КП отправлено / встреч',
      refusals:          'Отказов',
      commentPlaceholder:'Возражения, типичные вопросы, причины отказов...',
      hint:              'Договоры / оплаты вносятся отдельно — кнопка «+ Продажа» в кабинете.',
    },
    lider: {
      leadsReceived:     'Лидов получено',
      processed:         'Обработано лидов',
      qualified:         'Квалифицировано',
      meetingScheduled:  'Встреча запланирована',
      meetingAttended:   'Встреча состоялась',
      commentPlaceholder:'Качество лидов, источники, замечания...',
    },
    tracking: {
      clients:           'Заявок',
      consultations:     'КП / встреч',
      meetingsScheduled: 'Встреч план.',
      meetingsAttended:  'Встреч факт.',
    },
    funnel: {
      leads:             'Лидов получено',
      qualified:         'Квалифицировано',
      meetingsScheduled: 'Встреч запланировано',
      meetingsAttended:  'Встреч состоялось',
      sales:             'Договоров заключено',
    },
  },

  // ── Строительство ─────────────────────────────────────────────────────────
  construction: {
    name: 'Строительство',
    closer: {
      clients:           'Обращений',
      consultations:     'Выездов / замеров',
      refusals:          'Отказов',
      commentPlaceholder:'Тип объекта, бюджет, сроки, возражения...',
      hint:              'Договоры / авансы вносятся отдельно — кнопка «+ Продажа» в кабинете.',
    },
    lider: {
      leadsReceived:     'Обращений получено',
      processed:         'Обработано',
      qualified:         'Квалифицировано',
      meetingScheduled:  'Выезд / замер запланирован',
      meetingAttended:   'Выезд / замер состоялся',
      commentPlaceholder:'Качество обращений, типы объектов, замечания...',
    },
    tracking: {
      clients:           'Обращений',
      consultations:     'Выездов / замеров',
      meetingsScheduled: 'Выездов план.',
      meetingsAttended:  'Выездов факт.',
    },
    funnel: {
      leads:             'Обращений получено',
      qualified:         'Квалифицировано',
      meetingsScheduled: 'Выездов / замеров план.',
      meetingsAttended:  'Выездов / замеров факт.',
      sales:             'Договоров подписано',
    },
  },

  // ── Другое (generic fallback) ─────────────────────────────────────────────
  other: {
    name: 'Другое',
    closer: {
      clients:           'Клиентов / заявок',
      consultations:     'Встреч / презентаций',
      refusals:          'Отказов',
      commentPlaceholder:'Замечания по итогам дня...',
      hint:              'Продажи вносятся отдельно — кнопка «+ Продажа» в кабинете.',
    },
    lider: {
      leadsReceived:     'Лидов получено',
      processed:         'Обработано',
      qualified:         'Квалифицировано',
      meetingScheduled:  'Встреча запланирована',
      meetingAttended:   'Встреча состоялась',
      commentPlaceholder:'Качество лидов, источники, замечания...',
    },
    tracking: {
      clients:           'Клиентов',
      consultations:     'Встреч',
      meetingsScheduled: 'Встреч план.',
      meetingsAttended:  'Встреч факт.',
    },
    funnel: {
      leads:             'Лидов получено',
      qualified:         'Квалифицировано',
      meetingsScheduled: 'Встреч запланировано',
      meetingsAttended:  'Встреч состоялось',
      sales:             'Продаж',
    },
  },
}

// ─── Public helpers ──────────────────────────────────────────────────────────

/**
 * Backward-compat map: old DB values may have been stored as translated display names
 * (e.g. "Розничная торговля" instead of "retail"). Map them back to keys.
 */
const DISPLAY_TO_KEY: Record<string, SphereKey> = {
  // Russian names
  'Образование': 'edu',
  'Образование / EdTech': 'edu',
  'Медицинский центр': 'med',
  'Недвижимость': 'realty',
  'IT и технологии': 'it',
  'Розничная торговля': 'retail',
  'Услуги': 'services',
  'Строительство': 'construction',
  'Другое': 'other',
  // Kazakh names
  'Білім': 'edu',
  'Медициналық орталық': 'med',
  'Жылжымайтын мүлік': 'realty',
  'АТ және технологиялар': 'it',
  'Бөлшек сауда': 'retail',
  'Қызметтер': 'services',
  'Құрылыс': 'construction',
  'Басқа': 'other',
}

/** Get the sphere config for a given sphere key (falls back to 'other' for null/unknown) */
export function getSphereConfig(sphere: string | null | undefined): SphereConfig {
  if (!sphere) return SPHERES.other
  const normalized = (DISPLAY_TO_KEY[sphere] ?? sphere) as SphereKey
  return SPHERES[normalized] ?? SPHERES.other
}

export default SPHERES
