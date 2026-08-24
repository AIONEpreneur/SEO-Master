import type { PageSignals } from './extract'
import type { Criterion, Finding, ModuleResult } from './types'
import { weightedScore, scoreLabel, statusFor } from './types'
import type { BacklinksSummaryResult, LlmTopDomainsResult } from '@/lib/connectors/dataforseo'

/**
 * GEO-Bewertung nach dem Framework:
 *   Autorität & Trust 25 % · Tiefe & Einzigartigkeit 30 % ·
 *   Zitierbarkeit 25 % · Crawlbarkeit & Aktualität 20 %
 */
export function analyzeGeo(input: {
  signals: PageSignals
  backlinks?: BacklinksSummaryResult | null
  /** Domains, die LLMs zum Thema tatsächlich nennen. */
  llmMentions?: LlmTopDomainsResult | null
  robotsTxt?: { content: string | null; blocksAiCrawlers: string[] } | null
  hasSitemap?: boolean | null
}): ModuleResult {
  const { signals: s, backlinks, llmMentions, robotsTxt } = input
  const findings: Finding[] = []
  const criteria: Criterion[] = []

  // --- Autorität & Trust (25 %) --------------------------------------------
  {
    const domain = safeDomain(s.url)
    const mentionEntry = llmMentions?.items?.find((i) => i.domain?.replace(/^www\./, '') === domain)
    const refDomains = backlinks?.referring_main_domains ?? backlinks?.referring_domains ?? null

    const signals = [
      s.hasAuthorInfo,
      s.hasImprint,
      s.hasPrivacyPolicy,
      s.isHttps,
      s.citationsToAuthority > 0,
      s.schemaTypes.some((t) => /Person|Organization/i.test(t)),
    ]
    let score = clamp(signals.filter(Boolean).length * 1.4)

    if (refDomains !== null) {
      // Verweisende Domains sind für GEO ein sehr starkes Signal – KI-Systeme
      // nennen bevorzugt Quellen, die im Netz oft erwähnt werden.
      const linkScore = refDomains === 0 ? 0 : refDomains < 10 ? 2 : refDomains < 50 ? 4 : refDomains < 200 ? 7 : 9
      score = clamp(score * 0.6 + linkScore * 0.4)
    }

    let detail = `${signals.filter(Boolean).length} von 6 Vertrauenssignalen`
    if (refDomains !== null) detail += `, ${refDomains} verweisende Domains`
    if (mentionEntry) {
      detail += `. In LLM-Antworten zum Thema: ${mentionEntry.mentions ?? 0} Erwähnungen.`
      score = clamp(score + 1.5)
    } else if (llmMentions && !llmMentions.items?.length) {
      // Eine leere Liste ist kein Fehler, sondern eine Aussage: Zu diesem
      // Thema hat sich noch keine Quelle etabliert. Wer zuerst zitierfähig
      // wird, besetzt die Stelle – das ist eine Gelegenheit, kein Mangel.
      detail += '. Zu diesem Thema nennen die Sprachmodelle bislang keine feste Quelle.'
      findings.push({
        id: 'geo-offenes-feld',
        severity: 'longterm',
        title: 'Zum eigenen Thema hat sich in KI-Antworten noch keine Quelle etabliert',
        why: 'Die Sprachmodelle greifen hier auf keine wiederkehrende Domain zurück. Das Feld ist offen – wer zuerst zitierfähig wird, besetzt es, ohne sich gegen eingeführte Quellen durchsetzen zu müssen.',
        action: 'Zum Kernthema eine Seite anlegen, die als Nachschlagewerk taugt: klare Definitionen, eigene Zahlen mit Quellenangabe, Fragen und Antworten in geschlossenen Abschnitten. Danach Erwähnungen dort aufbauen, wo KI-Systeme lesen.',
        effort: 'hoch',
        impact: 'hoch',
      })
    } else if (llmMentions?.items?.length) {
      detail += `. Kommt in LLM-Antworten zum Thema nicht vor – dort dominieren: ${llmMentions.items.slice(0, 3).map((i) => i.domain).join(', ')}.`
      findings.push({
        id: 'geo-no-llm-mentions',
        severity: 'longterm',
        title: 'Domain wird von KI-Systemen zum eigenen Thema nicht genannt',
        why: `Bei den relevanten Fragen nennen die Sprachmodelle andere Quellen (${llmMentions.items.slice(0, 3).map((i) => i.domain).join(', ')}). Wer dort nicht auftaucht, ist für KI-gestützte Recherche unsichtbar.`,
        action: 'Erwähnungen dort aufbauen, wo KI-Systeme lesen: Fachportale, Branchenverzeichnisse, Gastbeiträge, Podcasts, Wikipedia-fähige Belege. Parallel eigene Daten veröffentlichen, die zitierfähig sind.',
        effort: 'hoch',
        impact: 'hoch',
      })
    } else {
      detail += '.'
    }

    if (!s.schemaTypes.some((t) => /Person|Organization/i.test(t))) {
      findings.push({
        id: 'geo-no-entity',
        severity: 'quickwin',
        title: 'Keine maschinenlesbare Identität',
        why: 'KI-Systeme arbeiten mit Entitäten. Ohne Person- oder Organization-Schema mit `sameAs`-Verweisen lässt sich die Marke nicht eindeutig zuordnen.',
        action: 'JSON-LD `Person` (oder `Organization`) ergänzen: Name, Berufsbezeichnung, Beschreibung als "Expertin für …", `sameAs` mit LinkedIn, Instagram und weiteren Profilen.',
        effort: 'gering',
        impact: 'hoch',
      })
    }

    criteria.push({ key: 'authority', label: 'Autorität & Trust', score, weight: 25, detail, status: statusFor(score) })
  }

  // --- Inhaltliche Tiefe & Einzigartigkeit (30 %) --------------------------
  {
    let score = 2
    if (s.wordCount >= 600) score += 2
    if (s.wordCount >= 1200) score += 1
    if (s.statistics.length >= 3) score += 2
    if (s.h2.length >= 4) score += 1
    if (s.citationsToAuthority > 0) score += 1
    if (s.definitions.length >= 3) score += 1
    score = clamp(score)

    const detail = `${s.wordCount} Wörter, ${s.statistics.length} Aussagen mit konkreten Zahlen, ${s.definitions.length} Definitionssätze, ${s.citationsToAuthority} Verweise auf Autoritätsquellen.`

    if (s.statistics.length === 0) {
      findings.push({
        id: 'geo-no-data',
        severity: 'quickwin',
        title: 'Keine belegten Zahlen im Inhalt',
        why: 'Sprachmodelle zitieren bevorzugt Quellen mit konkreten, überprüfbaren Zahlen. Reine Behauptungen werden übergangen.',
        action: 'Mindestens 3 konkrete Zahlen einbauen – eigene Erhebungen, Kundenergebnisse oder belegte Marktdaten mit Quellenangabe. Eigene Daten wirken hier am stärksten, weil sie sonst nirgends stehen.',
        effort: 'mittel',
        impact: 'hoch',
      })
    }
    criteria.push({ key: 'depth', label: 'Tiefe & Einzigartigkeit', score, weight: 30, detail, status: statusFor(score) })
  }

  // --- Zitierbarkeit (25 %) -------------------------------------------------
  {
    const quotable = s.definitions.length + s.statistics.length
    const hasLists = s.lists.itemsTotal >= 5
    let score = clamp(quotable * 0.7 + (hasLists ? 2 : 0) + (s.tables > 0 ? 1 : 0))

    const detail = `${quotable} zitierfähige Textstellen (${s.definitions.length} Definitionen, ${s.statistics.length} Zahlenaussagen), ${s.lists.itemsTotal} Listenpunkte.`

    if (s.definitions.length === 0) {
      findings.push({
        id: 'geo-no-definitions',
        severity: 'quickwin',
        title: 'Keine klaren Definitionssätze',
        why: 'KI-Systeme übernehmen bevorzugt Sätze, die einen Begriff in sich abgeschlossen erklären – sie lassen sich ohne Kontext zitieren.',
        action: 'Je Kernbegriff einen Satz im Muster "[Begriff] bezeichnet [präzise Erklärung]." einbauen, direkt unter der jeweiligen Überschrift.',
        effort: 'gering',
        impact: 'hoch',
      })
    }
    criteria.push({ key: 'quotability', label: 'Zitierbarkeit', score, weight: 25, detail, status: statusFor(score) })
  }

  // --- Crawlbarkeit & Aktualität (20 %) ------------------------------------
  {
    let score = 5
    const notes: string[] = []

    const noindex = s.robotsMeta?.toLowerCase().includes('noindex') ?? false
    if (noindex) {
      score = 0
      notes.push('noindex gesetzt')
      findings.push({
        id: 'geo-noindex',
        severity: 'critical',
        title: 'Seite ist auf noindex gesetzt',
        why: 'Die Seite wird aus dem Index ausgeschlossen – weder Google noch KI-Systeme berücksichtigen sie.',
        action: 'Das `noindex` im Robots-Meta-Tag entfernen, sofern es nicht beabsichtigt ist.',
        effort: 'gering',
        impact: 'hoch',
      })
    } else {
      score += 2
    }

    if (s.jsDependency === 'hoch') {
      score -= 3
      notes.push('Inhalt stark von JavaScript abhängig')
      findings.push({
        id: 'geo-js-dependency',
        severity: 'critical',
        title: 'Inhalt entsteht erst durch JavaScript',
        why: 'Die meisten KI-Crawler führen kein JavaScript aus. Sie sehen eine praktisch leere Seite – unabhängig davon, wie gut der Inhalt ist.',
        action: 'Serverseitiges Rendern oder statische Vorab-Erzeugung einsetzen, damit die Kerninhalte bereits im ausgelieferten HTML stehen.',
        effort: 'hoch',
        impact: 'hoch',
      })
    } else if (s.jsDependency === 'gering') {
      score += 1
    }

    if (robotsTxt?.blocksAiCrawlers.length) {
      score -= 2
      notes.push(`robots.txt sperrt ${robotsTxt.blocksAiCrawlers.join(', ')}`)
      findings.push({
        id: 'geo-ai-blocked',
        severity: 'critical',
        title: `robots.txt sperrt KI-Crawler aus (${robotsTxt.blocksAiCrawlers.join(', ')})`,
        why: 'Diese Crawler versorgen ChatGPT, Perplexity und vergleichbare Systeme mit Inhalten. Wer sie sperrt, kann dort nicht erscheinen.',
        action: `In der robots.txt die Sperre für ${robotsTxt.blocksAiCrawlers.join(', ')} aufheben – sofern das Aussperren nicht bewusst gewollt ist.`,
        effort: 'gering',
        impact: 'hoch',
      })
    }

    const freshness = s.modifiedDate ?? s.publishedDate
    if (freshness) {
      const months = (Date.now() - new Date(freshness).getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (months < 6) score += 2
      else if (months > 24) score -= 1
      notes.push(`zuletzt aktualisiert ${new Date(freshness).toLocaleDateString('de-DE')}`)
    } else {
      score -= 1
      notes.push('kein sichtbares Datum')
      findings.push({
        id: 'geo-no-date',
        severity: 'quickwin',
        title: 'Kein sichtbares Aktualisierungsdatum',
        why: 'Echtzeit-KI-Systeme gewichten Aktualität stark. Ohne Datum lässt sich die Aktualität nicht beurteilen.',
        action: 'Sichtbares "Zuletzt aktualisiert"-Datum ergänzen und zusätzlich als `dateModified` im Schema auszeichnen.',
        effort: 'gering',
        impact: 'mittel',
      })
    }

    score = clamp(score)
    criteria.push({
      key: 'crawlability',
      label: 'Crawlbarkeit & Aktualität',
      score,
      weight: 20,
      detail: notes.join(', ') + '.',
      status: statusFor(score),
    })
  }

  const score = weightedScore(criteria)

  return {
    module: 'GEO',
    score,
    label: scoreLabel(score),
    criteria,
    findings,
    data: {
      visibility: score >= 8 ? 'Stark' : score >= 5 ? 'Im Aufbau' : 'Gering',
      quotableStatements: s.statistics.slice(0, 5),
      definitions: s.definitions.slice(0, 5),
      llmTopDomains: llmMentions?.items?.slice(0, 10) ?? [],
      jsDependency: s.jsDependency,
      aiCrawlersBlocked: robotsTxt?.blocksAiCrawlers ?? [],
    },
  }
}

/** Die Crawler, über die KI-Systeme heute Inhalte beziehen. */
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'Bytespider',
  'Applebot-Extended',
]

/**
 * robots.txt auswerten: welche KI-Crawler sind gesperrt?
 * Bewertet wird nur eine vollständige Sperre (`Disallow: /`) – Teilsperren
 * einzelner Pfade sind meist beabsichtigt und kein Befund.
 */
export function parseRobots(content: string | null): { content: string | null; blocksAiCrawlers: string[] } {
  if (!content) return { content: null, blocksAiCrawlers: [] }

  const blocked: string[] = []
  const groups = content.split(/\n(?=\s*user-agent:)/i)

  for (const group of groups) {
    const agents = [...group.matchAll(/user-agent:\s*(.+)/gi)].map((m) => m[1].trim())
    const disallowsRoot = /^\s*disallow:\s*\/\s*$/im.test(group)
    if (!disallowsRoot) continue
    for (const agent of agents) {
      const match = AI_CRAWLERS.find((c) => c.toLowerCase() === agent.toLowerCase())
      if (match) blocked.push(match)
      // Ein pauschales "*" mit Disallow: / sperrt auch alle KI-Crawler aus.
      if (agent === '*') blocked.push('alle Crawler (User-agent: *)')
    }
  }

  return { content, blocksAiCrawlers: [...new Set(blocked)] }
}

function safeDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10))
