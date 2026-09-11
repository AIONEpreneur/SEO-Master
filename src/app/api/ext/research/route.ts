import { resolveApiToken, tokenFehler } from '@/lib/auth/api-token'
import { fuehreRecherche } from '@/lib/extension/abfragen'
import { extAntwort, extPreflight } from '@/lib/extension/cors'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export function OPTIONS() {
  return extPreflight()
}

/**
 * Keyword-Recherche der Browser-Extension (SEO4U).
 *
 * Derselbe Lauf wie in der App – die Logik liegt in
 * `@/lib/extension/abfragen`, gemeinsam mit der MCP-Anbindung. Der volle
 * Lauf wird gespeichert und taucht in der App unter Keyword-Recherche auf.
 */
export async function POST(request: Request) {
  const kontext = await resolveApiToken(request)
  if (!kontext) return tokenFehler()

  let seed: string
  try {
    const body = (await request.json()) as { seed?: string }
    seed = String(body.seed ?? '')
  } catch {
    return extAntwort({ ok: false, error: 'bad_request', message: 'Ungültige Anfrage.' }, 400)
  }

  const ergebnis = await fuehreRecherche({
    organization: kontext.organization,
    userId: kontext.userId,
    seed,
    operation: 'extension-research',
  })

  if (!ergebnis.ok) {
    const { status, ...payload } = ergebnis
    return extAntwort(payload, status)
  }
  return extAntwort(ergebnis)
}
