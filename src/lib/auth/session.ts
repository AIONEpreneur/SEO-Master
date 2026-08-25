import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { db } from '@/lib/db'
import { hashToken, randomToken } from '@/lib/crypto/vault'
import type { Plan, Role } from '@prisma/client'

export const SESSION_COOKIE = 'seomaster_session'
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

  const membership = session.user.memberships[0]
  if (!membership) return null

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isSuperAdmin: session.user.isSuperAdmin,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    credits: membership.organization.credits,
    plan: membership.organization.plan,
    role: membership.role,
  }
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
  if (!hasRole(session, minimum)) throw new Error('FORBIDDEN')
  return session
}
