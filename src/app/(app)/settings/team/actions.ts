'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { passtNochJemand, platzVollHinweis } from '@/lib/billing/plaetze'
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
    art: String(formData.get('art') ?? 'team'),
    arbeitsbereich: String(formData.get('arbeitsbereich') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { email, art, arbeitsbereich } = parsed.data

  /*
    Einen ganz neuen Arbeitsbereich anlegen darf nur der Betrieb.

    Bis hierher stand diese Möglichkeit jeder Person mit Verwaltungsrecht
    offen — und Inhaberin ihres eigenen Bereichs ist jede Kundin. Sie hätte
    sich damit über ein paar Wegwerf-Adressen beliebig viele frische
    Arbeitsbereiche mit je einem Startguthaben erzeugen können. Das ist das
    Gegenteil einer Deckelung: Es vervielfältigt Guthaben, statt es zu
    teilen. Die Prüfung auf die Rolle reichte dafür nicht, es braucht die
    Betriebsverwaltung.
  */
  if (art === 'kundin' && !session.isSuperAdmin) {
    return { error: 'Neue Arbeitsbereiche legt nur der Betrieb an.' }
  }

  if (await db.user.findUnique({ where: { email } })) {
    return { error: 'Für diese Adresse besteht bereits ein Konto.' }
  }

  /*
    Passt noch jemand in diesen Arbeitsbereich?

    Gezählt werden Mitglieder und offene Einladungen zusammen. Wer drei
    Links verschickt und wartet, hätte die Grenze sonst umgangen — und die
    dritte Person stünde nach dem Klick vor einer Absage, für die sie
    nichts kann.

    Nur beim Einladen ins eigene Team: Eine Kundin bekommt einen eigenen
    Bereich, sie belegt hier keinen Platz.
  */
  if (art === 'team') {
    const organisation = await db.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
      select: { plan: true },
    })
    const [mitglieder, offene] = await Promise.all([
      db.membership.count({ where: { organizationId: session.organizationId } }),
      db.invitation.count({
        where: {
          organizationId: session.organizationId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ])
    if (!passtNochJemand({ plan: organisation.plan, belegt: mitglieder + offene })) {
      return { error: platzVollHinweis(organisation.plan) }
    }
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
