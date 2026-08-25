'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { randomToken } from '@/lib/crypto/vault'
import { requireSuperAdmin } from './wache'

export type AdminState = { error?: string; hinweis?: string; passwort?: string }

/**
 * Passwort zurücksetzen.
 *
 * Es wird ein neues erzeugt und einmal angezeigt, statt eines gesetzt zu
 * bekommen: So muss niemand ein Passwort im Klartext übermitteln, das die
 * Person sich selbst ausgedacht hat, und es steht nirgends dauerhaft. Alle
 * Sitzungen des Kontos werden dabei beendet.
 */
export async function setzePasswortZurueckAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireSuperAdmin()
  const userId = String(formData.get('userId') ?? '')

  const konto = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  if (!konto) return { error: 'Dieses Konto gibt es nicht.' }

  // Lesbar, aber zufällig – die Person ändert es nach der ersten Anmeldung.
  const neuesPasswort = randomToken(9)

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(neuesPasswort) } }),
    db.session.deleteMany({ where: { userId } }),
    db.auditLog.create({
      data: { userId: admin.id, action: 'admin.password.reset', target: userId },
    }),
  ])

  revalidatePath('/admin/konten')
  return { passwort: neuesPasswort, hinweis: `Neues Passwort für ${konto.email}` }
}

/** Konto sperren oder wieder freigeben. */
export async function schalteSperreAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin()
  const userId = String(formData.get('userId') ?? '')

  const konto = await db.user.findUnique({ where: { id: userId }, select: { suspendedAt: true } })
  if (!konto) return

  // Das eigene Konto zu sperren würde die Verwaltung aussperren.
  if (userId === admin.id) return

  const sperren = konto.suspendedAt === null

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { suspendedAt: sperren ? new Date() : null } }),
    // Beim Sperren die laufenden Sitzungen beenden; die Sitzungsprüfung
    // greift zwar ohnehin, aber ein gesperrtes Konto soll keine offenen
    // Sitzungen behalten.
    ...(sperren ? [db.session.deleteMany({ where: { userId } })] : []),
    db.auditLog.create({
      data: { userId: admin.id, action: sperren ? 'admin.user.suspended' : 'admin.user.restored', target: userId },
    }),
  ])

  revalidatePath('/admin/konten')
}

/** Guthaben eines Arbeitsbereichs setzen. */
export async function setzeGuthabenAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireSuperAdmin()
  const organizationId = String(formData.get('organizationId') ?? '')
  const betrag = Number(formData.get('credits'))

  if (!Number.isInteger(betrag) || betrag < 0 || betrag > 10_000_000) {
    return { error: 'Bitte eine ganze Zahl zwischen 0 und 10.000.000 angeben.' }
  }

  const bereich = await db.organization.findUnique({ where: { id: organizationId }, select: { name: true } })
  if (!bereich) return { error: 'Diesen Arbeitsbereich gibt es nicht.' }

  await db.organization.update({ where: { id: organizationId }, data: { credits: betrag } })
  await db.auditLog.create({
    data: {
      organizationId,
      userId: admin.id,
      action: 'admin.credits.set',
      target: organizationId,
      metadata: { credits: betrag },
    },
  })

  revalidatePath('/admin/arbeitsbereiche')
  return { hinweis: `Guthaben von ${bereich.name} auf ${betrag} gesetzt.` }
}

/** Tarif eines Arbeitsbereichs ändern. */
export async function setzeTarifAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin()
  const organizationId = String(formData.get('organizationId') ?? '')
  const plan = String(formData.get('plan') ?? '')

  const erlaubt = ['INTERNAL', 'FREE', 'STARTER', 'PRO', 'AGENCY'] as const
  if (!(erlaubt as readonly string[]).includes(plan)) return

  await db.organization.update({
    where: { id: organizationId },
    data: { plan: plan as (typeof erlaubt)[number] },
  })
  await db.auditLog.create({
    data: { organizationId, userId: admin.id, action: 'admin.plan.set', target: organizationId, metadata: { plan } },
  })

  revalidatePath('/admin/arbeitsbereiche')
}
