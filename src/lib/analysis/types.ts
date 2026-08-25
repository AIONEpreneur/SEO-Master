/**
 * Gemeinsame Ergebnisformen aller Analysebausteine.
 *
 * Bewertungsskala durchgängig 1–10, wie im SEO/AEO/GEO-Framework festgelegt.
 * Eine durchschnittliche Seite landet bei 4–6; 9 und 10 sind für wirklich
 * herausragende Seiten reserviert.
 */

export type Severity = 'critical' | 'quickwin' | 'longterm'

export type Finding = {
  id: string
  severity: Severity
  title: string
  /** Warum das zählt – in einem Satz, ohne Weichspüler. */
  why: string
  /** Konkret umsetzbar, nicht "sollte verbessert werden". */
  action: string
  effort: 'gering' | 'mittel' | 'hoch'
  impact: 'gering' | 'mittel' | 'hoch'
  evidence?: string
}

export type Criterion = {
  key: string
  label: string
  score: number
  weight: number
  detail: string
  status: 'ok' | 'warn' | 'fail' | 'unknown'
}

export type ModuleResult = {
  module: 'SEO' | 'AEO' | 'GEO' | 'SERP' | 'COMPETITORS' | 'SOCIAL'
  score: number
  label: string
  criteria: Criterion[]
  findings: Finding[]
  data: Record<string, unknown>
}

export type AnalysisResult = {
  target: { url: string; kind: 'WEBSITE' | 'SOCIAL_PROFILE'; domain: string | null }
  meta: {
    analyzedAt: string
    pageType: string | null
    language: string | null
    market: string
    modules: string[]
    providersUsed: string[]
    /** Bausteine, die mangels Zugangsdaten oder wegen Fehlern entfielen. */
    skipped: Array<{ module: string; reason: string }>
    /**
     * Wie viele Seiten der Lauf gelesen hat.
     *
     * Steht im Ergebnis, weil die Befunde sonst wie ein Urteil über die
     * gesamte Website gelesen werden. Ein Lauf über die Startseite kann
     * nicht wissen, was in fünfundzwanzig Blogartikeln steht.
     */
    scope: { pages: number; note: string }
    /** Das geprüfte Hauptkeyword und woher es stammt. */
    keyword: { value: string | null; source: 'vorgegeben' | 'abgeleitet' | 'keines' }
  }
  scores: {
    seo: number | null
    aeo: number | null
    geo: number | null
    serp: number | null
    overall: number | null
  }
  modules: ModuleResult[]
  /** Über alle Bausteine zusammengeführte Prioritätenliste. */
  priorities: Finding[]
  /**
   * Weitere gelesene Seiten der Website, schwächste zuerst. Jede wurde nach
   * denselben Regeln bewertet wie die Hauptseite – nur ohne die Markt-Daten
   * (Platzierungen, Backlinks), die je Domain einmal erhoben werden.
   */
  pages?: Array<{
    url: string
    titel: string | null
    scores: { seo: number; aeo: number; geo: number }
    schnitt: number
    befunde: Array<{ id: string; title: string; severity: Severity }>
  }>
  /** Befundarten, die auf mehreren gelesenen Seiten auftreten. */
  seitenMuster?: Array<{ id: string; bezeichnung: string; severity: Severity; laeufe: number }>
  executiveSummary: string | null
}

/** Gewichteter Durchschnitt über Kriterien; Kriterien ohne Datenlage zählen nicht. */
export function weightedScore(criteria: Criterion[]): number {
  const scored = criteria.filter((c) => c.status !== 'unknown')
  if (scored.length === 0) return 0
  const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0)
  if (totalWeight === 0) return 0
  const sum = scored.reduce((acc, c) => acc + c.score * c.weight, 0)
  return Math.round((sum / totalWeight) * 10) / 10
}

export function scoreLabel(score: number): string {
  if (score >= 8) return 'Stark'
  if (score >= 6.5) return 'Gut'
  if (score >= 5) return 'Ausbaufähig'
  if (score >= 3) return 'Schwach'
  return 'Kritisch'
}

export function statusFor(score: number): Criterion['status'] {
  if (score >= 7) return 'ok'
  if (score >= 4) return 'warn'
  return 'fail'
}
