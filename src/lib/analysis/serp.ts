import type { Criterion, Finding, ModuleResult } from './types'
import { weightedScore, scoreLabel, statusFor } from './types'
import type { SerpResult, SerpItem, RankedKeywordsResult, DomainRankResult } from '@/lib/connectors/dataforseo'

/**
 * SERP-Analyse: Wo steht die Domain tatsächlich, und wie sieht das Umfeld aus,
 * in dem sie sich behaupten muss?
 */
export function analyzeSerp(input: {
  domain: string
  serps: Array<{ keyword: string; result: SerpResult | null }>
  rankedKeywords?: RankedKeywordsResult | null
  domainRank?: DomainRankResult | null
}): ModuleResult {
  const { domain, serps, rankedKeywords, domainRank } = input
  const findings: Finding[] = []
  const criteria: Criterion[] = []

  // Eigene Platzierungen je geprüftem Keyword.
  const positions = serps.map(({ keyword, result }) => {
    const organic = (result?.items ?? []).filter((i) => i.type === 'organic')
    const own = organic.find((i) => sameDomain(i.domain, domain))
    return {
      keyword,
      position: own?.rank_group ?? null,
      url: own?.url ?? null,
      totalResults: result?.se_results_count ?? null,
      features: serpFeatures(result?.items ?? []),
      topCompetitors: organic.slice(0, 5).map((i) => ({ domain: i.domain ?? '', title: i.title ?? '', position: i.rank_group ?? 0 })),
    }
  })

  const ranked = positions.filter((p) => p.position !== null)
  const top10 = ranked.filter((p) => (p.position ?? 99) <= 10)
  const top3 = ranked.filter((p) => (p.position ?? 99) <= 3)

  // --- Platzierungen --------------------------------------------------------
  {
    const score =
      positions.length === 0
        ? 0
        : clamp((top3.length * 10 + (top10.length - top3.length) * 7 + (ranked.length - top10.length) * 3) / positions.length)
    const detail =
      positions.length === 0
        ? 'Keine Keywords zur Prüfung angegeben – ohne Suchbegriffe lässt sich die Platzierung nicht messen.'
        : `${ranked.length} von ${positions.length} geprüften Keywords platziert, davon ${top10.length} in den Top 10 und ${top3.length} in den Top 3.`

    if (ranked.length === 0 && positions.length > 0) {
      findings.push({
        id: 'serp-not-ranking',
        severity: 'critical',
        title: 'Für keines der geprüften Keywords in den Top 100',
        why: 'Ohne Platzierung gibt es keinen organischen Traffic – und ohne Top-10-Platzierung auch keine Antwortboxen.',
        action: 'Auf Keywords mit geringerem Wettbewerb ausweichen (Long-Tail, konkrete Fragestellungen) und dort erst eine Basis aufbauen.',
        effort: 'hoch',
        impact: 'hoch',
      })
    } else if (top10.length === 0 && ranked.length > 0) {
      findings.push({
        id: 'serp-page-two',
        severity: 'quickwin',
        title: `${ranked.length} Keywords platziert, aber keines in den Top 10`,
        why: 'Positionen 11–20 sind der grösste ungenutzte Hebel: die Seite ist bereits relevant, es fehlt wenig zur ersten Seite.',
        action: `Die bestplatzierten Seiten gezielt überarbeiten: Inhalt vertiefen, interne Links darauf setzen, Suchintention schärfen. Nächstliegend: ${ranked.sort((a, b) => (a.position ?? 99) - (b.position ?? 99)).slice(0, 3).map((p) => `"${p.keyword}" (Position ${p.position})`).join(', ')}.`,
        effort: 'mittel',
        impact: 'hoch',
      })
    }
    criteria.push({ key: 'positions', label: 'Platzierungen', score, weight: 40, detail, status: positions.length ? statusFor(score) : 'unknown' })
  }

  // --- SERP-Features: Wer besetzt die Antwortflächen? ----------------------
  {
    const allFeatures = positions.flatMap((p) => p.features)
    const uniqueFeatures = [...new Set(allFeatures)]
    const hasAiOverview = uniqueFeatures.includes('ai_overview')
    const ownsFeature = positions.some((p) => (p.position ?? 99) <= 3)

    const score = uniqueFeatures.length === 0 ? 5 : ownsFeature ? 7 : 3
    const detail = uniqueFeatures.length
      ? `Vorhandene SERP-Elemente: ${uniqueFeatures.join(', ')}.`
      : 'Keine besonderen SERP-Elemente erkannt.'

    if (hasAiOverview && !ownsFeature) {
      findings.push({
        id: 'serp-ai-overview',
        severity: 'critical',
        title: 'KI-Übersicht im Suchergebnis, eigene Seite nicht darin',
        why: 'Google beantwortet diese Suchanfragen bereits direkt oberhalb der Ergebnisse. Wer dort nicht vorkommt, verliert die Klicks unabhängig von der eigenen Position.',
        action: 'Inhalt so aufbereiten, dass er als Quelle taugt: klare Frage-Antwort-Blöcke, belegte Zahlen, FAQ-Schema – und parallel die organische Position in die Top 5 bringen.',
        effort: 'hoch',
        impact: 'hoch',
      })
    }
    criteria.push({ key: 'features', label: 'SERP-Elemente', score, weight: 25, detail, status: statusFor(score) })
  }

  // --- Sichtbarkeit insgesamt ----------------------------------------------
  {
    const organic = domainRank?.items?.[0]?.metrics?.organic
    if (!organic) {
      criteria.push({ key: 'visibility', label: 'Gesamtsichtbarkeit', score: 0, weight: 35, detail: 'Keine Domain-Kennzahlen verfügbar.', status: 'unknown' })
    } else {
      const totalTop10 = (organic.pos_1 ?? 0) + (organic.pos_2_3 ?? 0) + (organic.pos_4_10 ?? 0)
      const etv = Math.round(organic.etv ?? 0)
      const score = totalTop10 === 0 ? 1 : totalTop10 < 10 ? 3 : totalTop10 < 50 ? 5 : totalTop10 < 200 ? 7 : 9
      criteria.push({
        key: 'visibility',
        label: 'Gesamtsichtbarkeit',
        score,
        weight: 35,
        detail: `${organic.count ?? 0} Keywords in den Top 100, ${totalTop10} in den Top 10. Geschätzter organischer Traffic: ${etv}/Monat.`,
        status: statusFor(score),
      })
    }
  }

  const score = weightedScore(criteria)

  // Keywords auf Seite 2 sind der schnellste Hebel überhaupt.
  const striking = (rankedKeywords?.items ?? [])
    .map((i) => ({
      keyword: i.keyword_data?.keyword ?? '',
      position: i.ranked_serp_element?.serp_item?.rank_absolute ?? 999,
      volume: i.keyword_data?.keyword_info?.search_volume ?? 0,
      difficulty: i.keyword_data?.keyword_properties?.keyword_difficulty ?? null,
      url: i.ranked_serp_element?.serp_item?.url ?? null,
      intent: i.keyword_data?.search_intent_info?.main_intent ?? null,
    }))
    .filter((k) => k.position >= 11 && k.position <= 25 && k.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 15)

  if (striking.length > 0) {
    findings.push({
      id: 'serp-striking-distance',
      severity: 'quickwin',
      title: `${striking.length} Keywords knapp vor der ersten Seite`,
      why: 'Positionen 11–25 brauchen meist nur wenig Nacharbeit, um auf Seite 1 zu springen – deutlich weniger Aufwand als neue Inhalte.',
      action: `Diese Seiten zuerst überarbeiten: ${striking.slice(0, 5).map((k) => `"${k.keyword}" (Position ${k.position}, ${k.volume} Suchanfragen/Monat)`).join('; ')}.`,
      effort: 'mittel',
      impact: 'hoch',
    })
  }

  return {
    module: 'SERP',
    score,
    label: scoreLabel(score),
    criteria,
    findings,
    data: {
      positions,
      strikingDistance: striking,
      topKeywords: (rankedKeywords?.items ?? [])
        .slice(0, 25)
        .map((i) => ({
          keyword: i.keyword_data?.keyword ?? '',
          position: i.ranked_serp_element?.serp_item?.rank_absolute ?? null,
          volume: i.keyword_data?.keyword_info?.search_volume ?? 0,
          difficulty: i.keyword_data?.keyword_properties?.keyword_difficulty ?? null,
          intent: i.keyword_data?.search_intent_info?.main_intent ?? null,
          url: i.ranked_serp_element?.serp_item?.url ?? null,
        })),
      totalKeywords: rankedKeywords?.total_count ?? null,
    },
  }
}

