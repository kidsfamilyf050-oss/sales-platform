import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email    = process.env.SUPER_ADMIN_EMAIL
  const password = process.env.SUPER_ADMIN_PASSWORD

  // Crash loudly if credentials are not set — never use hardcoded defaults in production
  if (!email || !password) {
    console.error('FATAL: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in env vars before running seed.')
    process.exit(1)
  }

  const existing = await prisma.superAdmin.findUnique({ where: { email } })
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.superAdmin.create({ data: { email, passwordHash } })
    console.log(`✅ Super admin created: ${email}`)
  } else {
    console.log(`ℹ️  Super admin already exists: ${email}`)
  }
}

main()
  .catch(e => { console.error('Seed error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
