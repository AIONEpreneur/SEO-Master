import { db } from '@/lib/db'
import { hashToken, randomToken } from '@/lib/crypto/vault'
import type { Plan, Role } from '@prisma/client'

/**
 * Einladungen.
 *
 * Der Code in der Einladungs-URL ist ein Schlüssel: Wer ihn hat, kann das Konto
 * anlegen. Gespeichert wird deshalb nur sein Hash – dasselbe Verfahren wie bei
 * den Sitzungen. Aus der Datenbank lässt sich der Link also nicht
 * zurückgewinnen; verloren gegangene Einladungen werden neu ausgestellt, was
 * die alte ungültig macht.
 */

/** Wie lange eine Einladung gilt. */
export const GUELTIG_TAGE = 14

export type EinladungsEntwurf = {
  email: string
  role?: Role
  /** Gesetzt: Aufnahme ins bestehende Team. Leer: eigener Arbeitsbereich. */
  organizationId?: string | null
  /** Nur im Kundenfall: Name des anzulegenden Arbeitsbereichs. */
  newOrganizationName?: string | null
  plan?: Plan
  credits?: number
  invitedById?: string | null
}

/** Legt eine Einladung an und gibt den Klartext-Code zurück – einmalig. */
export async function erstelleEinladung(entwurf: EinladungsEntwurf) {
  const code = randomToken(24)
  const einladung = await db.invitation.create({
    data: {
      email: entwurf.email.toLowerCase().trim(),
      codeHash: hashToken(code),
      role: entwurf.role ?? 'MEMBER',
      organizationId: entwurf.organizationId ?? null,
      newOrganizationName: entwurf.newOrganizationName?.trim() || null,
      plan: entwurf.plan ?? 'FREE',
      credits: entwurf.credits ?? 0,
      invitedById: entwurf.invitedById ?? null,
      expiresAt: new Date(Date.now() + GUELTIG_TAGE * 24 * 60 * 60 * 1000),
    },
  })
  return { einladung, code }
}

export type Einladungsfehler = 'unbekannt' | 'abgelaufen' | 'zurueckgezogen' | 'eingeloest'

/**
 * Sucht die Einladung zu einem Code und prüft ihre Gültigkeit.
 *
 * Gibt einen Grund zurück statt nur null, damit die Seite sagen kann, was los
 * ist – "abgelaufen" ist eine andere Nachricht als "gibt es nicht".
 */
export async function pruefeEinladung(code: string) {
  const sauber = code.trim()
  if (!sauber) return { fehler: 'unbekannt' as Einladungsfehler, einladung: null }

  const einladung = await db.invitation.findUnique({
    where: { codeHash: hashToken(sauber) },
    include: { organization: { select: { name: true } } },
  })

  if (!einladung) return { fehler: 'unbekannt' as Einladungsfehler, einladung: null }
  if (einladung.revokedAt) return { fehler: 'zurueckgezogen' as Einladungsfehler, einladung: null }
  if (einladung.acceptedAt) return { fehler: 'eingeloest' as Einladungsfehler, einladung: null }
  if (einladung.expiresAt < new Date()) return { fehler: 'abgelaufen' as Einladungsfehler, einladung: null }

  return { fehler: null, einladung }
}

export const FEHLERTEXTE: Record<Einladungsfehler, string> = {
  unbekannt: 'Diese Einladung gibt es nicht. Bitte den Link vollständig kopieren oder eine neue anfordern.',
  abgelaufen: `Diese Einladung ist abgelaufen – sie gilt ${GUELTIG_TAGE} Tage. Bitte eine neue anfordern.`,
  zurueckgezogen: 'Diese Einladung wurde zurückgezogen.',
  eingeloest: 'Diese Einladung wurde bereits genutzt. Melden Sie sich einfach an.',
}

/** Der Link, den die eingeladene Person bekommt. */
export function einladungsLink(basisUrl: string, code: string): string {
  return `${basisUrl.replace(/\/+$/, '')}/einladung/${code}`
}
