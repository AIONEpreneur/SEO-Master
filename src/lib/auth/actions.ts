'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from './password'
import { createSession, destroySession } from './session'
import { env } from '@/lib/env'

const credentials = z.object({
  email: z.string().email('Bitte eine gültige E-Mail-Adresse angeben.'),
  password: z.string().min(10, 'Das Passwort braucht mindestens 10 Zeichen.'),
})

export type FormState = { error?: string; ok?: boolean }

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    password: String(formData.get('password') ?? ''),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } })
  // Bewusst dieselbe Meldung für "kein Konto" und "falsches Passwort" –
  // sonst liesse sich über die Anmeldung herausfinden, welche Adressen
  // registriert sind.
  const invalid: FormState = { error: 'E-Mail-Adresse oder Passwort stimmen nicht.' }
  if (!user) return invalid
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid

  await createSession(user.id)
  await db.auditLog.create({ data: { userId: user.id, action: 'auth.login' } })
  redirect('/dashboard')
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim()
  const organizationName = String(formData.get('organization') ?? '').trim()
  const parsed = credentials.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    password: String(formData.get('password') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!organizationName) return { error: 'Bitte einen Namen für den Arbeitsbereich angeben.' }

  // Solange die App intern läuft, kann die Registrierung auf bekannte
  // Adressen begrenzt werden. Für den späteren Verkauf bleibt die Liste leer.
  const allowlist = env().ALLOWED_SIGNUP_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (allowlist?.length && !allowlist.includes(parsed.data.email)) {
    return { error: 'Diese E-Mail-Adresse ist für die Registrierung nicht freigeschaltet.' }
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return { error: 'Für diese E-Mail-Adresse besteht bereits ein Konto.' }

  const slug = await uniqueSlug(organizationName)
  const isFirstUser = (await db.user.count()) === 0

  const user = await db.user.create({
    data: {
      email: parsed.data.email,
      name: name || null,
      passwordHash: await hashPassword(parsed.data.password),
      // Die erste Person, die sich registriert, betreibt die Instanz.
      isSuperAdmin: isFirstUser,
      memberships: {
        create: {
          role: 'OWNER',
          organization: {
            create: {
              name: organizationName,
              slug,
              plan: isFirstUser ? 'INTERNAL' : 'FREE',
              credits: isFirstUser ? 100000 : 100,
            },
          },
        },
      },
    },
  })

  await createSession(user.id)
  await db.auditLog.create({ data: { userId: user.id, action: 'auth.register' } })
  redirect('/dashboard')
}

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}

async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'arbeitsbereich'

  let slug = base
  let counter = 1
  while (await db.organization.findUnique({ where: { slug } })) {
    slug = `${base}-${++counter}`
  }
  return slug
}
