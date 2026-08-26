import type { Criterion, Finding, ModuleResult } from './types'
import { weightedScore, scoreLabel, statusFor } from './types'
import type {
  CompetitorsResult,
  DomainIntersectionResult,
  DomainRankResult,
  BacklinksSummaryResult,
} from '@/lib/connectors/dataforseo'

/**
 * Bis zum Wievielfachen des eigenen Traffics gilt eine Domain als Wettbewerber?
 *
 * Darüber liegt kein vergleichbarer Marktteilnehmer mehr, sondern jemand aus
 * einer anderen Liga – der Abstand lässt sich nicht durch Massnahmen schliessen,
 * die aus dieser Analyse folgen könnten.
 */
const GROESSENGRENZE = 50

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
/**
 * Mindest-Überschneidung für automatisch gefundene Wettbewerber.
 *
 * Die Wettbewerber-Abfrage liefert jede Domain, die irgendein Keyword teilt.
 * Bei kleinen Domains reicht damit eine einzige Überschneidung – so landete
 * die Katholische Erwachsenenbildung Bayern als "Wettbewerberin" einer
 * KI-Beraterin im Bericht, mit einem gemeinsamen Keyword auf Position 31.
 * Auf dem Vergleich ruhte dann der ganze Block: Platz 5 von 5, das 14-fache
 * an Traffic, 22 "fehlende" Keywords.
 *
 * Wettbewerberin ist, wer entweder mindestens fünf Keywords teilt oder ein
 * Zehntel des eigenen Bestands – was zuerst erreicht ist.
 */
export const MINDEST_GEMEINSAME = 5

