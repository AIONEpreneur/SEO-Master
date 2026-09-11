'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireSession, echteSitzung, destroySession } from '@/lib/auth/session'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { legeBildAb, entferneBild } from './bilder'

/**
 * Das eigene Konto verwalten.
 *
 * Alle Vorgänge hier gelten für die angemeldete Person selbst — deshalb
 * `echteSitzung` statt der Ansicht: Wer gerade in einen fremden
 * Arbeitsbereich schaut, ändert trotzdem sein eigenes Konto und nicht das
 * der Kundin.
 */

export type ProfilState = { ok?: string; error?: string }

const kontaktdaten = z.object({
  name: z.string().trim().max(80, 'Der Name ist zu lang.').optional(),
  email: z.string().email('Bitte eine gültige E-Mail-Adresse angeben.'),
})

export async function speichereKontaktdaten(
  _prev: ProfilState,
  formData: FormData,
): Promise<ProfilState> {
  const user = await echteSitzung()
  if (!user) return { error: 'Nicht angemeldet.' }

  const parsed = kontaktdaten.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Eine Adresse gehört immer nur einem Konto: Sie ist der Anmeldename.
  if (parsed.data.email !== user.email) {
    const belegt = await db.user.findUnique({ where: { email: parsed.data.email } })
    if (belegt) return { error: 'Diese E-Mail-Adresse wird bereits verwendet.' }
  }

  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name || null, email: parsed.data.email },
  })
  await db.auditLog.create({ data: { userId: user.id, action: 'profil.kontakt.geaendert' } })

  revalidatePath('/settings/profil')
  return { ok: 'Gespeichert.' }
}

const passwortwechsel = z
  .object({
    aktuell: z.string().min(1, 'Bitte das aktuelle Passwort eingeben.'),
    neu: z.string().min(10, 'Das neue Passwort braucht mindestens 10 Zeichen.'),
    wiederholung: z.string(),
  })
  .refine((d) => d.neu === d.wiederholung, {
    message: 'Die beiden neuen Passwörter stimmen nicht überein.',
    path: ['wiederholung'],
  })

/**
 * Passwort ändern.
 *
 * Das alte Passwort wird verlangt, obwohl die Person angemeldet ist: Ein
 * unbeaufsichtigter Rechner soll nicht reichen, um jemanden dauerhaft aus
 * seinem Konto auszusperren.
 */
export async function wechslePasswort(_prev: ProfilState, formData: FormData): Promise<ProfilState> {
  const user = await echteSitzung()
  if (!user) return { error: 'Nicht angemeldet.' }

  const parsed = passwortwechsel.safeParse({
    aktuell: String(formData.get('aktuell') ?? ''),
    neu: String(formData.get('neu') ?? ''),
    wiederholung: String(formData.get('wiederholung') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  if (!(await verifyPassword(parsed.data.aktuell, user.passwordHash))) {
    return { error: 'Das aktuelle Passwort stimmt nicht.' }
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.neu) },
  })
  await db.auditLog.create({ data: { userId: user.id, action: 'profil.passwort.geaendert' } })

  return { ok: 'Passwort geändert. Andere Geräte bleiben angemeldet — melde sie unten ab, wenn du sichergehen willst.' }
}

export async function speichereBild(_prev: ProfilState, formData: FormData): Promise<ProfilState> {
  const user = await echteSitzung()
  if (!user) return { error: 'Nicht angemeldet.' }

  const datei = formData.get('bild')
  if (!(datei instanceof File) || datei.size === 0) {
    return { error: 'Bitte eine Bilddatei auswählen.' }
  }

  const abgelegt = await legeBildAb(datei)
  if (!abgelegt.ok) return { error: abgelegt.grund }

  const vorher = user.avatarDatei
  await db.user.update({ where: { id: user.id }, data: { avatarDatei: abgelegt.datei } })
  // Erst nach dem erfolgreichen Wechsel: Sonst stünde bei einem Fehler ein
  // Verweis auf eine Datei, die es nicht mehr gibt.
  await entferneBild(vorher)

  revalidatePath('/settings/profil')
  return { ok: 'Profilbild aktualisiert.' }
}

export async function entferneProfilbild(): Promise<void> {
  const user = await echteSitzung()
  if (!user) return

  await db.user.update({ where: { id: user.id }, data: { avatarDatei: null } })
  await entferneBild(user.avatarDatei)
  revalidatePath('/settings/profil')
}

/**
 * Alle anderen Sitzungen beenden.
 *
 * Nützlich nach einem Passwortwechsel oder wenn ein Gerät verloren ging. Die
 * eigene Sitzung bleibt bestehen — sonst wäre man selbst ausgesperrt.
 */
export async function beendeAndereSitzungen(): Promise<void> {
  const session = await requireSession()
  const { cookies } = await import('next/headers')
  const { SESSION_COOKIE } = await import('@/lib/auth/session')
  const { hashToken } = await import('@/lib/crypto/vault')

  const store = await cookies()
  const eigener = store.get(SESSION_COOKIE)?.value

  await db.session.deleteMany({
    where: {
      userId: session.id,
      ...(eigener ? { NOT: { tokenHash: hashToken(eigener) } } : {}),
    },
  })
  await db.auditLog.create({ data: { userId: session.id, action: 'profil.sitzungen.beendet' } })
  revalidatePath('/settings/profil')
}

export async function meldeAb(): Promise<void> {
  await destroySession()
}
