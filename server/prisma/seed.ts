import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'kidsfamilyf050@gmail.com'
  const password = process.env.SUPER_ADMIN_PASSWORD || 'PmS@t2026PmS@t'

  const existing = await prisma.superAdmin.findUnique({ where: { email } })
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.superAdmin.create({ data: { email, passwordHash } })
    console.log(`✅ Super admin created: ${email}`)
  } else {
    console.log(`ℹ️  Super admin already exists: ${email}`)
  }
}

main()
  .catch(e => { console.error('Seed error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
