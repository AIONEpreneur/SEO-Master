import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { resolveSecret, type DataForSeoSecret } from '@/lib/connectors/credentials'
import { DataForSeoClient, type KeywordEintrag } from '@/lib/connectors/dataforseo'
import { ConnectorError } from '@/lib/connectors/http'
import { fuehreZusammen, fasseZusammen, ABSICHT_LABEL } from '@/lib/keywords/research'
import { guthabenReicht, verbucheAbfrage, verbleibendeAbfragen } from './abrechnung'
import type { Organization } from '@prisma/client'

/**
 * Die Abfragen, die von ausserhalb der App kommen – Browser-Extension und
 * MCP-Anbindung (Claude, ChatGPT). Beide Wege nutzen dieselbe Logik, dieselbe
 * Abrechnung und dieselbe Ablage: Was hier läuft, taucht in der App unter
 * Keyword-Recherche bzw. Ranking-Abfragen auf und lässt sich dort
 * weiterverwenden.
 */

/** So viele Zeilen passen sinnvoll in ein Popup oder eine Werkzeug-Antwort. */
const ANTWORT_ZEILEN = 40

export type AbfrageFehler = {
  ok: false
  error: 'bad_request' | 'limit_reached' | 'no_results' | 'api_error'
  message: string
  /** Passender HTTP-Status für die REST-Antwort. */
  status: number
}

export type RechercheErgebnis = {
  ok: true
  seed: string
  total: number
  rows: Array<{
    keyword: string
    sv: number
    cpc: number
    schwierigkeit: number | null
    absicht: string
  }>
  appUrl: string
  remaining: number | null
}

export type RankingErgebnis = {
  ok: true
  domain: string
  total: number
  items: Array<{ rank: number | null; keyword: string; sv: number | null; path: string }>
  appUrl: string
  remaining: number | null
}

const KEIN_GUTHABEN: AbfrageFehler = {
  ok: false,
  error: 'limit_reached',
  message: 'Das Kontingent ist aufgebraucht. Bitte in SEO-Master nachsehen oder die Verwaltung fragen.',
  status: 402,
}

const KEINE_ZUGANGSDATEN: AbfrageFehler = {
  ok: false,
  error: 'api_error',
  message: 'Auf dem Server sind keine DataForSEO-Zugangsdaten hinterlegt.',
  status: 500,
}

function apiFehler(error: unknown): AbfrageFehler {
  const message =
    error instanceof ConnectorError
      ? `DataForSEO meldet: ${error.message}`
      : 'Die Abfrage ist fehlgeschlagen. Bitte später erneut versuchen.'
  return { ok: false, error: 'api_error', message, status: 502 }
}

/**
 * Keyword-Recherche: Vorschläge plus "Ähnliche Suchanfragen", zusammengeführt
 * und entdoppelt – derselbe Lauf wie in der App. Der vollständige Lauf wird
 * gespeichert; die Antwort ist auf die stärksten Zeilen gekürzt.
 */
export async function fuehreRecherche(params: {
  organization: Organization
  userId: string
  seed: string
  /** Für die Verbrauchsübersicht: woher kam die Abfrage? */
  operation: string
}): Promise<RechercheErgebnis | AbfrageFehler> {
  const seed = params.seed.trim().slice(0, 80)
  if (seed.length < 2) {
    return {
      ok: false,
      error: 'bad_request',
      message: 'Bitte einen Suchbegriff mit mindestens zwei Zeichen angeben.',
      status: 400,
    }
  }

  if (!guthabenReicht(params.organization)) return KEIN_GUTHABEN

  const secret = await resolveSecret<DataForSeoSecret>(params.organization.id, 'DATAFORSEO')
  if (!secret) return KEINE_ZUGANGSDATEN

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
    return apiFehler(error)
  }

  try {
    const verwandt = await client.relatedKeywords({ keyword: seed, locationCode, languageCode, limit: 100 })
    roh.push(...(verwandt?.items ?? []).map((i) => i.keyword_data ?? {}))
  } catch (error) {
    quellenFehler = error instanceof ConnectorError ? error.message : 'nicht erreichbar'
  }

  const zeilen = fuehreZusammen(roh)
  if (zeilen.length === 0) {
    return {
      ok: false,
      error: 'no_results',
      message: `Zu "${seed}" liegen keine Begriffe mit messbarem Suchvolumen vor. Oft hilft ein allgemeinerer Begriff.`,
      status: 200,
    }
  }

  const summary = { ...fasseZusammen(zeilen), quellenFehler }
  const verbraucht = await verbucheAbfrage(params.organization, params.operation, client.totalCost)

  const research = await db.keywordResearch.create({
    data: {
      organizationId: params.organization.id,
      createdById: params.userId,
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
      organizationId: params.organization.id,
      userId: params.userId,
      action: params.operation,
      target: seed,
      metadata: { researchId: research.id, begriffe: zeilen.length },
    },
  })

  return {
    ok: true,
    seed,
    total: zeilen.length,
    rows: zeilen.slice(0, ANTWORT_ZEILEN).map((z) => ({
      keyword: z.begriff,
      sv: z.suchvolumen,
      cpc: z.klickpreis,
      schwierigkeit: z.schwierigkeit,
      absicht: ABSICHT_LABEL[z.absicht],
    })),
    appUrl: `${env().APP_URL}/keywords/${research.id}`,
    remaining: verbleibendeAbfragen(params.organization, verbraucht),
  }
}

/**
 * Ranking-Abfrage: die organischen Google-DE-Platzierungen einer Domain oder
 * einer exakten Unterseite. Jede Abfrage wird gespeichert und erscheint in
 * der App unter Ranking-Abfragen.
 */
export async function fuehreRankingAbfrage(params: {
  organization: Organization
  userId: string
  target: string
  operation: string
}): Promise<RankingErgebnis | AbfrageFehler> {
  const target = params.target.trim().slice(0, 300)
  // Domain oder vollständige URL – beides nimmt DataForSEO als target an.
  if (!/^(https?:\/\/)?[a-z0-9äöüß.-]+\.[a-z]{2,}(\/\S*)?$/i.test(target)) {
    return {
      ok: false,
      error: 'bad_request',
      message: 'Bitte eine Domain oder Seitenadresse angeben.',
      status: 400,
    }
  }

  if (!guthabenReicht(params.organization)) return KEIN_GUTHABEN

  const secret = await resolveSecret<DataForSeoSecret>(params.organization.id, 'DATAFORSEO')
  if (!secret) return KEINE_ZUGANGSDATEN

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

    const verbraucht = await verbucheAbfrage(params.organization, params.operation, client.totalCost)

    const lookup = await db.rankingLookup.create({
      data: {
        organizationId: params.organization.id,
        createdById: params.userId,
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
        organizationId: params.organization.id,
        userId: params.userId,
        action: params.operation,
        target,
        metadata: { lookupId: lookup.id, treffer: items.length, gesamt: result?.total_count ?? items.length },
      },
    })

    return {
      ok: true,
      domain: target.replace(/^https?:\/\//, ''),
      total: result?.total_count ?? items.length,
      items,
      appUrl: `${env().APP_URL}/rankings/${lookup.id}`,
      remaining: verbleibendeAbfragen(params.organization, verbraucht),
    }
  } catch (error) {
    return apiFehler(error)
  }
}
