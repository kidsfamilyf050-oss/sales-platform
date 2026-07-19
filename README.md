# Sales Platform — Платформа управления отделом продаж

Веб-приложение для ежедневного контроля продаж, маркетинга и AI-аналитики.

## Стек

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Recharts, Zustand
- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **База данных:** PostgreSQL
- **AI:** Anthropic Claude (Haiku)
- **Деплой:** Railway

---

## Быстрый старт (локально)

### 1. Клонировать репозиторий

```bash
git clone https://github.com/YOUR_USERNAME/sales-platform.git
cd sales-platform
```

### 2. Настроить Backend

```bash
cd server
npm install
cp .env.example .env
# Заполни .env: DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
npx prisma db push
npm run dev
```

### 3. Настроить Frontend

```bash
cd ../client
npm install
cp .env.example .env
# Если backend на другом порту — обнови VITE_API_URL
npm run dev
```

Открой http://localhost:5173 → зарегистрируйся как собственник → пройди онбординг.

---

## Деплой на Railway

### Структура на Railway: 3 сервиса

```
sales-platform/
├── server/   → Railway Service "backend"
├── client/   → Railway Service "frontend"
└── (Railway Plugin: PostgreSQL)
```

### Шаги

**1. Создать проект на Railway**
- railway.app → New Project → Empty Project

**2. Добавить PostgreSQL**
- New → Database → PostgreSQL
- Скопируй `DATABASE_URL` из Variables

**3. Задеплоить Backend**
- New → GitHub Repo → выбери репозиторий → Root Directory: `server`
- Добавь переменные окружения:
  ```
  DATABASE_URL=<из PostgreSQL плагина>
  JWT_SECRET=<случайная строка 32+ символа>
  CLIENT_URL=<URL фронтенда после деплоя>
  ANTHROPIC_API_KEY=<sk-ant-...>
  PORT=3001
  ```
- Railway автоматически запустит `npm run build && npm start`

**4. Задеплоить Frontend**
- New → GitHub Repo → Root Directory: `client`
- Добавь переменные окружения:
  ```
  VITE_API_URL=<URL бэкенда>/api
  ```
- Добавь пакет serve: в `package.json` в devDependencies:
  ```json
  "serve": "^14.2.3"
  ```

**5. Обновить CORS**
- В backend перейди в Variables → добавь/обнови:
  ```
  CLIENT_URL=https://your-frontend.railway.app
  ```

---

## Роли пользователей

| Роль | Доступ |
|------|--------|
| Собственник | Все дашборды, планы, сотрудники |
| РОП | Свой отдел, рейтинг менеджеров |
| Менеджер (Клоузер) | Личный кабинет, отчёты |
| Менеджер (Лидоруб) | Личный кабинет, отчёты по лидам |
| Маркетолог | Лидогенерация, бюджет |

---

## Структура проекта

```
sales-platform/
├── server/
│   ├── prisma/schema.prisma     — схема БД
│   └── src/
│       ├── routes/              — API endpoints
│       ├── middleware/auth.ts   — JWT аутентификация
│       └── services/            — AI, Email
└── client/
    └── src/
        ├── pages/               — все страницы по ролям
        ├── components/          — переиспользуемые компоненты
        ├── store/               — Zustand (auth)
        └── api/                 — axios client
```

---

## Загрузка тестовых данных (seed)

Пока seed не добавлен. Используй онбординг после регистрации, затем приглашай сотрудников через раздел «Сотрудники».

---

## Переменные окружения

### Backend (`server/.env`)

| Переменная | Описание |
|-----------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Секрет для JWT токенов |
| `PORT` | Порт сервера (default: 3001) |
| `CLIENT_URL` | URL фронтенда для CORS |
| `ANTHROPIC_API_KEY` | Ключ Anthropic для AI |
| `SMTP_HOST` | SMTP сервер для писем |
| `SMTP_USER` | SMTP логин |
| `SMTP_PASS` | SMTP пароль |

### Frontend (`client/.env`)

| Переменная | Описание |
|-----------|----------|
| `VITE_API_URL` | URL бэкенда `/api` |

---

## Дальнейшее развитие (post-MVP)

- [ ] Push-уведомления (браузерные)
- [ ] Интеграция с AmoCRM / Bitrix24
- [ ] Экспорт отчётов в Excel/PDF
- [ ] Мобильное приложение
- [ ] Многопользовательские отчёты (мультикомпания)
- [ ] Webhooks для уведомлений в Telegram
