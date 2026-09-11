'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { hashToken, randomToken } from '@/lib/crypto/vault'
import { hashPassword } from './password'
import { sendeMail, versandBereit } from '@/lib/mail'

/**
 * Passwort vergessen — Anforderung und Neusetzen.
 *
 * Die wichtigste Regel steht gleich am Anfang: Die Antwort auf eine
 * Anforderung ist immer dieselbe, ob es das Konto gibt oder nicht. Sonst
 * liesse sich über dieses Formular herausfinden, wer hier ein Konto hat —
 * bei einer Anwendung mit Geschäftsdaten ist das keine Kleinigkeit.
 */

/** Wie lange ein Link gilt. Kurz genug, um Missbrauch zu begrenzen. */
const GUELTIG_MINUTEN = 60

export type HilfeState = { fertig?: boolean; error?: string }

const adresse = z.object({
  email: z.string().email('Bitte eine gültige E-Mail-Adresse angeben.'),
})

export async function fordereHilfeAn(_prev: HilfeState, formData: FormData): Promise<HilfeState> {
  const parsed = adresse.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } })

  // Gesperrte Konten bekommen ebenso wenig einen Link wie unbekannte
  // Adressen – und in beiden Fällen sieht die Antwort gleich aus.
  if (user && !user.suspendedAt) {
    // Ältere Anforderungen entwerten: Es soll immer nur ein gültiger Link
    // unterwegs sein.
    await db.passwortHilfe.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    const code = randomToken(32)
    await db.passwortHilfe.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(code),
        expiresAt: new Date(Date.now() + GUELTIG_MINUTEN * 60 * 1000),
      },
    })

    const ziel = `${await basisUrl()}/passwort-neu/${code}`
    const ergebnis = await sendeMail({
      an: user.email,
      betreff: 'Passwort für SEO-Master zurücksetzen',
      text:
        `Hallo${user.name ? ` ${user.name}` : ''},\n\n` +
        'für dein Konto bei SEO-Master wurde ein neues Passwort angefordert. ' +
        `Über diesen Link kannst du eines setzen — er gilt ${GUELTIG_MINUTEN} Minuten und genau einmal:\n\n` +
        `${ziel}\n\n` +
        'Warst du das nicht, kannst du diese Nachricht ignorieren. Dein bisheriges Passwort bleibt dann gültig.\n\n' +
        'SEO-Master',
    })

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.passwort.angefordert',
        metadata: { versandt: ergebnis.ok, grund: ergebnis.ok ? null : ergebnis.grund },
      },
    })
  }

  return { fertig: true }
}

const neuesPasswort = z
  .object({
    code: z.string().min(10),
    password: z.string().min(10, 'Das Passwort braucht mindestens 10 Zeichen.'),
    wiederholung: z.string(),
  })
  .refine((d) => d.password === d.wiederholung, {
    message: 'Die beiden Passwörter stimmen nicht überein.',
    path: ['wiederholung'],
  })

export type NeuState = { ok?: boolean; error?: string }

export async function setzeNeuesPasswort(_prev: NeuState, formData: FormData): Promise<NeuState> {
  const parsed = neuesPasswort.safeParse({
    code: String(formData.get('code') ?? ''),
    password: String(formData.get('password') ?? ''),
    wiederholung: String(formData.get('wiederholung') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const eintrag = await db.passwortHilfe.findUnique({
    where: { tokenHash: hashToken(parsed.data.code) },
    include: { user: true },
  })

  const abgelaufen = !eintrag || eintrag.usedAt !== null || eintrag.expiresAt < new Date()
  if (abgelaufen) {
    return {
      error: 'Dieser Link ist nicht mehr gültig. Bitte fordere einen neuen an.',
    }
  }

  await db.$transaction([
    db.passwortHilfe.update({ where: { id: eintrag.id }, data: { usedAt: new Date() } }),
    db.user.update({
      where: { id: eintrag.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    // Alle bestehenden Sitzungen beenden: Wer das Passwort zurücksetzt, tut
    // das oft gerade deshalb, weil jemand anderes Zugriff hatte.
    db.session.deleteMany({ where: { userId: eintrag.userId } }),
    db.auditLog.create({
      data: { userId: eintrag.userId, action: 'auth.passwort.neu' },
    }),
  ])

  return { ok: true }
}

/** Gilt der Link noch? Für die Seite, bevor sie ein Formular zeigt. */
export async function hilfeGueltig(code: string): Promise<boolean> {
  if (!code) return false
  const eintrag = await db.passwortHilfe.findUnique({ where: { tokenHash: hashToken(code) } })
  return Boolean(eintrag && eintrag.usedAt === null && eintrag.expiresAt > new Date())
}

/** Kann die Anwendung überhaupt Mails verschicken? */
export async function kannMailVersenden(): Promise<boolean> {
  return versandBereit()
}

/**
 * Die Adresse, unter der die Anwendung erreichbar ist.
 *
 * APP_URL hat einen Vorgabewert auf localhost. Bliebe es dabei, stünde in
 * jeder Mail ein Link, der nur auf dem Server selbst funktioniert.
 */
async function basisUrl(): Promise<string> {
  const konfiguriert = env().APP_URL
  if (konfiguriert && !/^https?:\/\/localhost(:|$)/.test(konfiguriert)) {
    return konfiguriert.replace(/\/+$/, '')
  }
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
  if (!host) return konfiguriert.replace(/\/+$/, '')
  const protokoll = hdrs.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protokoll}://${host}`
}
