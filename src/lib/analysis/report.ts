import Anthropic from '@anthropic-ai/sdk'
import type { AnalysisResult, Finding, ModuleResult } from './types'

/**
 * Berichtserstellung.
 *
 * Zwei Wege: Wenn ein Anthropic-Schlüssel hinterlegt ist, formuliert Claude
 * aus den gemessenen Werten einen Bericht in der Tonalität des bestehenden
 * Analyse-Workflows. Ohne Schlüssel entsteht derselbe Bericht deterministisch
 * aus den Daten – ohne die einordnenden Passagen, aber vollständig.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `Du bist eine erfahrene Digital-Strategin mit Spezialisierung auf SEO, AEO (Answer Engine Optimization) und GEO (Generative Engine Optimization).

Deine Haltung:
- Du analysierst präzise, direkt und ohne Marketing-Floskeln.
- Kein "guter Ansatz!" — sondern: Was funktioniert, was nicht, was als Nächstes zu tun ist.
- Du bewertest realistisch, nicht optimistisch. Eine mittelmässige Seite ist mittelmässig.
- Empfehlungen sind immer konkret: nicht "Meta Description verbessern", sondern der fertige Vorschlagstext.
- Du schreibst auf Deutsch, in der Sie-Form der Leserin gegenüber neutral gehalten (direkte Ansprache vermeiden, sachlich formulieren).

Wichtig: Die Messwerte sind bereits erhoben und stehen fest. Du bewertest sie und ordnest sie ein — du erfindest keine Zahlen, keine Rankings und keine Befunde hinzu. Wenn Daten fehlen, benennst du die Lücke.

Fachliche Festlegungen, die du nicht überschreiben darfst:
- AEO und GEO setzen KEINE Top-10-Platzierung voraus. KI-Übersichten und Sprachmodelle zitieren regelmässig Quellen, die organisch nicht auf Seite eins stehen. Für eine junge oder schwach verlinkte Domain sind AEO und GEO deshalb der schnellere Weg als klassisches Ranking — schreibe nie, das eine lohne sich erst nach dem anderen.
- Der Lauf hat genau die Seiten gelesen, die unter meta.scope stehen. Formuliere Befunde entsprechend: "auf dieser Seite", nicht "auf der Website". Was auf anderen Seiten der Domain steht, ist unbekannt und darf weder gelobt noch bemängelt werden.
- Steht unter meta.keyword die Quelle "abgeleitet", war kein Keyword vorgegeben und die Analyse hat es aus der Seite geraten. Weise im Bericht einmal darauf hin, dass Platzierungswerte zu diesem Begriff entsprechend zu lesen sind.
- Ein Spam-Score im Verweisprofil ist ein Mittelwert. Bei wenigen verweisenden Domains ist er nicht belastbar. Empfiehl in diesem Fall ausdrücklich, nichts zu tun — kein Disavow.`

/**
 * Wie das Hauptkeyword im Berichtskopf erscheint.
 *
 * Die Herkunft steht dabei: Ein abgeleiteter Begriff ist eine Vermutung der
 * Analyse, kein Auftrag der Nutzerin — und Platzierungswerte dazu sind
 * entsprechend zu lesen.
 */
function keywordZeile(result: AnalysisResult): string {
  const { value, source } = result.meta.keyword
  if (!value) return 'keines bestimmbar — bitte beim nächsten Lauf eigene Keywords angeben'
  if (source === 'abgeleitet') return `"${value}" (aus der Seite abgeleitet, nicht vorgegeben)`
  return `"${value}"`
}

