import { request, ConnectorError, erklaereFehler } from './http'
import type { DataForSeoSecret } from './credentials'

const BASE = 'https://api.dataforseo.com/v3'

type DfsEnvelope<T> = {
  status_code: number
  status_message: string
  cost: number
  tasks: Array<{
    status_code: number
    status_message: string
    result: T[] | null
  }> | null
}

/**
 * DataForSEO – Basis für SERP, Keywords, Backlinks, On-Page und LLM-Sichtbarkeit.
 *
 * Die Live-Endpunkte antworten synchron und sind deshalb für einen
 * interaktiven Analyselauf geeignet; die Task-basierten Endpunkte würden
 * Polling erfordern.
 */
export class DataForSeoClient {
  private auth: string
  public totalCost = 0

  constructor(secret: DataForSeoSecret) {
    this.auth = Buffer.from(`${secret.login}:${secret.password}`).toString('base64')
  }

  private async post<T>(path: string, payload: unknown[]): Promise<T[]> {
    const data = await request<DfsEnvelope<T>>(`${BASE}${path}`, {
      method: 'POST',
      provider: 'DataForSEO',
      headers: { authorization: `Basic ${this.auth}` },
      body: payload,
      timeoutMs: 120_000,
    })

    if (data.status_code !== 20000) {
      // DataForSEO meldet Fehler auch mit HTTP 200 im Rumpf; die eigenen
      // Codes folgen dem Muster 401xx für Zugangsprobleme.
      const alsHttp = Math.floor(data.status_code / 100)
      throw new ConnectorError(
        'DataForSEO',
        erklaereFehler('DataForSEO', alsHttp) ?? data.status_message,
        data.status_code,
      )
    }
    this.totalCost += data.cost ?? 0

    const task = data.tasks?.[0]
    if (!task) throw new ConnectorError('DataForSEO', 'Antwort ohne Task')
    if (task.status_code !== 20000) {
      throw new ConnectorError('DataForSEO', task.status_message, task.status_code)
    }
    return task.result ?? []
  }

  /** Zugangsdaten prüfen, ohne Analysekontingent zu verbrauchen. */
  async verify(): Promise<{ ok: true; balance?: number }> {
    const result = await this.post<{ money?: { balance?: number } }>('/appendix/user_data', [{}])
    return { ok: true, balance: result[0]?.money?.balance }
  }

  /**
   * Organische Google-Ergebnisse inklusive SERP-Features.
   *
   * Die zusätzlichen Felder für KI-Übersichten und Folgefragen sind nicht für
   * jede Suchanfrage verfügbar; der Dienst antwortet dann mit einem
   * Serverfehler statt sie zu ignorieren. Deshalb der zweite Versuch ohne sie:
   * ein Ergebnis ohne diese Elemente ist besser als gar keines.
   */
  async serpOrganic(params: {
    keyword: string
    locationCode: number
    languageCode: string
    depth?: number
  }) {
    const basis = {
      keyword: params.keyword,
      location_code: params.locationCode,
      language_code: params.languageCode,
      depth: params.depth ?? 20,
    }

    try {
      const result = await this.post<SerpResult>('/serp/google/organic/live/advanced', [
        { ...basis, load_async_ai_overview: true, people_also_ask_click_depth: 1 },
      ])
      return result[0] ?? null
    } catch (error) {
      if (!(error instanceof ConnectorError)) throw error
      const result = await this.post<SerpResult>('/serp/google/organic/live/advanced', [basis])
      return result[0] ?? null
    }
  }

  /** Alle Keywords, für die eine Domain in den Top-100 rankt. */
  async rankedKeywords(params: {
    target: string
    locationCode: number
    languageCode: string
    limit?: number
  }) {
    const result = await this.post<RankedKeywordsResult>(
      '/dataforseo_labs/google/ranked_keywords/live',
      [
        {
          target: params.target,
          location_code: params.locationCode,
          language_code: params.languageCode,
          limit: params.limit ?? 100,
          order_by: ['keyword_data.keyword_info.search_volume,desc'],
        },
      ],
    )
    return result[0] ?? null
  }

