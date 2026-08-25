import { createSign } from 'node:crypto'
import { request, ConnectorError } from './http'
import { frischesToken, type OAuthSecret } from './google-oauth'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const BASE = 'https://searchconsole.googleapis.com/webmasters/v3'
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

/**
 * Zugangsdaten eines Google-Dienstkontos.
 *
 * Das ist der Inhalt der JSON-Datei, die Google beim Anlegen eines
 * Dienstkontos zum Herunterladen anbietet.
 */
export type ServiceAccountSecret = {
  client_email: string
  private_key: string
  project_id?: string
  type?: string
}

/**
 * Google Search Console – die einzige Quelle für echte Zahlen.
 *
 * Alle anderen Anbieter schätzen: Sie messen Platzierungen von aussen und
 * rechnen daraus einen wahrscheinlichen Traffic hoch. Search Console zählt,
 * was tatsächlich passiert ist – Einblendungen, Klicks, die durchschnittliche
 * Position, und zwar je Suchanfrage. Der Unterschied ist keine Nuance: Auf
 * einer realen Seite standen 35 geschätzten Besuchen 277 gezählte gegenüber.
 *
 * Warum Dienstkonto und nicht OAuth: Ein Dienstkonto hat keinen
 * Zustimmungsbildschirm, kein ablaufendes Einverständnis und keine
 * Weiterleitungs-URLs, die zur Domain passen müssen. Die JSON-Datei geht in
 * den Tresor wie jeder andere Zugang. Für den späteren Verkauf an Dritte wäre
 * OAuth der richtige Weg – dann bringt jede Kundin ihr eigenes Google-Konto
 * mit, statt ein Dienstkonto in ihrer Search Console freizuschalten.
 */
/** Beide Wege, auf denen ein Zugang entstehen kann. */
export type SearchConsoleSecret = ServiceAccountSecret | OAuthSecret

export function istDienstkonto(secret: SearchConsoleSecret): secret is ServiceAccountSecret {
  return 'private_key' in secret && 'client_email' in secret
}

export class SearchConsoleClient {
  private secret: SearchConsoleSecret
  private token: { value: string; expires: number } | null = null

  constructor(secret: SearchConsoleSecret) {
    this.secret = secret
  }

  /** Wie die Verbindung zustande kam – für Anzeige und Fehlermeldungen. */
  get art(): 'dienstkonto' | 'anmeldung' {
    return istDienstkonto(this.secret) ? 'dienstkonto' : 'anmeldung'
  }