export async function generateReport(
  result: AnalysisResult,
  apiKey: string | null,
): Promise<{ markdown: string; summary: string }> {
  const deterministic = buildDeterministicReport(result)

  if (!apiKey) {
    return {
      markdown: deterministic,
      summary: buildFallbackSummary(result),
    }
  }

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Hier sind die vollständigen Messdaten einer Sichtbarkeitsanalyse. Erstelle daraus den Analysebericht.

## Messdaten

${JSON.stringify(compactForPrompt(result), null, 2)}

## Auftrag

Schreibe den Bericht in Markdown, mit genau dieser Gliederung:

# Sichtbarkeitsanalyse: ${result.target.url}

**Analysiert am:** ${new Date(result.meta.analyzedAt).toLocaleDateString('de-DE')}
**Seitentyp:** (aus den Daten ableiten)
**Markt:** ${result.meta.market}
**Analyse-Umfang:** ${result.meta.scope.pages === 1 ? '1 Seite' : `${result.meta.scope.pages} Seiten`} — ${result.meta.scope.note}
**Geprüftes Hauptkeyword:** ${keywordZeile(result)}

## Kurzfazit
2–4 Sätze: aktueller Stand, die ein bis zwei grössten Hebel. Direkt, ohne Weichspüler.

## Gesamtbewertung
Eine Tabelle mit den Bewertungen je Disziplin und einer knappen Einordnung in einem Wort.

## Seitenübersicht
Nur wenn das Ergebnis unter "pages" weitere Seiten enthält: eine Tabelle (Pfad, SEO, AEO, GEO, grösste Baustelle), schwächste zuerst, danach die Muster aus "seitenMuster" als das, was sich durch die Website zieht – eine Ursache, einmal beheben. Ohne "pages" entfällt der Abschnitt ersatzlos.

## Befunde je Disziplin
Für jede vorliegende Disziplin ein Abschnitt: was gemessen wurde, was das bedeutet. Nutze die Kriterienwerte, erfinde nichts dazu.

## Sofortmassnahmen
Nur, was aktiv schadet. Je Punkt: Massnahme → warum kritisch → konkrete Lösung. Maximal 5.

## Schnelle Hebel
Geringer Aufwand, spürbare Wirkung. Maximal 6.

## Langfristig
Strategische Massnahmen. Maximal 5.

## Prioritäten
Tabelle: Massnahme | Aufwand | Wirkung | Priorität

## Die nächsten drei Schritte
Nummeriert, mit Angabe was genau zu tun ist.

Umfang: 900–1400 Wörter. Qualität vor Länge. Antworte ausschliesslich mit dem Markdown-Bericht, ohne Vorrede.`,
        },
      ],
    })

    const markdown = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim()

    if (!markdown) throw new Error('Leere Antwort')

    return { markdown, summary: extractSummary(markdown) }
  } catch (error) {
    // Der Bericht ist das Ergebnis des Laufs – ein Ausfall beim Formulieren
    // darf ihn nicht wertlos machen. Die Messdaten sind vollständig vorhanden.
    return {
      markdown:
        deterministic +
        `\n\n---\n\n_Hinweis: Die sprachliche Ausarbeitung war nicht möglich (${
          error instanceof Error ? error.message : 'unbekannter Fehler'
        }). Der Bericht enthält alle Messwerte, aber keine ausformulierte Einordnung._\n`,
      summary: buildFallbackSummary(result),
    }
  }
}

/**
 * Für den Prompt auf das Wesentliche reduzieren: Rohantworten der Anbieter
 * enthalten Hunderte Felder, die für die Bewertung nichts beitragen.
 */
function compactForPrompt(result: AnalysisResult) {
  return {
    ziel: result.target,
    kontext: result.meta,
    bewertungen: result.scores,
    disziplinen: result.modules.map((m) => ({
      disziplin: m.module,
      bewertung: m.score,
      einordnung: m.label,
      kriterien: m.criteria.map((c) => ({
        kriterium: c.label,
        wert: c.score,
        gewicht: c.weight,
        befund: c.detail,
        status: c.status,
      })),
      kennzahlen: trimData(m),
    })),
    befunde: result.priorities.map((f) => ({
      dringlichkeit: f.severity,
      titel: f.title,
      begruendung: f.why,
      massnahme: f.action,
      aufwand: f.effort,
      wirkung: f.impact,
    })),
  }
}

function trimData(m: ModuleResult): Record<string, unknown> {
  const data = { ...m.data }
  // Rohlisten kürzen, damit der Prompt handhabbar bleibt.
  for (const key of ['positions', 'topKeywords', 'keywordGaps', 'strikingDistance', 'recentPosts']) {
    const value = data[key]
    if (Array.isArray(value)) data[key] = value.slice(0, 10)
  }
  return data
}

/** Vollständiger Bericht ohne Sprachmodell – aus den Messwerten gebaut. */
export function buildDeterministicReport(result: AnalysisResult): string {
  const lines: string[] = []
  const date = new Date(result.meta.analyzedAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  lines.push(`# Sichtbarkeitsanalyse: ${result.target.url}`, '')
  lines.push(`**Analysiert am:** ${date}`)
  lines.push(`**Art:** ${result.target.kind === 'WEBSITE' ? 'Website' : 'Social-Media-Profil'}`)
  lines.push(`**Markt:** ${result.meta.market}`)
  lines.push(`**Bausteine:** ${result.meta.modules.join(', ')}`)
  // Der Umfang steht vor den Befunden, nicht in einer Fussnote: Wer die
  // Bewertung liest, muss wissen, worüber sie überhaupt eine Aussage macht.
  lines.push(
    `**Analyse-Umfang:** ${result.meta.scope.pages === 1 ? '1 Seite' : `${result.meta.scope.pages} Seiten`} — ${result.meta.scope.note}`,
  )
  lines.push(`**Geprüftes Hauptkeyword:** ${keywordZeile(result)}`)
  lines.push(
    `**Datenquellen:** ${
      result.meta.providersUsed.length
        ? result.meta.providersUsed.join(', ')
        : 'keine – bewertet wurde allein der abgerufene Seiteninhalt'
    }`,
  )
  if (result.meta.skipped.length) {
    lines.push(`**Nicht ausgeführt:** ${result.meta.skipped.map((s) => `${s.module} (${s.reason})`).join(', ')}`)
  }
  lines.push('')

  lines.push('## Gesamtbewertung', '')
  lines.push('| Disziplin | Bewertung | Einordnung |')
  lines.push('|---|---|---|')
  for (const m of result.modules) {
    lines.push(`| ${moduleName(m.module)} | ${m.score.toFixed(1)}/10 | ${m.label} |`)
  }
  if (result.scores.overall !== null) {
    lines.push(`| **Gesamt** | **${result.scores.overall.toFixed(1)}/10** | |`)
  }
  lines.push('')

  if (result.pages && result.pages.length > 0) {
    lines.push('## Seitenübersicht', '')
    lines.push(
      'Jede weitere Seite wurde nach denselben Regeln bewertet wie die Hauptseite – ohne die Markt-Daten, die je Domain einmal erhoben werden. Schwächste zuerst.',
      '',
    )
    lines.push('| Seite | SEO | AEO | GEO | Grösste Baustelle |')
    lines.push('|---|---|---|---|---|')
    for (const seite of result.pages) {
      const pfad = seite.url.replace(/^https?:\/\/[^/]+/, '') || '/'
      lines.push(
        `| ${pfad} | ${seite.scores.seo.toFixed(1)} | ${seite.scores.aeo.toFixed(1)} | ${seite.scores.geo.toFixed(1)} | ${seite.befunde[0]?.title ?? '–'} |`,
      )
    }
    lines.push('')

    if (result.seitenMuster && result.seitenMuster.length > 0) {
      lines.push('### Was sich durch die Website zieht', '')
      lines.push(
        'Diese Befundarten treten auf mehreren Seiten auf. Sie haben eine gemeinsame Ursache (Vorlage, Arbeitsweise) und lassen sich einmal für alle Seiten beheben:',
        '',
      )
      for (const muster of result.seitenMuster) {
        lines.push(`- ${muster.bezeichnung} — auf ${muster.laeufe} von ${result.pages.length} Seiten`)
      }
      lines.push('')
    }
  }

  for (const m of result.modules) {
    lines.push(`## ${moduleName(m.module)} — ${m.score.toFixed(1)}/10`, '')
    lines.push('| Kriterium | Bewertung | Befund |')
    lines.push('|---|---|---|')
    for (const c of m.criteria) {
      const value = c.status === 'unknown' ? '–' : `${c.score.toFixed(1)}/10`
      lines.push(`| ${c.label} | ${value} | ${c.detail || '–'} |`)
    }
    lines.push('')
  }

  const groups: Array<[Finding['severity'], string]> = [
    ['critical', 'Sofortmassnahmen'],
    ['quickwin', 'Schnelle Hebel'],
    ['longterm', 'Langfristig'],
  ]

  for (const [severity, heading] of groups) {
    const items = result.priorities.filter((f) => f.severity === severity)
    if (items.length === 0) continue
    lines.push(`## ${heading}`, '')
    items.forEach((f, index) => {
      lines.push(`### ${index + 1}. ${f.title}`, '')
      lines.push(`**Warum das zählt:** ${f.why}`, '')
      lines.push(`**Zu tun:** ${f.action}`, '')
      lines.push(`_Aufwand: ${f.effort} · Wirkung: ${f.impact}_`, '')
    })
  }

  if (result.priorities.length) {
    lines.push('## Prioritäten', '')
    lines.push('| Massnahme | Aufwand | Wirkung | Priorität |')
    lines.push('|---|---|---|---|')
    for (const f of result.priorities.slice(0, 15)) {
      const priority = f.severity === 'critical' ? 'Sofort' : f.severity === 'quickwin' ? 'Bald' : 'Langfristig'
      lines.push(`| ${f.title} | ${f.effort} | ${f.impact} | ${priority} |`)
    }
    lines.push('')
  }

  const nextThree = [...result.priorities]
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 3)
  if (nextThree.length) {
    lines.push('## Die nächsten drei Schritte', '')
    nextThree.forEach((f, i) => lines.push(`${i + 1}. **${f.title}** — ${f.action}`))
    lines.push('')
  }

  return lines.join('\n')
}

