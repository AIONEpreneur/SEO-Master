import { request } from './http'

const BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

/**
 * Google PageSpeed Insights.
 *
 * Ohne Schlüssel nutzbar (mit knappem Kontingent), mit Schlüssel deutlich
 * grosszügiger – beides kostenlos. Liefert zusätzlich zu den Laborwerten die
 * CrUX-Felddaten, also die tatsächlich bei echten Nutzerinnen gemessenen
 * Core Web Vitals.
 */
export class PageSpeedClient {
  constructor(private apiKey?: string) {}

  async analyze(url: string, strategy: 'mobile' | 'desktop' = 'mobile') {
    const params = new URLSearchParams({ url, strategy })
    for (const c of ['performance', 'accessibility', 'best-practices', 'seo']) {
      params.append('category', c)
    }
    if (this.apiKey) params.set('key', this.apiKey)

    const data = await request<PageSpeedResponse>(`${BASE}?${params}`, {
      provider: 'PageSpeed',
      timeoutMs: 120_000,
      retries: 1,
    })

    const cats = data.lighthouseResult?.categories ?? {}
    const audits = data.lighthouseResult?.audits ?? {}
    const field = data.loadingExperience?.metrics

    return {
      strategy,
      scores: {
        performance: pct(cats.performance?.score),
        accessibility: pct(cats.accessibility?.score),
        bestPractices: pct(cats['best-practices']?.score),
        seo: pct(cats.seo?.score),
      },
      lab: {
        lcp: audits['largest-contentful-paint']?.numericValue ?? null,
        cls: audits['cumulative-layout-shift']?.numericValue ?? null,
        tbt: audits['total-blocking-time']?.numericValue ?? null,
        fcp: audits['first-contentful-paint']?.numericValue ?? null,
        speedIndex: audits['speed-index']?.numericValue ?? null,
      },
      // Felddaten aus dem Chrome UX Report – nur vorhanden, wenn die Seite
      // genug echten Traffic hat.
      field: field
        ? {
            lcp: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
            cls: field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? null,
            inp: field.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
            overall: data.loadingExperience?.overall_category ?? null,
          }
        : null,
      opportunities: Object.entries(audits)
        .filter(([, a]) => a.details?.type === 'opportunity' && (a.score ?? 1) < 0.9)
        .map(([id, a]) => ({ id, title: a.title ?? id, displayValue: a.displayValue ?? null }))
        .slice(0, 10),
    }
  }
}

const pct = (score?: number | null) => (typeof score === 'number' ? Math.round(score * 100) : null)

type PageSpeedResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>
    audits?: Record<
      string,
      {
        score?: number | null
        numericValue?: number
        displayValue?: string
        title?: string
        details?: { type?: string }
      }
    >
  }
  loadingExperience?: {
    overall_category?: string
    metrics?: Record<string, { percentile?: number; category?: string }>
  }
}

export type PageSpeedResult = Awaited<ReturnType<PageSpeedClient['analyze']>>
