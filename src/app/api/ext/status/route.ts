import { resolveApiToken, tokenFehler } from '@/lib/auth/api-token'
import { verbleibendeAbfragen } from '@/lib/extension/abrechnung'
import { extAntwort, extPreflight } from '@/lib/extension/cors'

export const dynamic = 'force-dynamic'

export function OPTIONS() {
  return extPreflight()
}

/**
 * Zugangstest der Browser-Extension (SEO4U).
 *
 * Beantwortet nur: Gilt der Schlüssel, wer steckt dahinter, und wie viele
 * Abfragen sind noch frei. Kostet nichts und verändert nichts – der Knopf
 * "Zugang testen" in der Extension darf beliebig oft gedrückt werden.
 */
export async function GET(request: Request) {
  const kontext = await resolveApiToken(request)
  if (!kontext) return tokenFehler()

  return extAntwort({
    ok: true,
    benutzer: kontext.userName,
    bereich: kontext.organization.name,
    abfragenFrei: verbleibendeAbfragen(kontext.organization),
  })
}
