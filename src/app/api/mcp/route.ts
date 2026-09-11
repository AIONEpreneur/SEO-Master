import { resolveApiToken } from '@/lib/auth/api-token'
import { beantworteMcp } from '@/lib/mcp/server'
import { basisUrl } from '@/lib/mcp/oauth'
import { extPreflight } from '@/lib/extension/cors'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * MCP-Endpunkt mit Anmeldung (der Standardweg).
 *
 * Verbunden wird schlicht mit `https://…/api/mcp` – ohne irgendein Geheimnis
 * in der Adresse. Beim ersten Kontakt antwortet der Endpunkt mit 401 und
 * verweist über WWW-Authenticate auf die Discovery-Adressen; daraufhin
 * startet der MCP-Client von selbst den Anmelde-Fluss: Registrierung,
 * Anmeldung in SEO-Master, Zustimmung, Token-Tausch. Der dabei ausgestellte
 * Zugangsschlüssel kommt danach als Authorization-Header mit.
 *
 * Der Schwesterpfad /api/mcp/<schlüssel> bleibt für Clients ohne
 * OAuth-Unterstützung bestehen – auch dort ist der Schlüssel die Anmeldung.
 */
export async function POST(request: Request) {
  const kontext = await resolveApiToken(request)
  if (!kontext) return nichtAngemeldet(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Der Anfragetext ist kein gültiges JSON.' } },
      { status: 400 },
    )
  }

  if (Array.isArray(body)) {
    const antworten = (await Promise.all(body.map((a) => beantworteMcp(kontext, a ?? {})))).filter(
      (a): a is Record<string, unknown> => a !== null,
    )
    if (antworten.length === 0) return new Response(null, { status: 202 })
    return Response.json(antworten)
  }

  const antwort = await beantworteMcp(kontext, (body ?? {}) as Record<string, unknown>)
  if (antwort === null) return new Response(null, { status: 202 })
  return Response.json(antwort)
}

export function GET(request: Request) {
  // Kein Ereignisstrom – aber unangemeldete Anfragen bekommen auch hier den
  // Wegweiser zum Anmelde-Fluss statt eines blossen 405.
  return nichtAngemeldetOder405(request)
}

async function nichtAngemeldetOder405(request: Request): Promise<Response> {
  const kontext = await resolveApiToken(request)
  if (!kontext) return nichtAngemeldet(request)
  return new Response(null, { status: 405, headers: { allow: 'POST' } })
}

export function OPTIONS() {
  return extPreflight()
}

/** 401 mit Wegweiser: Hier entlang zur Anmeldung (RFC 9728). */
function nichtAngemeldet(request: Request): Response {
  const basis = basisUrl(request)
  return Response.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32001, message: 'Nicht angemeldet. Der Client startet über die WWW-Authenticate-Angabe den Anmelde-Fluss.' },
    },
    {
      status: 401,
      headers: {
        'www-authenticate': `Bearer resource_metadata="${basis}/.well-known/oauth-protected-resource/api/mcp", error="invalid_token"`,
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'www-authenticate',
      },
    },
  )
}