  /** Domain-Kennzahlen: Sichtbarkeit, geschätzter Traffic, Ranking-Verteilung. */
  async domainRankOverview(params: {
    target: string
    locationCode: number
    languageCode: string
  }) {
    const result = await this.post<DomainRankResult>(
      '/dataforseo_labs/google/domain_rank_overview/live',
      [
        {
          target: params.target,
          location_code: params.locationCode,
          language_code: params.languageCode,
        },
      ],
    )
    return result[0] ?? null
  }

  /** Wettbewerber, die sich in denselben Suchergebnissen bewegen. */
  async competitorsDomain(params: {
    target: string
    locationCode: number
    languageCode: string
    limit?: number
  }) {
    const result = await this.post<CompetitorsResult>(
      '/dataforseo_labs/google/competitors_domain/live',
      [
        {
          target: params.target,
          location_code: params.locationCode,
          language_code: params.languageCode,
          limit: params.limit ?? 10,
          order_by: ['sum_position,asc'],
        },
      ],
    )
    return result[0] ?? null
  }

  /** Keywords, die Wettbewerber haben und die eigene Domain nicht (Content-Lücken). */
  async domainIntersection(params: {
    target1: string
    target2: string
    locationCode: number
    languageCode: string
    limit?: number
  }) {
    const result = await this.post<DomainIntersectionResult>(
      '/dataforseo_labs/google/domain_intersection/live',
      [
        {
          target1: params.target1,
          target2: params.target2,
          location_code: params.locationCode,
          language_code: params.languageCode,
          intersections: false,
          limit: params.limit ?? 50,
          order_by: ['keyword_data.keyword_info.search_volume,desc'],
        },
      ],
    )
    return result[0] ?? null
  }

  /** Keyword-Vorschläge zum Thema der Seite. */
  async keywordIdeas(params: {
    keywords: string[]
    locationCode: number
    languageCode: string
    limit?: number
  }) {
    const result = await this.post<KeywordIdeasResult>(
      '/dataforseo_labs/google/keyword_ideas/live',
      [
        {
          keywords: params.keywords.slice(0, 20),
          location_code: params.locationCode,
          language_code: params.languageCode,
          limit: params.limit ?? 50,
          order_by: ['keyword_info.search_volume,desc'],
        },
      ],
    )
    return result[0] ?? null
  }

  /** Backlink-Profil einer Domain. */
  async backlinksSummary(target: string) {
    const result = await this.post<BacklinksSummaryResult>('/backlinks/summary/live', [
      { target, internal_list_limit: 10, backlinks_status_type: 'live' },
    ])
    return result[0] ?? null
  }

  /**
   * Wie häufig eine Domain in LLM-Antworten auftaucht (GEO-Rohsignal).
   *
   * `target` erwartet eine Liste von Objekten, nicht eine Zeichenkette – der
   * Dienst weist einen einfachen Wert mit "Field target is missing or has an
   * invalid type (expected array)" ab.
   *
   * Eine Obergrenze nimmt der Dienst hier nicht entgegen (er antwortet mit
   * "Invalid Field: 'items_list_limit'"), deshalb wird die Liste erst nach
   * dem Abruf gekürzt.
   */
  async llmMentionsTopDomains(params: {
    keyword: string
    locationCode?: number
    languageCode?: string
    limit?: number
  }) {
    const result = await this.post<LlmTopDomainsResult>(
      '/ai_optimization/llm_mentions/top_domains/live',
      [
        {
          target: [{ keyword: params.keyword }],
          location_code: params.locationCode,
          language_code: params.languageCode,
        },
      ],
    )

    const eintrag = result[0]
    if (!eintrag?.items) return eintrag ?? null
    return { ...eintrag, items: eintrag.items.slice(0, params.limit ?? 20) }
  }

