import { db } from '@/lib/db'
import { wiederkehrendeBefunde } from '@/lib/analysis/wiederkehrend'

/**
 * Auswertung für die Betriebsübersicht.
 *
 * Bewusst anonym: Welche Adresse jemand geprüft und welche Suchbegriffe er
 * eingegeben hat, taucht hier nirgends auf. Gezählt werden Vorgänge, nicht
 * Inhalte. Wer eine einzelne Analyse einsehen will, braucht Zugriff auf den
 * betreffenden Arbeitsbereich – nicht auf diese Seite.
 */

/**
 * Zeitersparnis je Analyse in Minuten.
 *
 * Das ist eine Annahme, keine Messung – und wird in der Oberfläche auch so
 * benannt. Grundlage: Die Befunde einer Analyse von Hand zusammenzutragen
 * bedeutet Seitenquelltext lesen, Ladezeit messen, Platzierungen abfragen und
 * Wettbewerber ansehen. Wer das regelmässig tut, braucht dafür rund eine
 * Dreiviertelstunde; wer es selten tut, deutlich länger. Gerechnet wird mit
 * dem niedrigeren Wert, damit die Zahl eher zu klein als zu gross ist.
 */
export const MINUTEN_JE_ANALYSE = 45

export type Betriebszahlen = {
  organisationen: number
  konten: number
  gesperrteKonten: number
  offeneEinladungen: number

  analysenGesamt: number
  analysenLetzte30Tage: number
  laufendeAnalysen: number
  fehlgeschlagen: number

  recherchen: number
  befundeGesamt: number
  gesparteStunden: number

  /** Externe Anbieterkosten in Cent, über alle Arbeitsbereiche. */
  kostenCent: number

  haeufigsteBefunde: Array<{ id: string; bezeichnung: string; laeufe: number }>
}

export async function betriebszahlen(): Promise<Betriebszahlen> {
  const vor30Tagen = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    organisationen,
    konten,
    gesperrteKonten,
    offeneEinladungen,
    analysenGesamt,
    analysenLetzte30Tage,
    laufendeAnalysen,
    fehlgeschlagen,
    recherchen,
    kosten,
    ergebnisse,
  ] = await Promise.all([
    db.organization.count(),
    db.user.count(),
    db.user.count({ where: { suspendedAt: { not: null } } }),
    db.invitation.count({ where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
    db.analysis.count({ where: { status: 'COMPLETED' } }),
    db.analysis.count({ where: { status: 'COMPLETED', createdAt: { gte: vor30Tagen } } }),
    db.analysis.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } }),
    db.analysis.count({ where: { status: 'FAILED' } }),
    db.keywordResearch.count(),
    db.analysis.aggregate({ _sum: { creditsUsed: true } }),
    // Nur das Ergebnis, nicht die Adresse: Für die Befundzählung wird nicht
    // gebraucht, wessen Seite geprüft wurde.
    db.analysis.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { result: true },
    }),
  ])

  const befundeGesamt = ergebnisse.reduce((summe, a) => summe + zaehleBefunde(a.result), 0)

  return {
    organisationen,
    konten,
    gesperrteKonten,
    offeneEinladungen,
    analysenGesamt,
    analysenLetzte30Tage,
    laufendeAnalysen,
    fehlgeschlagen,
    recherchen,
    befundeGesamt,
    gesparteStunden: Math.round((analysenGesamt * MINUTEN_JE_ANALYSE) / 60),
    kostenCent: kosten._sum.creditsUsed ?? 0,
    haeufigsteBefunde: wiederkehrendeBefunde(
      ergebnisse.map((a) => a.result),
      { mindestens: 2, hoechstens: 8 },
    ).map(({ id, bezeichnung, laeufe }) => ({ id, bezeichnung, laeufe })),
  }
}

function zaehleBefunde(ergebnis: unknown): number {
  if (!ergebnis || typeof ergebnis !== 'object') return 0
  const module = (ergebnis as { modules?: unknown }).modules
  if (!Array.isArray(module)) return 0
  return module.reduce((summe: number, m) => {
    const f = (m as { findings?: unknown })?.findings
    return summe + (Array.isArray(f) ? f.length : 0)
  }, 0)
}
