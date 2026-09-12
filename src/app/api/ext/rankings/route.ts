import { resolveApiToken, tokenFehler } from '@/lib/auth/api-token'
import { fuehreRankingAbfrage } from '@/lib/extension/abfragen'
import { extAntwort, extPreflight } from '@/lib/extension/cors'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export function OPTIONS() {
  return extPreflight()
}

/**
 * Ranking-Abfrage der Browser-Extension (SEO4U).
 *
 * Nimmt eine Domain oder die vollständige Adresse einer Unterseite entgegen –
 * die Logik liegt in `@/lib/extension/abfragen`, gemeinsam mit der
 * MCP-Anbindung. Jede Abfrage wird gespeichert und erscheint in der App
 * unter Ranking-Abfragen.
 */
export async function POST(request: Request) {
  const zugang = await resolveApiToken(request)
  if (!zugang.ok) return tokenFehler(zugang)
  const kontext = zugang.kontext

  let target: string
  try {
    const body = (await request.json()) as { target?: string }
    target = String(body.target ?? '')
  } catch {
    return extAntwort({ ok: false, error: 'bad_request', message: 'Ungültige Anfrage.' }, 400)
  }

  const ergebnis = await fuehreRankingAbfrage({
    organization: kontext.organization,
    userId: kontext.userId,
    target,
    operation: 'extension-rankings',
  })

  if (!ergebnis.ok) {
    const { status, ...payload } = ergebnis
    return extAntwort(payload, status)
  }
  return extAntwort(ergebnis)
}
