'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { erstelleEinladung, einladungsLink } from '@/lib/auth/einladungen'
import { env } from '@/lib/env'

export type EinladungsState = { error?: string; link?: string; email?: string }

const entwurf = z.object({
  email: z.string().email('Bitte eine gültige E-Mail-Adresse angeben.'),
  art: z.enum(['team', 'kundin']),
  arbeitsbereich: z.string().trim().optional(),
})

/**
 * Die Adresse, unter der die Anwendung erreichbar ist.
 *
 * APP_URL hat einen Vorgabewert auf localhost. Bliebe es dabei, stünde in
 * jeder Einladung ein Link, der nur auf dem Server selbst funktioniert –
 * deshalb entscheidet hier der tatsächliche Aufruf, sobald der Vorgabewert
 * nicht überschrieben wurde.
 */
async function basisUrl(): Promise<string> {
  const konfiguriert = env().APP_URL
  if (konfiguriert && !/^https?:\/\/localhost(:|$)/.test(konfiguriert)) return konfiguriert

  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
  if (!host) return konfiguriert
  const protokoll = hdrs.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protokoll}://${host}`
}

export async function ladeEinAction(_prev: EinladungsState, formData: FormData): Promise<EinladungsState> {
  const session = await requireRole('ADMIN')

  const parsed = entwurf.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    art: String(formData.get('art') ?? 'kundin'),
    arbeitsbereich: String(formData.get('arbeitsbereich') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { email, art, arbeitsbereich } = parsed.data

  if (await db.user.findUnique({ where: { email } })) {
    return { error: 'Für diese Adresse besteht bereits ein Konto.' }
  }

  // Offene Einladungen an dieselbe Adresse zurückziehen, damit immer nur ein
  // gültiger Link im Umlauf ist.
  await db.invitation.updateMany({
    where: { email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  const { einladung, code } = await erstelleEinladung(
    art === 'team'
      ? { email, role: 'MEMBER', organizationId: session.organizationId, invitedById: session.id }
      : {
          email,
          role: 'OWNER',
          organizationId: null,
          newOrganizationName: arbeitsbereich || null,
          plan: 'FREE',
          credits: 100,
          invitedById: session.id,
        },
  )

  await db.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.id,
      action: 'team.invitation.created',
      target: einladung.id,
      metadata: { art },
    },
  })

  revalidatePath('/settings/team')
  return { link: einladungsLink(await basisUrl(), code), email }
}

export async function ziehZurueckAction(formData: FormData): Promise<void> {
  const session = await requireRole('ADMIN')
  const id = String(formData.get('id') ?? '')

  // Nur eigene Einladungen: entweder ins eigene Team oder von hier ausgestellt.
  const betroffen = await db.invitation.updateMany({
    where: {
      id,
      acceptedAt: null,
      revokedAt: null,
      OR: [{ organizationId: session.organizationId }, { invitedById: session.id }],
    },
    data: { revokedAt: new Date() },
  })

  if (betroffen.count > 0) {
    await db.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.id,
        action: 'team.invitation.revoked',
        target: id,
      },
    })
  }
  revalidatePath('/settings/team')
}