  /** Lighthouse-Messung über DataForSEO (Alternative zur PageSpeed-API). */
  async lighthouse(url: string) {
    const result = await this.post<LighthouseResult>('/on_page/lighthouse/live/json', [
      { url, for_mobile: true, categories: ['performance', 'accessibility', 'seo', 'best-practices'] },
    ])
    return result[0] ?? null
  }

  /** Technische On-Page-Prüfung einer einzelnen URL. */
  async instantPage(url: string) {
    const result = await this.post<InstantPageResult>('/on_page/instant_pages', [
      { url, enable_javascript: true, load_resources: true },
    ])
    return result[0] ?? null
  }
}

// --- Antwortformen, auf die die Auswertung zugreift -------------------------
// Bewusst schmal gehalten: nur die Felder, die tatsächlich gelesen werden.

export type SerpItem = {
  type: string
  rank_absolute?: number
  rank_group?: number
  domain?: string
  title?: string
  description?: string
  url?: string
  items?: Array<{ title?: string; seed_question?: string; text?: string }>
}

export type SerpResult = {
  keyword: string
  se_results_count?: number
  items_count?: number
  items?: SerpItem[]
}

export type RankedKeywordsResult = {
  total_count?: number
  items?: Array<{
    keyword_data?: {
      keyword?: string
      keyword_info?: { search_volume?: number; competition?: number; cpc?: number }
      keyword_properties?: { keyword_difficulty?: number }
      search_intent_info?: { main_intent?: string }
    }
    ranked_serp_element?: {
      serp_item?: { rank_absolute?: number; rank_group?: number; url?: string; etv?: number }
    }
  }>
}

export type DomainRankResult = {
  items?: Array<{
    metrics?: {
      organic?: {
        pos_1?: number
        pos_2_3?: number
        pos_4_10?: number
        pos_11_20?: number
        pos_21_30?: number
        count?: number
        etv?: number
        estimated_paid_traffic_cost?: number
      }
    }
  }>
}

export type CompetitorsResult = {
  items?: Array<{
    domain?: string
    avg_position?: number
    sum_position?: number
    intersections?: number
    full_domain_metrics?: { organic?: { count?: number; etv?: number } }
  }>
}

export type DomainIntersectionResult = {
  total_count?: number
  items?: Array<{
    keyword_data?: {
      keyword?: string
      keyword_info?: { search_volume?: number; competition?: number }
      keyword_properties?: { keyword_difficulty?: number }
      search_intent_info?: { main_intent?: string }
    }
    first_domain_serp_element?: { rank_absolute?: number; url?: string }
    second_domain_serp_element?: { rank_absolute?: number; url?: string }
  }>
}

export type KeywordIdeasResult = {
  items?: Array<{
    keyword?: string
    keyword_info?: { search_volume?: number; competition?: number; cpc?: number }
    keyword_properties?: { keyword_difficulty?: number }
    search_intent_info?: { main_intent?: string }
  }>
}

export type BacklinksSummaryResult = {
  target?: string
  rank?: number
  backlinks?: number
  referring_domains?: number
  referring_main_domains?: number
  broken_backlinks?: number
  referring_links_tld?: Record<string, number>
  backlinks_spam_score?: number
}

export type LlmTopDomainsResult = {
  items?: Array<{ domain?: string; mentions?: number; share?: number }>
}

export type LighthouseResult = {
  categories?: Record<string, { score?: number; title?: string }>
  audits?: Record<string, { score?: number | null; displayValue?: string; title?: string }>
}

export type InstantPageResult = {
  items?: Array<{
    url?: string
    status_code?: number
    meta?: {
      title?: string
      description?: string
      canonical?: string
      htags?: Record<string, string[]>
      internal_links_count?: number
      external_links_count?: number
      images_count?: number
      content?: { plain_text_word_count?: number; plain_text_rate?: number }
    }
    page_timing?: { duration_time?: number; largest_contentful_paint?: number }
    checks?: Record<string, boolean>
  }>
}
