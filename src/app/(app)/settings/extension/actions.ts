'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { hashToken, randomToken } from '@/lib/crypto/vault'

export type TokenState = { error?: string; token?: string; name?: string }

/**
 * Zugangsschlüssel für die Browser-Extension (SEO4U).
 *
 * Wie bei den Einladungen wird nur der Hash gespeichert; der Klartext ist
 * einmal nach dem Erzeugen sichtbar. Pro Person und Arbeitsbereich sind
 * mehrere Schlüssel erlaubt (z. B. zwei Rechner) – ein neuer macht die alten
 * deshalb nicht ungültig.
 */
export async function erzeugeTokenAction(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const session = await requireRole('MEMBER')

  const name = String(formData.get('name') ?? '').trim().slice(0, 60) || 'Chrome-Extension'
  const token = `seo4u_${randomToken(32)}`

  await db.apiToken.create({
    data: {
      userId: session.id,
      organizationId: session.organizationId,
      tokenHash: hashToken(token),
      name,
    },
  })

  await db.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.id,
      action: 'extension.token.created',
      target: name,
    },
  })

  revalidatePath('/settings/extension')
  return { token, name }
}

export async function widerrufeTokenAction(formData: FormData): Promise<void> {
  const session = await requireRole('MEMBER')
  const id = String(formData.get('id') ?? '')

  // Nur eigene Schlüssel im eigenen Arbeitsbereich – eine geratene ID darf
  // niemandem den Zugang abdrehen.
  const betroffen = await db.apiToken.updateMany({
    where: { id, userId: session.id, organizationId: session.organizationId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  if (betroffen.count > 0) {
    await db.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.id,
        action: 'extension.token.revoked',
        target: id,
      },
    })
  }
  revalidatePath('/settings/extension')
}