  /**
   * Zugriffstoken beschaffen.
   *
   * Google verlangt ein selbst signiertes JWT, das gegen ein Token getauscht
   * wird. Signiert wird mit dem privaten Schlüssel aus der JSON-Datei; dafür
   * genügt `node:crypto`, eine zusätzliche Bibliothek wäre nur Ballast.
   *
   * Das Token gilt eine Stunde und wird zwischengespeichert – ein Analyselauf
   * macht mehrere Abfragen, und jedes Mal neu zu signieren wäre verschwendet.
   */
  private async accessToken(): Promise<string> {
    const jetzt = Math.floor(Date.now() / 1000)
    if (this.token && this.token.expires > jetzt + 60) return this.token.value

    // Bei der Anmeldung über Google gibt es keinen Schlüssel zu signieren –
    // der Dauerzugang wird gegen ein frisches Zugriffstoken getauscht.
    if (!istDienstkonto(this.secret)) {
      const { token, gueltigBis } = await frischesToken(this.secret.refresh_token)
      this.token = { value: token, expires: gueltigBis }
      return token
    }

    const kopf = { alg: 'RS256', typ: 'JWT' }
    const dienstkonto = this.secret
    const inhalt = {
      iss: dienstkonto.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: jetzt,
      exp: jetzt + 3600,
    }

    const zuSignieren = `${base64url(JSON.stringify(kopf))}.${base64url(JSON.stringify(inhalt))}`

    let signatur: string
    try {
      const signer = createSign('RSA-SHA256')
      signer.update(zuSignieren)
      // Der Schlüssel steht in der JSON-Datei mit "\n" als zwei Zeichen. Wer
      // ihn über ein Formular einträgt, hat ihn oft schon aufgelöst – beide
      // Formen müssen funktionieren.
      signatur = signer.sign(dienstkonto.private_key.replace(/\\n/g, '\n'), 'base64url')
    } catch {
      throw new ConnectorError(
        'Search Console',
        'Der private Schlüssel des Dienstkontos ist unbrauchbar. Bitte die JSON-Datei unverändert eintragen.',
        401,
      )
    }

    const antwort = await request<{ access_token?: string; expires_in?: number; error_description?: string }>(
      TOKEN_URL,
      {
        method: 'POST',
        provider: 'Search Console',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: undefined,
        rawBody: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: `${zuSignieren}.${signatur}`,
        }).toString(),
        timeoutMs: 30_000,
      },
    )

    if (!antwort.access_token) {
      throw new ConnectorError('Search Console', antwort.error_description ?? 'Kein Zugriffstoken erhalten', 401)
    }

    this.token = { value: antwort.access_token, expires: jetzt + (antwort.expires_in ?? 3600) }
    return this.token.value
  }

  private async get<T>(pfad: string): Promise<T> {
    return request<T>(`${BASE}${pfad}`, {
      provider: 'Search Console',
      headers: { authorization: `Bearer ${await this.accessToken()}` },
      timeoutMs: 45_000,
    })
  }

  private async post<T>(pfad: string, rumpf: unknown): Promise<T> {
    return request<T>(`${BASE}${pfad}`, {
      method: 'POST',
      provider: 'Search Console',
      headers: { authorization: `Bearer ${await this.accessToken()}` },
      body: rumpf,
      timeoutMs: 60_000,
    })
  }

  /** Zugangsdaten prüfen, ohne eine Auswertung anzustossen. */
  async verify(): Promise<{ ok: true; sites: string[] }> {
    const antwort = await this.get<SiteListe>('/sites')
    const sites = (antwort.siteEntry ?? [])
      .filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
      .map((s) => s.siteUrl)
      .filter((s): s is string => Boolean(s))

    if (sites.length === 0) {
      throw new ConnectorError(
        'Search Console',
        this.art === 'dienstkonto'
          ? 'Das Dienstkonto ist gültig, hat aber auf keine Property Zugriff. In der Search Console unter Einstellungen › Nutzer und Berechtigungen die E-Mail-Adresse des Dienstkontos hinzufügen.'
          : 'Die Verbindung steht, aber dieses Google-Konto ist in der Search Console für keine Website eingetragen. Search Console zeigt nur Seiten, für die man selbst freigeschaltet ist.',
        403,
      )
    }

    return { ok: true, sites }
  }

  /** Alle Properties, auf die das Dienstkonto Zugriff hat. */
  async sites(): Promise<string[]> {
    const antwort = await this.get<SiteListe>('/sites')
    return (antwort.siteEntry ?? [])
      .filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
      .map((s) => s.siteUrl)
      .filter((s): s is string => Boolean(s))
  }

  /**
   * Suchanfragen-Bericht abrufen.
   *
   * `siteUrl` muss kodiert werden: Eine Property heisst entweder
   * "https://beispiel.de/" oder "sc-domain:beispiel.de", und beide enthalten
   * Zeichen, die im Pfad nicht roh stehen dürfen.
   */
  async searchAnalytics(params: {
    siteUrl: string
    startDate: string
    endDate: string
    dimensions: Array<'query' | 'page' | 'date' | 'country' | 'device'>
    rowLimit?: number
    /** Nur Zeilen zu genau dieser Seite. */
    pageFilter?: string
  }): Promise<SearchAnalyticsRow[]> {
    const rumpf: Record<string, unknown> = {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions,
      rowLimit: params.rowLimit ?? 250,
      type: 'web',
    }

    if (params.pageFilter) {
      rumpf.dimensionFilterGroups = [
        { filters: [{ dimension: 'page', operator: 'equals', expression: params.pageFilter }] },
      ]
    }

    const antwort = await this.post<{ rows?: SearchAnalyticsRow[] }>(
      `/sites/${encodeURIComponent(params.siteUrl)}/searchAnalytics/query`,
      rumpf,
    )
    return antwort.rows ?? []
  }
}

type SiteListe = {
  siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>
}

export type SearchAnalyticsRow = {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

/**
 * Passende Property zu einer Adresse finden.
 *
 * Search Console kennt zwei Arten: die Domain-Property ("sc-domain:beispiel.de",
 * umfasst alle Subdomains und beide Protokolle) und die URL-Präfix-Property
 * ("https://beispiel.de/", nur genau dieser Pfad und darunter).
 *
 * Die Domain-Property hat Vorrang, weil sie mehr abdeckt. Sonst gewinnt das
 * längste Präfix, das noch passt – bei mehreren Treffern ist das das
 * spezifischste.
 */
export function findeProperty(sites: string[], zielUrl: string): string | null {
  let host: string
  try {
    host = new URL(zielUrl).hostname.replace(/^www\./, '')
  } catch {
    return null
  }

  const domainProperty = sites.find((s) => {
    if (!s.startsWith('sc-domain:')) return false
    const eigen = s.slice('sc-domain:'.length).replace(/^www\./, '')
    return host === eigen || host.endsWith(`.${eigen}`)
  })
  if (domainProperty) return domainProperty

  const passende = sites
    .filter((s) => !s.startsWith('sc-domain:') && zielUrl.startsWith(s.replace(/\/$/, '')))
    .sort((a, b) => b.length - a.length)

  return passende[0] ?? null
}

/**
 * Zeitraum für die Abfrage.
 *
 * Search Console hinkt zwei bis drei Tage hinterher. Wer bis heute abfragt,
 * bekommt für die letzten Tage künstlich niedrige Zahlen und liest daraus
 * einen Einbruch, den es nicht gibt.
 */
export function zeitraum(tage = 90, heute = new Date()): { startDate: string; endDate: string } {
  const ende = new Date(heute)
  ende.setUTCDate(ende.getUTCDate() - 3)
  const start = new Date(ende)
  start.setUTCDate(start.getUTCDate() - tage)
  return { startDate: alsDatum(start), endDate: alsDatum(ende) }
}

function alsDatum(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function base64url(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url')
}