/** Welche besonderen Elemente spielt Google in diesem Suchergebnis aus? */
function serpFeatures(items: SerpItem[]): string[] {
  const interesting = [
    'ai_overview', 'featured_snippet', 'people_also_ask', 'knowledge_graph',
    'local_pack', 'video', 'images', 'shopping', 'related_searches', 'top_stories',
  ]
  return [...new Set(items.map((i) => i.type).filter((t) => interesting.includes(t)))]
}

/**
 * "Nutzer fragen auch"-Fragen aus dem Suchergebnis ziehen.
 *
 * Gefiltert wird auf thematische Nähe zur Suchanfrage: Die Box enthält auch
 * Fragen aus angrenzenden Interessen, die eine völlig andere Absicht haben.
 * Wer ein Werkzeug verkauft, gewinnt nichts durch eine Frage danach, wo man
 * dessen Ergebnisse kostenlos ansehen kann – solche Antworten holen Publikum
 * statt Kundschaft.
 */
export function extractPeopleAlsoAsk(result: SerpResult | null): string[] {
  if (!result?.items) return []
  const paa = result.items.find((i) => i.type === 'people_also_ask')
  if (!paa?.items) return []

  const suchbegriff = (result.keyword ?? '').toLowerCase()
  const begriffe = suchbegriff
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)

  return paa.items
    .map((i) => i.title ?? i.seed_question ?? '')
    .filter(Boolean)
    .filter((frage) => {
      // Ohne verwertbare Begriffe im Suchbegriff nicht filtern.
      if (begriffe.length === 0) return true
      const klein = frage.toLowerCase()
      // Auf ganze Wörter prüfen: "live" darf nicht über "Livestreams"
      // treffen – das ist ein anderer Begriff mit anderer Absicht.
      return begriffe.some((b) => new RegExp(`\\b${b}\\b`, 'u').test(klein))
    })
    .slice(0, 10)
}

function sameDomain(a: string | undefined, b: string): boolean {
  if (!a) return false
  return a.replace(/^www\./, '').toLowerCase() === b.replace(/^www\./, '').toLowerCase()
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10))
