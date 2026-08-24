import type { Criterion, Finding, ModuleResult } from './types'
import { weightedScore, scoreLabel, statusFor } from './types'
import type {
  CompetitorsResult,
  DomainIntersectionResult,
  DomainRankResult,
  BacklinksSummaryResult,
} from '@/lib/connectors/dataforseo'

export type CompetitorProfile = {
  domain: string
  keywordsTop100: number | null
  estimatedTraffic: number | null
  referringDomains: number | null
  avgPosition: number | null
  sharedKeywords: number | null
}

/**
 * Wettbewerbsanalyse: Wer teilt sich die Suchergebnisse mit der eigenen Domain,
 * wie gross ist der Abstand, und welche Themen fehlen im eigenen Bestand?
 */
export function analyzeCompetitors(input: {
  domain: string
  own: { domainRank?: DomainRankResult | null; backlinks?: BacklinksSummaryResult | null }
  competitors: CompetitorsResult | null
  /** Keyword-Lücken je Wettbewerber. */
  gaps: Array<{ competitor: string; result: DomainIntersectionResult | null }>
  competitorProfiles?: CompetitorProfile[]
}): ModuleResult {
  const findings: Finding[] = []
  const criteria: Criterion[] = []

  const ownOrganic = input.own.domainRank?.items?.[0]?.metrics?.organic
  const ownKeywords = ownOrganic?.count ?? 0
  const ownTraffic = Math.round(ownOrganic?.etv ?? 0)
  const ownRefDomains = input.own.backlinks?.referring_main_domains ?? input.own.backlinks?.referring_domains ?? null

  const rivals: CompetitorProfile[] =
    input.competitorProfiles ??
    (input.competitors?.items ?? []).map((c) => ({
      domain: c.domain ?? '',
      keywordsTop100: c.full_domain_metrics?.organic?.count ?? null,
      estimatedTraffic: Math.round(c.full_domain_metrics?.organic?.etv ?? 0),
      referringDomains: null,
      avgPosition: c.avg_position ?? null,
      sharedKeywords: c.intersections ?? null,
    }))

  // --- Wettbewerbsposition --------------------------------------------------
  {
    if (rivals.length === 0) {
      criteria.push({ key: 'position', label: 'Position im Wettbewerb', score: 0, weight: 40, detail: 'Keine Wettbewerberdaten verfügbar.', status: 'unknown' })
    } else {
      const withTraffic = rivals.filter((r) => (r.estimatedTraffic ?? 0) > 0)
      const stronger = withTraffic.filter((r) => (r.estimatedTraffic ?? 0) > ownTraffic)
      const rank = stronger.length + 1
      const total = withTraffic.length + 1
      const score = clamp(10 - ((rank - 1) / Math.max(total - 1, 1)) * 9)

      const detail = `Platz ${rank} von ${total} im Vergleich (geschätzter Traffic: eigene Domain ${ownTraffic}/Monat, stärkste Wettbewerberin ${Math.max(...withTraffic.map((r) => r.estimatedTraffic ?? 0), 0)}/Monat).`

      if (stronger.length > 0) {
        const leader = stronger.sort((a, b) => (b.estimatedTraffic ?? 0) - (a.estimatedTraffic ?? 0))[0]
        const factor = ownTraffic > 0 ? ((leader.estimatedTraffic ?? 0) / ownTraffic).toFixed(1) : '∞'
        findings.push({
          id: 'comp-behind-leader',
          severity: stronger.length > rivals.length / 2 ? 'critical' : 'longterm',
          title: `${stronger.length} Wettbewerber vor der eigenen Domain`,
          why: `${leader.domain} erreicht rund das ${factor}-fache an organischem Traffic bei ${leader.keywordsTop100 ?? '?'} platzierten Keywords (eigene Domain: ${ownKeywords}).`,
          action: `Inhaltsbestand von ${leader.domain} auswerten: welche Themen sind dort abgedeckt und im eigenen Bestand nicht? Die Lücken nach Suchvolumen priorisiert schliessen.`,
          effort: 'hoch',
          impact: 'hoch',
        })
      }
      criteria.push({ key: 'position', label: 'Position im Wettbewerb', score, weight: 40, detail, status: statusFor(score) })
    }
  }

  // --- Keyword-Lücken -------------------------------------------------------
  const allGaps = input.gaps
    .flatMap(({ competitor, result }) =>
      (result?.items ?? []).map((item) => ({
        competitor,
        keyword: item.keyword_data?.keyword ?? '',
        volume: item.keyword_data?.keyword_info?.search_volume ?? 0,
        difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty ?? null,
        intent: item.keyword_data?.search_intent_info?.main_intent ?? null,
        competitorPosition: item.second_domain_serp_element?.rank_absolute ?? null,
        competitorUrl: item.second_domain_serp_element?.url ?? null,
      })),
    )
    .filter((g) => g.keyword && g.volume > 0)

  // Nach Keyword zusammenfassen: taucht ein Thema bei mehreren Wettbewerbern
  // auf, ist es für den Markt offensichtlich relevant.
  const gapsByKeyword = new Map<string, (typeof allGaps)[number] & { competitorCount: number }>()
  for (const gap of allGaps) {
    const existing = gapsByKeyword.get(gap.keyword)
    if (existing) existing.competitorCount++
    else gapsByKeyword.set(gap.keyword, { ...gap, competitorCount: 1 })
  }

  const topGaps = [...gapsByKeyword.values()]
    .sort((a, b) => b.competitorCount - a.competitorCount || b.volume - a.volume)
    .slice(0, 30)

  {
    const score = topGaps.length === 0 ? 8 : topGaps.length < 10 ? 6 : topGaps.length < 30 ? 4 : 2
    const totalVolume = topGaps.reduce((sum, g) => sum + g.volume, 0)
    const detail = topGaps.length
      ? `${gapsByKeyword.size} Keywords, für die Wettbewerber ranken und die eigene Domain nicht. Suchvolumen der Top 30: ${totalVolume.toLocaleString('de-DE')}/Monat.`
      : 'Keine relevanten Keyword-Lücken gefunden.'

    if (topGaps.length >= 5) {
      const quickWins = topGaps.filter((g) => (g.difficulty ?? 100) < 40).slice(0, 5)
      findings.push({
        id: 'comp-keyword-gaps',
        severity: 'quickwin',
        title: `${gapsByKeyword.size} Themen, die Wettbewerber besetzen und die eigene Domain nicht`,
        why: `Diese Suchanfragen bringen Wettbewerbern bereits Traffic. Das Interesse ist belegt – es fehlt nur der eigene Inhalt.`,
        action: quickWins.length
          ? `Mit den Themen mit geringem Wettbewerb beginnen: ${quickWins.map((g) => `"${g.keyword}" (${g.volume}/Monat, Schwierigkeit ${g.difficulty})`).join('; ')}.`
          : `Nach Suchvolumen priorisieren: ${topGaps.slice(0, 5).map((g) => `"${g.keyword}" (${g.volume}/Monat)`).join('; ')}.`,
        effort: 'mittel',
        impact: 'hoch',
      })
    }
    criteria.push({ key: 'gaps', label: 'Keyword-Lücken', score, weight: 35, detail, status: statusFor(score) })
  }

  // --- Autoritätsabstand ----------------------------------------------------
  {
    const withRefDomains = rivals.filter((r) => r.referringDomains !== null)
    if (ownRefDomains === null || withRefDomains.length === 0) {
      criteria.push({ key: 'authority', label: 'Autoritätsabstand', score: 0, weight: 25, detail: 'Keine vergleichbaren Backlink-Daten verfügbar.', status: 'unknown' })
    } else {
      const avgRivals = withRefDomains.reduce((sum, r) => sum + (r.referringDomains ?? 0), 0) / withRefDomains.length
      const ratio = avgRivals > 0 ? ownRefDomains / avgRivals : 1
      const score = clamp(Math.min(10, ratio * 6))
      const detail = `${ownRefDomains} verweisende Domains gegenüber durchschnittlich ${Math.round(avgRivals)} im Wettbewerbsumfeld.`

      if (ratio < 0.5) {
        findings.push({
          id: 'comp-authority-gap',
          severity: 'longterm',
          title: 'Deutlicher Rückstand bei verweisenden Domains',
          why: `Der Wettbewerb hat im Schnitt ${Math.round(avgRivals)} verweisende Domains, die eigene Domain ${ownRefDomains}. Das begrenzt sowohl Rankings als auch Sichtbarkeit in KI-Antworten.`,
          action: 'Über 6–12 Monate systematisch Erwähnungen aufbauen: Gastbeiträge bei den verweisenden Domains der Wettbewerber, Podcast-Auftritte, Fachverzeichnisse, eigene zitierfähige Daten veröffentlichen.',
          effort: 'hoch',
          impact: 'hoch',
        })
      }
      criteria.push({ key: 'authority', label: 'Autoritätsabstand', score, weight: 25, detail, status: statusFor(score) })
    }
  }

  const score = weightedScore(criteria)

  return {
    module: 'COMPETITORS',
    score,
    label: scoreLabel(score),
    criteria,
    findings,
    data: {
      own: { domain: input.domain, keywordsTop100: ownKeywords, estimatedTraffic: ownTraffic, referringDomains: ownRefDomains },
      competitors: rivals.slice(0, 10),
      keywordGaps: topGaps,
      gapCount: gapsByKeyword.size,
    },
  }
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10))
