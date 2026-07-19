import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export const sendInviteEmail = async (email: string, name: string, inviteToken: string, companyName: string) => {
  const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/accept-invite?token=${inviteToken}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@salesplatform.com',
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

export const sendReportReminderEmail = async (email: string, name: string) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@salesplatform.com',
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
