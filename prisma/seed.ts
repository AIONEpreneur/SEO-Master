/**
 * Ersteinrichtung.
 *
 * Legt Konto und Arbeitsbereich an, wenn die Datenbank noch leer ist. Für den
 * regulären Betrieb nicht nötig – dort führt die Registrierungsseite durch die
 * Einrichtung. Nützlich für automatisierte Installationen.
 *
 * Aufruf:  SEED_EMAIL=... SEED_PASSWORD=... npm run db:seed
 */
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth/password'

const db = new PrismaClient()

async function main() {
  const email = process.env.SEED_EMAIL?.toLowerCase().trim()
  const password = process.env.SEED_PASSWORD
  const organizationName = process.env.SEED_ORG ?? 'Interner Arbeitsbereich'

  if (!email || !password) {
    console.log('SEED_EMAIL und SEED_PASSWORD nicht gesetzt – übersprungen.')
    return
  }
  if (password.length < 10) {
    throw new Error('SEED_PASSWORD braucht mindestens 10 Zeichen.')
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Konto ${email} besteht bereits – nichts zu tun.`)
    return
  }

  const user = await db.user.create({
    data: {
      email,
      name: process.env.SEED_NAME ?? null,
      passwordHash: await hashPassword(password),
      isSuperAdmin: true,
      memberships: {
        create: {
          role: 'OWNER',
          organization: {
            create: {
              name: organizationName,
              slug: 'intern',
              plan: 'INTERNAL',
              credits: 100000,
            },
          },
        },
      },
    },
    include: { memberships: { include: { organization: true } } },
  })

  console.log(`Konto angelegt: ${user.email}`)
  console.log(`Arbeitsbereich: ${user.memberships[0].organization.name}`)
  console.log('Die API-Zugangsdaten werden anschliessend unter /settings/vault hinterlegt.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
