import { db } from '@/lib/db'
import { zulaessigeRedirectUri } from '@/lib/mcp/oauth'
import { extAntwort, extPreflight } from '@/lib/extension/cors'

export const dynamic = 'force-dynamic'

/**
 * Dynamische Client-Registrierung (RFC 7591).
 *
 * MCP-Clients wie Claude registrieren sich vor dem ersten Anmelde-Fluss
 * selbst. Die Registrierung ist bewusst offen – sie gewährt keinerlei
 * Zugriff: Ohne die Anmeldung und Zustimmung einer echten Person entsteht
 * daraus nie ein Zugangsschlüssel. Gespeichert werden nur Name und
 * Rücksprungadressen, und Letztere müssen https sein (localhost für lokale
 * Clients ausgenommen).
 */
export async function POST(request: Request) {
  let daten: { client_name?: unknown; redirect_uris?: unknown }
  try {
    daten = (await request.json()) as typeof daten
  } catch {
    return extAntwort({ error: 'invalid_client_metadata', error_description: 'Kein gültiges JSON.' }, 400)
  }

  const name = String(daten.client_name ?? 'MCP-Client').slice(0, 80)
  const redirectUris = Array.isArray(daten.redirect_uris)
    ? daten.redirect_uris.map(String).slice(0, 10)
    : []

  if (redirectUris.length === 0 || !redirectUris.every(zulaessigeRedirectUri)) {
    return extAntwort(
      {
        error: 'invalid_redirect_uri',
        error_description: 'redirect_uris fehlt oder enthält eine unzulässige Adresse (erlaubt: https, localhost).',
      },
      400,
    )
  }

  const client = await db.oAuthClient.create({ data: { name, redirectUris } })

  return extAntwort(
    {
      client_id: client.id,
      client_name: name,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    },
    201,
  )
}

export function OPTIONS() {
  return extPreflight()
}
