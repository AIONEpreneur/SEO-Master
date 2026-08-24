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

  const isFirstUser = (await db.user.count()) === 0

  // Nach dem ersten Konto ist die Registrierung geschlossen, sofern sie nicht
  // ausdrücklich geöffnet wurde. Ohne diese Sperre könnte sich jede Person,
  // die die Adresse kennt, einen eigenen Arbeitsbereich anlegen.
  if (!isFirstUser && !registrationOpen(parsed.data.email)) {
    return { error: 'Die Registrierung ist geschlossen. Bitte wenden Sie sich an die Verwaltung dieser Instanz.' }
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return { error: 'Für diese E-Mail-Adresse besteht bereits ein Konto.' }

  const slug = await uniqueSlug(organizationName)

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

/**
 * Darf sich diese Adresse registrieren?
 *
 * Reihenfolge: eine hinterlegte Adressliste hat Vorrang, danach entscheidet
 * ALLOW_PUBLIC_SIGNUP. Ist beides nicht gesetzt, bleibt die Registrierung zu.
 */
function registrationOpen(email: string): boolean {
  const e = env()
  const allowlist = e.ALLOWED_SIGNUP_EMAILS?.split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)

  if (allowlist?.length) return allowlist.includes(email)
  return e.ALLOW_PUBLIC_SIGNUP === 'true'
}

/** Für die Anzeige: Ist die Registrierung überhaupt offen? */
export async function isRegistrationOpen(): Promise<boolean> {
  if ((await db.user.count()) === 0) return true
  const e = env()
  const allowlist = e.ALLOWED_SIGNUP_EMAILS?.split(',').map((x) => x.trim()).filter(Boolean)
  return Boolean(allowlist?.length) || e.ALLOW_PUBLIC_SIGNUP === 'true'
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