export function belastbareWettbewerber<T extends { intersections?: number }>(
  items: T[],
  eigeneKeywords: number,
): { belastbar: T[]; aussortiert: T[] } {
  const schwelle = Math.max(
    1,
    Math.min(MINDEST_GEMEINSAME, Math.ceil(eigeneKeywords * 0.1)),
  )
  const belastbar = items.filter((c) => (c.intersections ?? 0) >= schwelle)
  return { belastbar, aussortiert: items.filter((c) => !belastbar.includes(c)) }
}

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

  const alleRivalen: CompetitorProfile[] =
    input.competitorProfiles ??
    (input.competitors?.items ?? []).map((c) => ({
      domain: c.domain ?? '',
      keywordsTop100: c.full_domain_metrics?.organic?.count ?? null,
      estimatedTraffic: Math.round(c.full_domain_metrics?.organic?.etv ?? 0),
      referringDomains: null,
      avgPosition: c.avg_position ?? null,
      sharedKeywords: c.intersections ?? null,
    }))

  // Wer um Grössenordnungen grösser ist, ist kein Wettbewerber.
  //
  // Die Überschneidung im Suchergebnis findet auch Konzerne, die zufällig für
  // einzelne Begriffe ranken. Ein Vergleich mit ihnen erzeugt Zahlen wie "das
  // 80-millionenfache an Traffic" – rechnerisch richtig und als Aussage wertlos,
  // weil daraus keine Massnahme folgt.
  const rivals = alleRivalen.filter((r) => (r.estimatedTraffic ?? 0) <= ownTraffic * GROESSENGRENZE)
  const ausgeschlossen = alleRivalen.filter((r) => !rivals.includes(r))

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

      let detail = `Platz ${rank} von ${total} im Vergleich (geschätzter Traffic: eigene Domain ${ownTraffic.toLocaleString('de-DE')}/Monat, stärkste Wettbewerberin ${Math.max(...withTraffic.map((r) => r.estimatedTraffic ?? 0), 0).toLocaleString('de-DE')}/Monat).`
      if (ausgeschlossen.length) {
        detail += ` Nicht einbezogen, weil um Grössenordnungen grösser: ${ausgeschlossen
          .map((r) => r.domain)
          .slice(0, 4)
          .join(', ')}.`
      }

      if (stronger.length > 0) {
        const leader = stronger.sort((a, b) => (b.estimatedTraffic ?? 0) - (a.estimatedTraffic ?? 0))[0]
        const verhaeltnis = ownTraffic > 0 ? (leader.estimatedTraffic ?? 0) / ownTraffic : null
        const factor =
          verhaeltnis === null
            ? 'ein Vielfaches'
            : verhaeltnis >= 10
              ? `das ${Math.round(verhaeltnis)}-fache`
              : `das ${verhaeltnis.toFixed(1)}-fache`
        findings.push({
          id: 'comp-behind-leader',
          severity: stronger.length > rivals.length / 2 ? 'critical' : 'longterm',
          title: `${stronger.length} Wettbewerber vor der eigenen Domain`,
          why: `${leader.domain} erreicht rund ${factor} an organischem Traffic bei ${leader.keywordsTop100?.toLocaleString('de-DE') ?? '?'} platzierten Keywords (eigene Domain: ${ownKeywords.toLocaleString('de-DE')}).`,
          action: `Inhaltsbestand von ${leader.domain} auswerten: welche Themen sind dort abgedeckt und im eigenen Bestand nicht? Die Lücken nach Suchvolumen priorisiert schliessen.`,
          effort: 'hoch',
          impact: 'hoch',
        })
      }
      criteria.push({ key: 'position', label: 'Position im Wettbewerb', score, weight: 40, detail, status: statusFor(score) })
    }
  }

  // --- Keyword-Lücken -------------------------------------------------------
  // Die Abfrage liefert zu jedem Keyword auch die eigene Platzierung mit
  // (first_domain_serp_element). Sie zu ignorieren machte aus Begriffen, für
  // die die Domain auf Platz 33–38 steht, "unbesetzte Felder" – die
  // Empfehlung lautete dann, neue Seiten zu bauen, wo Nacharbeit an
  // bestehenden gefragt ist.
  const roheLuecken = input.gaps
    .flatMap(({ competitor, result }) =>
      (result?.items ?? []).map((item) => ({
        competitor,
        keyword: item.keyword_data?.keyword ?? '',
        volume: item.keyword_data?.keyword_info?.search_volume ?? 0,
        difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty ?? null,
        intent: item.keyword_data?.search_intent_info?.main_intent ?? null,
        ownPosition: item.first_domain_serp_element?.rank_absolute ?? null,
        competitorPosition: item.second_domain_serp_element?.rank_absolute ?? null,
        competitorUrl: item.second_domain_serp_element?.url ?? null,
      })),
    )
    .filter((g) => g.keyword && g.volume > 0)

  // Echte Lücke: die eigene Domain rankt gar nicht. Wer bereits rankt, hat
  // keine Lücke, sondern eine Seite, die nachgeschärft gehört.
  const allGaps = roheLuecken.filter((g) => g.ownPosition === null)
  const nacharbeit = roheLuecken.filter((g) => g.ownPosition !== null && g.ownPosition > 10)

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

  {
    const einzigartig = [...new Map(nacharbeit.map((n) => [n.keyword, n])).values()].sort(
      (a, b) => b.volume - a.volume,
    )
    if (einzigartig.length >= 2) {
      const beispiele = einzigartig
        .slice(0, 3)
        .map((n) => `"${n.keyword}" (${n.volume.toLocaleString('de-DE')}/Monat, Position ${n.ownPosition})`)
        .join(', ')
      findings.push({
        id: 'comp-nacharbeit',
        severity: 'quickwin',
        title: `${einzigartig.length} Begriffe, für die die Domain bereits rankt – nur zu weit hinten`,
        why: `Darunter ${beispiele}. Das sind keine unbesetzten Felder: Die Seiten existieren und ranken – sie stehen nur jenseits von Seite eins.`,
        action: 'Die bestehenden Seiten nachschärfen (Inhaltstiefe, interne Verlinkung, Aktualität) statt neue zu bauen. Eine Seite von Position 35 auf 8 zu heben ist schneller als eine neue von null.',
        effort: 'mittel',
        impact: 'hoch',
      })
    }
  }
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
      ausgeschlossen: ausgeschlossen.map((r) => ({ domain: r.domain, estimatedTraffic: r.estimatedTraffic })),
      keywordGaps: topGaps,
      gapCount: gapsByKeyword.size,
      nacharbeit: [...new Map(nacharbeit.map((n) => [n.keyword, n])).values()]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10)
        .map(({ keyword, volume, ownPosition }) => ({ keyword, volume, ownPosition })),
    },
  }
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10))
