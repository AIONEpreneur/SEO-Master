import { request } from './http'
import type { ApiKeySecret } from './credentials'

const BASE = 'https://api.firecrawl.dev/v2'

/**
 * Firecrawl – liefert den gerenderten Seiteninhalt.
 *
 * Wichtig für die Analyse: viele moderne Seiten bauen ihren Inhalt erst per
 * JavaScript auf. Ein einfacher HTML-Abruf sieht dort fast nichts – genau wie
 * ein einfacher KI-Crawler. Firecrawl liefert beides, das gerenderte Ergebnis
 * und das rohe HTML, sodass die Differenz messbar wird.
 */
export class FirecrawlClient {
  constructor(private secret: ApiKeySecret) {}

  private headers() {
    return { authorization: `Bearer ${this.secret.apiKey}` }
  }

  async verify(): Promise<{ ok: true }> {
    await request(`${BASE}/scrape`, {
      method: 'POST',
      provider: 'Firecrawl',
      headers: this.headers(),
      body: { url: 'https://example.com', formats: ['markdown'] },
      timeoutMs: 45_000,
      retries: 0,
    })
    return { ok: true }
  }

  async scrape(url: string, options?: { onlyMainContent?: boolean; waitFor?: number }) {
    const response = await request<{ success: boolean; data?: ScrapeData }>(`${BASE}/scrape`, {
      method: 'POST',
      provider: 'Firecrawl',
      headers: this.headers(),
      body: {
        url,
        // rawHtml ist entscheidend: 'html' liefert den aufbereiteten
        // Seiteninhalt, bei dem der <head> fehlen kann. Genau dort stehen
        // Title, Description und die strukturierten Daten – ohne rawHtml
        // meldet die Analyse sie fälschlich als nicht vorhanden.
        formats: ['markdown', 'rawHtml', 'html', 'links'],
        onlyMainContent: options?.onlyMainContent ?? false,
        waitFor: options?.waitFor ?? 2000,
        timeout: 45_000,
        // maxAge: 0 erzwingt einen frischen Abruf. Ohne diese Angabe darf
        // Firecrawl eine bereits gespeicherte Fassung der Seite ausliefern –
        // wie alt sie sein darf, entscheidet Firecrawl je Domain. Für eine
        // Analyse ist das der schlimmste Fall: Die Seite wurde geändert, der
        // Bericht bewertet den Stand von vorgestern und niemand merkt es.
        maxAge: 0,
      },
      timeoutMs: 90_000,
    })
    return response.data ?? null
  }

  /** URL-Struktur einer Domain ermitteln, ohne jede Seite zu laden. */
  async map(url: string, limit = 200) {
    const response = await request<{ success: boolean; links?: Array<{ url: string; title?: string }> }>(
      `${BASE}/map`,
      {
        method: 'POST',
        provider: 'Firecrawl',
        headers: this.headers(),
        body: { url, limit, includeSubdomains: false },
        timeoutMs: 90_000,
      },
    )
    return response.links ?? []
  }

  /** Websuche mit direkt mitgeliefertem Seiteninhalt der Treffer. */
  async search(query: string, limit = 5) {
    const response = await request<{ success: boolean; data?: { web?: SearchHit[] } }>(
      `${BASE}/search`,
      {
        method: 'POST',
        provider: 'Firecrawl',
        headers: this.headers(),
        body: { query, limit, scrapeOptions: { formats: ['markdown'] } },
        timeoutMs: 90_000,
      },
    )
    return response.data?.web ?? []
  }
}

export type ScrapeData = {
  markdown?: string
  html?: string
  rawHtml?: string
  links?: string[]
  metadata?: {
    title?: string
    description?: string
    language?: string
    sourceURL?: string
    statusCode?: number
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    robots?: string
    [key: string]: unknown
  }
}

export type SearchHit = {
  url: string
  title?: string
  description?: string
  markdown?: string
}
