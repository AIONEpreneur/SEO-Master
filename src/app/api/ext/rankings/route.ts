import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { resolveApiToken, tokenFehler } from '@/lib/auth/api-token'
import { resolveSecret, type DataForSeoSecret } from '@/lib/connectors/credentials'
import { DataForSeoClient } from '@/lib/connectors/dataforseo'
import { ConnectorError } from '@/lib/connectors/http'
import { guthabenReicht, guthabenAntwort, verbucheAbfrage, verbleibendeAbfragen } from '@/lib/extension/abrechnung'
import { extAntwort, extPreflight } from '@/lib/extension/cors'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export function OPTIONS() {
  return extPreflight()
}

/**
 * Ranking-Abfrage der Browser-Extension (SEO4U).
 *
 * Nimmt eine Domain oder die vollständige Adresse einer Unterseite entgegen
 * und liefert die organischen Google-DE-Platzierungen: Keyword, Position,
 * Suchvolumen und rankende Seite. Das Antwortformat ist auf die Anzeige im
 * Extension-Popup zugeschnitten und bleibt deshalb bewusst flach.
 */
export async function POST(request: Request) {
  const kontext = await resolveApiToken(request)
  if (!kontext) return tokenFehler()

  let target: string
  try {
    const body = (await request.json()) as { target?: string }
    target = String(body.target ?? '').trim().slice(0, 300)
  } catch {
    return extAntwort({ ok: false, error: 'bad_request', message: 'Ungültige Anfrage.' }, 400)
  }
  // Domain oder vollständige URL – beides nimmt DataForSEO als target an.
  if (!/^(https?:\/\/)?[a-z0-9äöüß.-]+\.[a-z]{2,}(\/\S*)?$/i.test(target)) {
    return extAntwort({ ok: false, error: 'bad_request', message: 'Bitte eine Domain oder Seitenadresse angeben.' }, 400)
  }

  if (!guthabenReicht(kontext.organization)) return guthabenAntwort()

  const secret = await resolveSecret<DataForSeoSecret>(kontext.organization.id, 'DATAFORSEO')
  if (!secret) {
    return extAntwort({ ok: false, error: 'api_error', message: 'Auf dem Server sind keine DataForSEO-Zugangsdaten hinterlegt.' }, 500)
  }

  const client = new DataForSeoClient(secret)
  try {
    const result = await client.rankedKeywords({
      target,
      locationCode: 2276, // Deutschland
      languageCode: 'de',
      limit: 30,
      orderBy: ['ranked_serp_element.serp_item.rank_group,asc'],
      itemTypes: ['organic'],
      includeSubdomains: true,
    })

    const items = (result?.items ?? []).map((it) => {
      const serp = it.ranked_serp_element?.serp_item ?? {}
      let path = ''
      try {
        path = serp.url ? new URL(serp.url).pathname : ''
      } catch {
        /* Adresse unlesbar – dann eben ohne Pfad. */
      }
      return {
        rank: serp.rank_group ?? serp.rank_absolute ?? null,
        keyword: it.keyword_data?.keyword ?? '?',
        sv: it.keyword_data?.keyword_info?.search_volume ?? null,
        path,
      }
    })

    const verbraucht = await verbucheAbfrage(kontext.organization, 'extension-rankings', client.totalCost)

    // Die Abfrage bleibt im Arbeitsbereich auffindbar: Unter Ranking-Abfragen
    // in der App lässt sich damit weiterarbeiten, statt dass das Ergebnis mit
    // dem Schliessen des Popups verloren geht.
    const lookup = await db.rankingLookup.create({
      data: {
        organizationId: kontext.organization.id,
        createdById: kontext.userId,
        target,
        scope: /^https?:\/\//i.test(target) ? 'seite' : 'domain',
        locationCode: 2276,
        languageCode: 'de',
        totalCount: result?.total_count ?? items.length,
        items,
        creditsUsed: verbraucht,
      },
    })

    await db.auditLog.create({
      data: {
        organizationId: kontext.organization.id,
        userId: kontext.userId,
        action: 'extension.rankings',
        target,
        metadata: { lookupId: lookup.id, treffer: items.length, gesamt: result?.total_count ?? items.length },
      },
    })

    return extAntwort({
      ok: true,
      domain: target.replace(/^https?:\/\//, ''),
      total: result?.total_count ?? items.length,
      items,
      appUrl: `${env().APP_URL}/rankings/${lookup.id}`,
      remaining: verbleibendeAbfragen(kontext.organization, verbraucht),
    })
  } catch (error) {
    const message =
      error instanceof ConnectorError
        ? `DataForSEO meldet: ${error.message}`
        : 'Die Abfrage ist fehlgeschlagen. Bitte später erneut versuchen.'
    return extAntwort({ ok: false, error: 'api_error', message }, 502)
  }
}
