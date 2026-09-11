'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth/session'
import { hashToken, randomToken } from '@/lib/crypto/vault'
import { CODE_LEBENSDAUER_MS } from '@/lib/mcp/oauth'

/**
 * Zustimmung erteilen: Einmal-Code ausstellen und zum Client zurückspringen.
 *
 * Läuft nur mit angemeldeter Sitzung; alle Angaben werden gegen die
 * Registrierung des Clients geprüft, nicht gegen das Formular allein – ein
 * manipuliertes verstecktes Feld darf nichts ändern.
 */
export async function erteileZugriffAction(formData: FormData): Promise<void> {
  const session = await requireSession()

  const clientId = String(formData.get('client_id') ?? '')
  const redirectUri = String(formData.get('redirect_uri') ?? '')
  const codeChallenge = String(formData.get('code_challenge') ?? '')
  const state = String(formData.get('state') ?? '')

  const client = await db.oAuthClient.findUnique({ where: { id: clientId } })
  if (!client || !client.redirectUris.includes(redirectUri) || !codeChallenge) {
    redirect('/dashboard')
  }

  const code = randomToken(24)
  await db.oAuthCode.create({
    data: {
      codeHash: hashToken(code),
      clientId: client.id,
      userId: session.id,
      organizationId: session.organizationId,
      redirectUri,
      codeChallenge,
      expiresAt: new Date(Date.now() + CODE_LEBENSDAUER_MS),
    },
  })

  await db.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.id,
      action: 'oauth.consent.granted',
      target: client.name,
    },
  })

  const ziel = new URL(redirectUri)
  ziel.searchParams.set('code', code)
  if (state) ziel.searchParams.set('state', state)
  redirect(ziel.toString())
}

/** Ablehnen: dem Client Bescheid geben, ohne irgendetwas auszustellen. */
export async function lehneAbAction(formData: FormData): Promise<void> {
  await requireSession()

  const clientId = String(formData.get('client_id') ?? '')
  const redirectUri = String(formData.get('redirect_uri') ?? '')
  const state = String(formData.get('state') ?? '')

  const client = await db.oAuthClient.findUnique({ where: { id: clientId } })
  if (!client || !client.redirectUris.includes(redirectUri)) redirect('/dashboard')

  const ziel = new URL(redirectUri)
  ziel.searchParams.set('error', 'access_denied')
  if (state) ziel.searchParams.set('state', state)
  redirect(ziel.toString())
}
