import { db } from '@/lib/db'
import { hashToken, randomToken } from '@/lib/crypto/vault'
import { pkceStimmt } from '@/lib/mcp/oauth'
import { extAntwort, extPreflight } from '@/lib/extension/cors'

export const dynamic = 'force-dynamic'

/**
 * Token-Endpunkt: Einmal-Code gegen Zugangsschlüssel tauschen.
 *
 * Der Code stammt von der Zustimmungsseite und lebt zehn Minuten. Eingelöst
 * wird er genau einmal, nur vom registrierten Client, nur mit derselben
 * Rücksprungadresse und nur mit gültigem PKCE-Nachweis. Heraus kommt ein
 * persönlicher Zugangsschlüssel (api_tokens) – derselbe Mechanismus wie bei
 * der Extension, sichtbar und widerrufbar unter Einstellungen → Extension.
 */
export async function POST(request: Request) {
  const felder = await leseFelder(request)
  if (!felder) {
    return extAntwort({ error: 'invalid_request', error_description: 'Anfrage nicht lesbar.' }, 400)
  }

  if (felder.grant_type !== 'authorization_code') {
    return extAntwort(
      { error: 'unsupported_grant_type', error_description: 'Nur authorization_code wird unterstützt.' },
      400,
    )
  }

  const code = String(felder.code ?? '')
  const eintrag = code
    ? await db.oAuthCode.findUnique({ where: { codeHash: hashToken(code) }, include: { client: true } })
    : null

  if (!eintrag) {
    return extAntwort({ error: 'invalid_grant', error_description: 'Der Code ist unbekannt oder wurde bereits eingelöst.' }, 400)
  }

  // Einmalig: sofort löschen, bevor irgendetwas geprüft wird. Schlägt eine
  // Prüfung fehl, ist der Code trotzdem verbraucht – ein abgefangener Code
  // lässt sich so nicht in Ruhe durchprobieren.
  await db.oAuthCode.delete({ where: { id: eintrag.id } })

  if (eintrag.expiresAt < new Date()) {
    return extAntwort({ error: 'invalid_grant', error_description: 'Der Code ist abgelaufen. Bitte die Verbindung erneut starten.' }, 400)
  }
  if (felder.client_id && felder.client_id !== eintrag.clientId) {
    return extAntwort({ error: 'invalid_grant', error_description: 'Der Code gehört zu einem anderen Client.' }, 400)
  }
  if (felder.redirect_uri && felder.redirect_uri !== eintrag.redirectUri) {
    return extAntwort({ error: 'invalid_grant', error_description: 'Die Rücksprungadresse stimmt nicht mit der Anfrage überein.' }, 400)
  }
  if (!pkceStimmt(String(felder.code_verifier ?? ''), eintrag.codeChallenge)) {
    return extAntwort({ error: 'invalid_grant', error_description: 'Der PKCE-Nachweis fehlt oder stimmt nicht.' }, 400)
  }

  const token = `seo4u_${randomToken(32)}`
  await db.apiToken.create({
    data: {
      userId: eintrag.userId,
      organizationId: eintrag.organizationId,
      tokenHash: hashToken(token),
      name: `${eintrag.client.name} (MCP)`.slice(0, 60),
    },
  })

  await db.auditLog.create({
    data: {
      organizationId: eintrag.organizationId,
      userId: eintrag.userId,
      action: 'extension.token.created',
      target: `${eintrag.client.name} (MCP)`,
    },
  })

  // Ohne expires_in: Der Schlüssel gilt, bis er widerrufen wird – genau wie
  // die Schlüssel der Extension, und am selben Ort sichtbar.
  return extAntwort({ access_token: token, token_type: 'Bearer', scope: 'seo-master' })
}

export function OPTIONS() {
  return extPreflight()
}

/** Formulardaten oder JSON – Clients schicken beides. */
async function leseFelder(request: Request): Promise<Record<string, string> | null> {
  const art = request.headers.get('content-type') ?? ''
  try {
    if (art.includes('application/json')) {
      const daten = (await request.json()) as Record<string, unknown>
      return Object.fromEntries(Object.entries(daten).map(([k, v]) => [k, String(v ?? '')]))
    }
    const daten = await request.formData()
    return Object.fromEntries([...daten.entries()].map(([k, v]) => [k, String(v)]))
  } catch {
    return null
  }
}