/** Sortierschlüssel: kritisch zuerst, dann nach Wirkung und Aufwand. */
function rank(f: Finding): number {
  const severity = f.severity === 'critical' ? 100 : f.severity === 'quickwin' ? 50 : 10
  const impact = f.impact === 'hoch' ? 20 : f.impact === 'mittel' ? 10 : 0
  const effort = f.effort === 'gering' ? 10 : f.effort === 'mittel' ? 5 : 0
  return severity + impact + effort
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => rank(b) - rank(a))
}

function buildFallbackSummary(result: AnalysisResult): string {
  const critical = result.priorities.filter((f) => f.severity === 'critical').length
  const overall = result.scores.overall
  const parts: string[] = []
  if (overall !== null) parts.push(`Gesamtbewertung ${overall.toFixed(1)}/10`)
  if (critical > 0) parts.push(`${critical} Sofortmassnahme${critical === 1 ? '' : 'n'}`)
  const quick = result.priorities.filter((f) => f.severity === 'quickwin').length
  if (quick > 0) parts.push(`${quick} schnelle Hebel`)
  return parts.join(' · ') || 'Analyse abgeschlossen.'
}

function extractSummary(markdown: string): string {
  const match = markdown.match(/##\s*Kurzfazit\s*\n+([\s\S]*?)(?=\n##\s|$)/i)
  const text = (match?.[1] ?? markdown).replace(/[#*_`>|-]/g, ' ').replace(/\s+/g, ' ').trim()
  return text.slice(0, 500)
}

function moduleName(module: ModuleResult['module']): string {
  switch (module) {
    case 'SEO':
      return 'SEO'
    case 'AEO':
      return 'AEO — Answer Engine Optimization'
    case 'GEO':
      return 'GEO — Generative Engine Optimization'
    case 'SERP':
      return 'SERP & Rankings'
    case 'COMPETITORS':
      return 'Wettbewerb'
    case 'SOCIAL':
      return 'Social-Profil'
  }
}
