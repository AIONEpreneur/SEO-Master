import type { PageSignals } from './extract'
import type { Criterion, Finding, ModuleResult } from './types'
import { weightedScore, scoreLabel, statusFor } from './types'
import type { SerpResult } from '@/lib/connectors/dataforseo'

/**
 * AEO-Bewertung nach dem Framework:
 *   Frage-Antwort-Struktur 30 % · Snippet-Formatierung 25 % ·
 *   FAQ-Schema 25 % · thematische Vollständigkeit 20 %
 */
export function analyzeAeo(input: {
  signals: PageSignals
  serp?: SerpResult | null
  /** "People also ask"-Fragen aus dem SERP – zeigt, was tatsächlich gefragt wird. */
  peopleAlsoAsk?: string[]
}): ModuleResult {
  const { signals: s } = input
  const findings: Finding[] = []
  const paa = input.peopleAlsoAsk ?? []
  const criteria: Criterion[] = []

  // --- Frage-Antwort-Struktur (30 %) ---------------------------------------
  {
    const questionCount = s.questionHeadings.length
    const faqCount = s.faqBlocks.length
    let score: number
    let detail: string

    if (questionCount === 0 && faqCount === 0) {
      score = 1
      detail = 'Keine Fragen in Überschriften, kein Fragenbereich.'
      findings.push({
        id: 'aeo-no-questions',
        severity: 'critical',
        title: 'Die Seite stellt keine Fragen',
        why: 'Answer Engines befüllen ihre Antwortboxen aus Inhalten, die eine Frage erkennbar stellen und direkt beantworten. Ohne Frage im Text gibt es keine Grundlage dafür.',
        action: paa.length
          ? `Mindestens 3 H2 als W-Frage formulieren. Aus dem aktuellen Suchergebnis tatsächlich gefragt: ${paa.slice(0, 4).map((q) => `"${q}"`).join(', ')}.`
          : 'Mindestens 3 H2 als W-Frage formulieren ("Was ist …", "Wie funktioniert …", "Warum …") und direkt im ersten Satz darunter beantworten.',
        effort: 'mittel',
        impact: 'hoch',
      })
    } else {
      score = clamp(Math.min(10, questionCount * 1.5 + faqCount * 0.8))
      detail = `${questionCount} Frage-Überschriften, ${faqCount} FAQ-Einträge.`
      if (questionCount < 3 && faqCount < 3) {
        findings.push({
          id: 'aeo-few-questions',
          severity: 'quickwin',
          title: `Nur ${questionCount + faqCount} Fragen im Inhalt`,
          why: 'Je mehr echte Suchfragen eine Seite abdeckt, desto mehr Antwortboxen kann sie besetzen.',
          action: paa.length
            ? `Diese tatsächlich gestellten Fragen ergänzen: ${paa.slice(0, 5).map((q) => `"${q}"`).join(', ')}.`
            : 'Auf 5–8 Fragen ausbauen, orientiert an den "Nutzer fragen auch"-Boxen der eigenen Hauptkeywords.',
          effort: 'mittel',
          impact: 'hoch',
        })
      }
    }
    criteria.push({ key: 'questions', label: 'Frage-Antwort-Struktur', score, weight: 30, detail, status: statusFor(score) })
  }

  // --- Snippet-taugliche Formatierung (25 %) -------------------------------
  {
    // Absatz-Snippets: kompakte Erklärblöcke von 40–60 Wörtern.
    const paragraphSnippets = countParagraphSnippets(s.text)
    const hasLists = s.lists.itemsTotal >= 5
    const hasTable = s.tables > 0
    const hasHowTo = s.schemaTypes.some((t) => /HowTo/i.test(t)) || s.lists.ordered > 0

    let score = 2
    if (paragraphSnippets > 0) score += 3
    if (hasLists) score += 2
    if (hasTable) score += 1.5
    if (hasHowTo) score += 1.5
    score = clamp(score)

    const parts = [
      `${paragraphSnippets} kompakte Erklärblöcke (40–60 Wörter)`,
      `${s.lists.itemsTotal} Listenpunkte`,
      `${s.tables} Tabellen`,
    ]
    if (paragraphSnippets === 0) {
      findings.push({
        id: 'aeo-no-paragraph-snippet',
        severity: 'quickwin',
        title: 'Keine snippet-tauglichen Erklärblöcke',
        why: 'Absatz-Snippets sind der häufigste Typ in Antwortboxen – sie brauchen eine geschlossene Erklärung von 40–60 Wörtern direkt unter der Frage.',
        action: 'Unter jede Frage-Überschrift einen Absatz mit 40–60 Wörtern setzen, der die Frage vollständig und für sich allein verständlich beantwortet.',
        effort: 'mittel',
        impact: 'hoch',
      })
    }
    if (!hasLists) {
      findings.push({
        id: 'aeo-no-lists',
        severity: 'quickwin',
        title: 'Keine strukturierten Listen',
        why: 'Listen-Snippets sind der zweithäufigste Antworttyp und lassen sich mit geringem Aufwand erzeugen.',
        action: 'Mindestens eine Liste mit 5–8 Punkten ergänzen, jeder Punkt 5–15 Wörter (z. B. Schritte, Vorteile, Kriterien).',
        effort: 'gering',
        impact: 'mittel',
      })
    }
    criteria.push({ key: 'formatting', label: 'Snippet-Formatierung', score, weight: 25, detail: parts.join(', ') + '.', status: statusFor(score) })
  }

  // --- FAQ-Schema (25 %) ----------------------------------------------------
  {
    const hasFaqSchema = s.schemaTypes.some((t) => /FAQPage/i.test(t))
    const faqCount = s.faqBlocks.length
    // Für Sprachassistenten zählt die Vorlesedauer, und die hängt an Wörtern,
    // nicht an Zeichen. Die frühere Zeichengrenze (300) liess deutsche
    // Antworten mit 43–47 Wörtern durchfallen, die mit ~330 Zeichen exakt im
    // empfohlenen Fenster von 40–60 Wörtern lagen – der Bericht widersprach
    // damit dem eigenen Massstab.
    const wortzahl = (text: string) => text.split(/\s+/).filter(Boolean).length
    const shortAnswers = s.faqBlocks.filter((f) => {
      const w = wortzahl(f.answer)
      return w >= 5 && w <= 80
    }).length

    let score: number
    let detail: string
    if (!hasFaqSchema && faqCount === 0) {
      score = 0
      detail = 'Weder FAQ-Bereich noch FAQPage-Schema.'
      findings.push({
        id: 'aeo-faq-missing',
        severity: 'critical',
        title: 'Kein FAQ-Bereich mit FAQPage-Schema',
        why: 'FAQPage-Schema ist der direkteste und am schnellsten umsetzbare Weg in Antwortboxen und Sprachantworten.',
        action: 'Fragenbereich mit 5–8 Fragen anlegen, Antworten je 40–60 Wörter, und als FAQPage-JSON-LD auszeichnen.',
        effort: 'mittel',
        impact: 'hoch',
      })
    } else if (!hasFaqSchema) {
      score = 4
      detail = `${faqCount} Fragen sichtbar, aber kein FAQPage-Schema.`
      findings.push({
        id: 'aeo-faq-schema-missing',
        severity: 'quickwin',
        title: 'FAQ vorhanden, aber nicht ausgezeichnet',
        why: 'Ohne Schema erkennt Google den Fragenbereich nur unzuverlässig – die Auszeichnung ist reine Fleissarbeit mit sofortiger Wirkung.',
        action: `Die bestehenden ${faqCount} Fragen als FAQPage-JSON-LD ergänzen.`,
        effort: 'gering',
        impact: 'hoch',
      })
    } else {
      score = clamp(5 + Math.min(faqCount, 8) * 0.4 + (shortAnswers >= 3 ? 1.5 : 0))
      detail = `FAQPage-Schema vorhanden, ${faqCount} Fragen, davon ${shortAnswers} in vorlesbarer Länge (bis 80 Wörter).`
      if (faqCount < 5) {
        findings.push({
          id: 'aeo-faq-few',
          severity: 'quickwin',
          title: `Nur ${faqCount} Fragen im FAQ-Schema`,
          why: 'Mit 5–8 Fragen deckt die Seite ein Themenfeld ab statt nur einen Einzelaspekt.',
          action: 'Auf mindestens 5 Fragen erweitern.',
          effort: 'gering',
          impact: 'mittel',
        })
      }
    }
    criteria.push({ key: 'faqSchema', label: 'FAQ-Schema', score, weight: 25, detail, status: statusFor(score) })
  }

  // --- Thematische Vollständigkeit (20 %) ----------------------------------
  {
    const coverage = s.h2.length + s.h3.length
    const answeredPaa = paa.filter((q) =>
      s.text.toLowerCase().includes(q.toLowerCase().slice(0, 25)),
    ).length

    let score = coverage === 0 ? 2 : coverage < 4 ? 4 : coverage < 8 ? 6 : 8
    if (s.wordCount < 500) score = clamp(score - 2)
    if (paa.length > 0) {
      const ratio = answeredPaa / paa.length
      score = clamp(score * 0.6 + ratio * 10 * 0.4)
    }
    const detail =
      paa.length > 0
        ? `${coverage} Unterthemen; ${answeredPaa} von ${paa.length} tatsächlich gestellten Folgefragen behandelt.`
        : `${coverage} Unterthemen bei ${s.wordCount} Wörtern.`

    if (paa.length > 0 && answeredPaa < paa.length / 2) {
      findings.push({
        id: 'aeo-paa-gap',
        severity: 'quickwin',
        title: `${paa.length - answeredPaa} häufige Folgefragen unbeantwortet`,
        why: 'Die "Nutzer fragen auch"-Box zeigt, was das Publikum wirklich wissen will – jede unbeantwortete Frage ist eine verschenkte Platzierung.',
        action: `Diese Fragen im Inhalt aufgreifen: ${paa.filter((q) => !s.text.toLowerCase().includes(q.toLowerCase().slice(0, 25))).slice(0, 5).map((q) => `"${q}"`).join(', ')}.`,
        effort: 'mittel',
        impact: 'hoch',
      })
    }
    criteria.push({ key: 'coverage', label: 'Thematische Vollständigkeit', score, weight: 20, detail, status: statusFor(score) })
  }

  const score = weightedScore(criteria)

  // Struktur steht, klassisches Ranking noch nicht. Das ist ein Hinweis auf
  // eine Chance, keine Vertagung: KI-Übersichten und Sprachmodelle zitieren
  // regelmässig Quellen, die organisch nicht auf Seite eins stehen. Die
  // frühere Fassung dieses Befundes riet, erst das SEO-Fundament zu bauen –
  // das war fachlich überholt und stand im Widerspruch zu der Regel, die dem
  // Berichtstext vorgegeben wird.
  const ranksTop10 = input.serp?.items?.some(
    (i) => i.type === 'organic' && (i.rank_group ?? 99) <= 10 && matchesTarget(i.domain, s.url),
  )
  if (ranksTop10 === false && score >= 6) {
    findings.push({
      id: 'aeo-no-ranking',
      severity: 'quickwin',
      title: 'Gute AEO-Struktur, klassisches Ranking noch offen',
      why: 'Die Antwortstruktur steht, eine Top-10-Platzierung für den geprüften Begriff gibt es noch nicht. Beides hängt weniger zusammen als früher: KI-Übersichten und Sprachmodelle zitieren regelmässig Quellen, die organisch nicht auf Seite eins stehen. Der Weg über die Antwort ist hier der kürzere.',
      action: 'Die vorhandene Struktur auf weitere konkrete Fragen ausdehnen – je präziser die Frage, desto eher wird die Antwort zitiert, unabhängig vom Ranking. Das klassische Ranking parallel aufbauen, nicht davor.',
      effort: 'mittel',
      impact: 'hoch',
    })
  }

  return {
    module: 'AEO',
    score,
    label: scoreLabel(score),
    criteria,
    findings,
    data: {
      questionHeadings: s.questionHeadings,
      faqBlocks: s.faqBlocks,
      peopleAlsoAsk: paa,
      snippetPotential: score >= 8 ? 'Hoch' : score >= 5 ? 'Mittel' : 'Niedrig',
    },
  }
}

/**
 * Absätze zählen, die als Antwort-Snippet taugen: 40–60 Wörter, in sich
 * abgeschlossen. Kürzere Blöcke tragen zu wenig, längere werden abgeschnitten.
 */
function countParagraphSnippets(text: string): number {
  const paragraphs = text.split(/(?<=[.!?])\s{2,}|\n+/)
  return paragraphs.filter((p) => {
    const words = p.trim().split(/\s+/).length
    return words >= 35 && words <= 75
  }).length
}

function matchesTarget(domain: string | undefined, url: string): boolean {
  if (!domain) return false
  try {
    return new URL(url).hostname.replace(/^www\./, '') === domain.replace(/^www\./, '')
  } catch {
    return false
  }
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10))
