import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.yandex.ru',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE !== 'false', // true by default for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export const sendInviteEmail = async (email: string, name: string, inviteToken: string, companyName: string) => {
  const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/accept-invite?token=${inviteToken}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Sirius Track <noreply@sirius-track.kz>',
    to: email,
    subject: `Приглашение в ${companyName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Привет, ${name}!</h2>
        <p>Вас приглашают присоединиться к платформе управления продажами компании <strong>${companyName}</strong>.</p>
        <p>Нажмите на кнопку ниже, чтобы принять приглашение и создать пароль:</p>
        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Принять приглашение
        </a>
        <p style="color: #6b7280; font-size: 14px;">Или перейдите по ссылке: ${inviteUrl}</p>
      </div>
    `,
  })
}

// ─── Sent on registration: credentials + "access pending payment" ─────────────
export const sendWelcomeEmail = async (
  email: string,
  name: string,
  password: string,
  companyName: string,
) => {
  const loginUrl = process.env.CLIENT_URL || 'https://sirius-track.kz'
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Sirius Track <noreply@sirius-track.kz>',
    to: email,
    subject: 'Добро пожаловать в Sirius Track — ваш аккаунт создан',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Sirius Track</h1>
          <p style="color: #93c5fd; margin: 4px 0 0; font-size: 14px;">Платформа управления продажами</p>
        </div>
        <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="margin-top: 0;">Здравствуйте, ${name}!</h2>
          <p>Вы успешно зарегистрировались в системе Sirius Track. Ваши данные для входа:</p>
          <div style="background: white; border: 1px solid #d1d5db; border-radius: 6px; padding: 16px 20px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 4px 0;"><strong>Пароль:</strong> ${password}</p>
            <p style="margin: 4px 0;"><strong>Компания:</strong> ${companyName}</p>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              ⏳ <strong>Доступ к системе будет предоставлен после проверки оплаты.</strong><br>
              Обычно это занимает не более 1 рабочего дня. Как только доступ будет открыт — вы получите письмо на этот адрес.
            </p>
          </div>
          <p>По всем вопросам пишите нам: <a href="mailto:info@sirius-track.kz">info@sirius-track.kz</a></p>
          <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background: #1e3a5f; color: white; text-decoration: none; border-radius: 6px; margin: 8px 0;">
            Перейти на сайт
          </a>
        </div>
      </div>
    `,
  })
}

// ─── Sent when admin activates the company ────────────────────────────────────
export const sendAccessApprovedEmail = async (
  email: string,
  name: string,
  companyName: string,
) => {
  const loginUrl = process.env.CLIENT_URL || 'https://sirius-track.kz'
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Sirius Track <noreply@sirius-track.kz>',
    to: email,
    subject: '✅ Ваш доступ к Sirius Track открыт',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Sirius Track</h1>
          <p style="color: #93c5fd; margin: 4px 0 0; font-size: 14px;">Платформа управления продажами</p>
        </div>
        <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="margin-top: 0;">Здравствуйте, ${name}!</h2>
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 14px 18px; margin: 0 0 20px;">
            <p style="margin: 0; color: #166534;">
              ✅ <strong>Оплата подтверждена — ваш доступ к системе открыт!</strong>
            </p>
          </div>
          <p>Компания <strong>${companyName}</strong> теперь полностью активирована. Войдите в систему, чтобы начать работу.</p>
          <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px; margin: 8px 0;">
            Войти в Sirius Track
          </a>
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            По вопросам работы системы: <a href="mailto:info@sirius-track.kz">info@sirius-track.kz</a>
          </p>
        </div>
      </div>
    `,
  })
}

export const sendResetPasswordEmail = async (email: string, name: string, resetUrl: string) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Sirius Track <noreply@sirius-track.kz>',
    to: email,
    subject: '🔑 Сброс пароля — Sirius Track',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Sirius Track</h1>
          <p style="color: #93c5fd; margin: 4px 0 0; font-size: 14px;">Платформа управления продажами</p>
        </div>
        <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="margin-top: 0;">Здравствуйте, ${name}!</h2>
          <p>Мы получили запрос на сброс пароля для вашего аккаунта.</p>
          <p>Нажмите на кнопку ниже чтобы установить новый пароль. Ссылка действительна <strong>1 час</strong>.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #1e3a5f; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Сбросить пароль
          </a>
          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
            Если вы не запрашивали сброс пароля — проигнорируйте это письмо. Ваш пароль останется без изменений.
          </p>
          <p style="color: #6b7280; font-size: 13px;">По вопросам: <a href="mailto:info@sirius-track.kz">info@sirius-track.kz</a></p>
        </div>
      </div>
    `,
  })
}

export const sendReportReminderEmail = async (email: string, name: string) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Sirius Track <noreply@sirius-track.kz>',
    to: email,
    subject: 'Напоминание: не заполнен ежедневный отчёт',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Привет, ${name}!</h2>
        <p>Вы ещё не заполнили ежедневный отчёт за сегодня.</p>
        <p>Пожалуйста, войдите в систему и заполните отчёт.</p>
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Заполнить отчёт
        </a>
      </div>
    `,
  })
}
