import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { db } from '@/lib/db'
import { hashToken, randomToken } from '@/lib/crypto/vault'
import type { Plan, Role } from '@prisma/client'

export const SESSION_COOKIE = 'seomaster_session'
/**
 * Welchen Arbeitsbereich die Sitzung gerade zeigt.
 *
 * Der Wert ist absichtlich ungeschützt: Er ist kein Ausweis, sondern eine
 * Bitte. Ob sie erfüllt wird, entscheidet allein die echte Sitzung – wer keine
 * Mitgliedschaft und keine Betriebsverwaltung hat, kommt mit einem
 * selbstgesetzten Wert nirgendwohin.
 */
export const BEREICH_COOKIE = 'seomaster_bereich'
const SESSION_DAYS = 30

export async function createSession(userId: string) {
  const token = randomToken(32)
  const hdrs = await headers()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: hdrs.get('user-agent')?.slice(0, 255) ?? null,
      ipAddress: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      expiresAt,
    },
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })

  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
  return token
}

export async function destroySession() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  store.delete(SESSION_COOKIE)
}

export type SessionUser = {
  id: string
  email: string
  name: string | null
  isSuperAdmin: boolean
  organizationId: string
  organizationName: string
  organizationSlug: string
  credits: number
  plan: Plan
  role: Role
  /**
   * Fremdansicht: Der Bereich gehört nicht zu den eigenen Mitgliedschaften,
   * sondern wird kraft Betriebsverwaltung eingesehen. Schreibende Vorgänge
   * sind dann gesperrt – ansehen, wie eine Kundin die App erlebt, darf nicht
   * dazu führen, dass in ihren Daten etwas passiert.
   */
  nurAnsicht: boolean
  /** Gesetzt, sobald nicht der eigene Hauptbereich gezeigt wird. */
  wechsel: null | { name: string; nurAnsicht: boolean }
}

/**
 * Aktuelle Sitzung auflösen. Pro Request memoisiert, damit mehrere Aufrufe
 * innerhalb eines Renders nur eine Datenbankabfrage auslösen.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: { include: { organization: true }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })

  if (!session || session.expiresAt < new Date()) return null

  // Eine Sperre wirkt sofort, auch auf bestehende Sitzungen. Sonst könnte
  // eine gesperrte Person bis zum Ablauf des Cookies weiterarbeiten.
  if (session.user.suspendedAt) return null

  const eigener = session.user.memberships[0]
  if (!eigener) return null

  const gewuenscht = store.get(BEREICH_COOKIE)?.value
  const grunddaten = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  }

  // Kein Wunsch oder der eigene Hauptbereich: der Normalfall.
  if (!gewuenscht || gewuenscht === eigener.organizationId) {
    return {
      ...grunddaten,
      isSuperAdmin: session.user.isSuperAdmin,
      organizationId: eigener.organizationId,
      organizationName: eigener.organization.name,
      organizationSlug: eigener.organization.slug,
      credits: eigener.organization.credits,
      plan: eigener.organization.plan,
      role: eigener.role,
      nurAnsicht: false,
      wechsel: null,
    }
  }

  // Ein weiterer eigener Bereich – etwa der Vorschau-Bereich. Das ist kein
  // Hineinsehen in fremde Daten, sondern ein Wechsel zwischen eigenen
  // Mitgliedschaften: volle Rechte, weil es die eigenen Daten sind.
  const weitere = session.user.memberships.find((m) => m.organizationId === gewuenscht)
  if (weitere) {
    return {
      ...grunddaten,
      // Auch im eigenen Vorschau-Bereich soll die Kundensicht gelten. Sonst
      // zeigte die Vorschau Datentresor und Verbrauch und waere wertlos.
      isSuperAdmin: false,
      organizationId: weitere.organizationId,
      organizationName: weitere.organization.name,
      organizationSlug: weitere.organization.slug,
      credits: weitere.organization.credits,
      plan: weitere.organization.plan,
      role: weitere.role,
      nurAnsicht: false,
      wechsel: { name: weitere.organization.name, nurAnsicht: false },
    }
  }

  // Fremder Bereich: nur mit Betriebsverwaltung und nur lesend.
  if (!session.user.isSuperAdmin) return null

  const fremd = await db.organization.findUnique({ where: { id: gewuenscht } })
  if (!fremd) return null

  return {
    ...grunddaten,
    isSuperAdmin: false,
    organizationId: fremd.id,
    organizationName: fremd.name,
    organizationSlug: fremd.slug,
    credits: fremd.credits,
    plan: fremd.plan,
    // Niedrigste Stufe: Die Ansicht soll nichts können, was die Kundin nicht
    // sieht, und erst recht nichts veraendern.
    role: 'VIEWER',
    nurAnsicht: true,
    wechsel: { name: fremd.name, nurAnsicht: true },
  }
})

/**
 * Die echte Sitzung – ohne den gewünschten Bereich.
 *
 * Gebraucht von allem, was den Wechsel selbst steuert: Wer beenden oder
 * weiterwechseln will, muss wissen, wer tatsächlich angemeldet ist, nicht wen
 * die Ansicht gerade zeigt.
 */
export const echteSitzung = cache(async () => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { memberships: { orderBy: { createdAt: 'asc' } } } } },
  })
  if (!session || session.expiresAt < new Date() || session.user.suspendedAt) return null
  return session.user
})

/**
 * Angemeldete Sitzung verlangen.
 *
 * Führt zur Anmeldung statt einen Fehler zu werfen: Eine abgelaufene Sitzung
 * ist ein Normalfall, keine Störung – eine Fehlerseite wäre hier die falsche
 * Antwort, und im Protokoll entstünde bei jedem Aufruf Rauschen.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

const RANK: Record<Role, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 }

export function hasRole(session: SessionUser, minimum: Role): boolean {
  return RANK[session.role] >= RANK[minimum]
}

export async function requireRole(minimum: Role): Promise<SessionUser> {
  const session = await requireSession()
  // Der einzige Engpass, durch den alle veraendernden Vorgaenge laufen. Die
  // Sperre gehoert deshalb hierhin und nicht in jede einzelne Aktion: In einer
  // Fremdansicht darf nichts entstehen, nichts verschwinden und nichts vom
  // Guthaben abgehen.
  if (session.nurAnsicht) throw new Error('NUR_ANSICHT')
  if (!hasRole(session, minimum)) throw new Error('FORBIDDEN')
  return session
}
