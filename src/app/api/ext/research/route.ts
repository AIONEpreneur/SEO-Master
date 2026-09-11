import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { resolveApiToken, tokenFehler } from '@/lib/auth/api-token'
import { resolveSecret, type DataForSeoSecret } from '@/lib/connectors/credentials'
import { DataForSeoClient, type KeywordEintrag } from '@/lib/connectors/dataforseo'
import { ConnectorError } from '@/lib/connectors/http'
import { fuehreZusammen, fasseZusammen, ABSICHT_LABEL } from '@/lib/keywords/research'
import { guthabenReicht, guthabenAntwort, verbucheAbfrage, verbleibendeAbfragen } from '@/lib/extension/abrechnung'
import { extAntwort, extPreflight } from '@/lib/extension/cors'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export function OPTIONS() {
  return extPreflight()
}

/** So viele Zeilen passen sinnvoll in das Extension-Popup. */
const POPUP_ZEILEN = 40

/**
 * Keyword-Recherche der Browser-Extension (SEO4U).
 *
 * Derselbe Lauf wie in der App (Vorschläge plus "Ähnliche Suchanfragen",
 * zusammengeführt und entdoppelt) – nur die Antwort ist fürs Popup gekürzt.
 * Der vollständige Lauf wird gespeichert und taucht in der App unter
 * Keyword-Recherche auf; der Link dorthin steht in der Antwort.
 */
export async function POST(request: Request) {
  const kontext = await resolveApiToken(request)
  if (!kontext) return tokenFehler()

  let seed: string
  try {
    const body = (await request.json()) as { seed?: string }
    seed = String(body.seed ?? '').trim().slice(0, 80)
  } catch {
    return extAntwort({ ok: false, error: 'bad_request', message: 'Ungültige Anfrage.' }, 400)
  }
  if (seed.length < 2) {
    return extAntwort({ ok: false, error: 'bad_request', message: 'Bitte einen Suchbegriff mit mindestens zwei Zeichen angeben.' }, 400)
  }

  if (!guthabenReicht(kontext.organization)) return guthabenAntwort()

  const secret = await resolveSecret<DataForSeoSecret>(kontext.organization.id, 'DATAFORSEO')
  if (!secret) {
    return extAntwort({ ok: false, error: 'api_error', message: 'Auf dem Server sind keine DataForSEO-Zugangsdaten hinterlegt.' }, 500)
  }

  const locationCode = 2276 // Deutschland
  const languageCode = 'de'
  const client = new DataForSeoClient(secret)
  const roh: KeywordEintrag[] = []
  let quellenFehler: string | null = null

  // Zwei Quellen wie in der App: Die zweite ist die Ergänzung, nicht die
  // Grundlage – schlägt sie fehl, ist das Ergebnis trotzdem brauchbar.
  try {
    const vorschlaege = await client.keywordSuggestions({ keyword: seed, locationCode, languageCode, limit: 200 })
    roh.push(...(vorschlaege?.items ?? []))
  } catch (error) {
    const message =
      error instanceof ConnectorError
        ? `DataForSEO meldet: ${error.message}`
        : 'Die Abfrage ist fehlgeschlagen. Bitte später erneut versuchen.'
    return extAntwort({ ok: false, error: 'api_error', message }, 502)
  }

  try {
    const verwandt = await client.relatedKeywords({ keyword: seed, locationCode, languageCode, limit: 100 })
    roh.push(...(verwandt?.items ?? []).map((i) => i.keyword_data ?? {}))
  } catch (error) {
    quellenFehler = error instanceof ConnectorError ? error.message : 'nicht erreichbar'
  }

  const zeilen = fuehreZusammen(roh)
  if (zeilen.length === 0) {
    return extAntwort({
      ok: false,
      error: 'no_results',
      message: `Zu "${seed}" liegen keine Begriffe mit messbarem Suchvolumen vor. Oft hilft ein allgemeinerer Begriff.`,
    })
  }

  const summary = { ...fasseZusammen(zeilen), quellenFehler }
  const verbraucht = await verbucheAbfrage(kontext.organization, 'extension-research', client.totalCost)

  // Der volle Lauf landet in der App – das Popup zeigt nur den Anfang.
  const research = await db.keywordResearch.create({
    data: {
      organizationId: kontext.organization.id,
      createdById: kontext.userId,
      seed,
      locationCode,
      languageCode,
      rows: zeilen,
      summary,
      creditsUsed: verbraucht,
    },
  })

  await db.auditLog.create({
    data: {
      organizationId: kontext.organization.id,
      userId: kontext.userId,
      action: 'extension.research',
      target: seed,
      metadata: { researchId: research.id, begriffe: zeilen.length },
    },
  })

  return extAntwort({
    ok: true,
    seed,
    total: zeilen.length,
    rows: zeilen.slice(0, POPUP_ZEILEN).map((z) => ({
      keyword: z.begriff,
      sv: z.suchvolumen,
      cpc: z.klickpreis,
      schwierigkeit: z.schwierigkeit,
      absicht: ABSICHT_LABEL[z.absicht],
    })),
    appUrl: `${env().APP_URL}/keywords/${research.id}`,
    remaining: verbleibendeAbfragen(kontext.organization, verbraucht),
  })
}
