/**
 * Keyword-Recherche: Wonach wird gesucht – und wo wird dafür Geld ausgegeben?
 *
 * Die Rohdaten von DataForSEO sind für eine Entscheidung ungeeignet: Sie
 * enthalten dieselbe Suchanfrage mehrfach in verschiedenen Schreibweisen,
 * und die kaufmännisch entscheidende Grösse steht gar nicht drin. Dieses
 * Modul erzeugt daraus eine Liste, aus der sich ablesen lässt, welche
 * Begriffe Nachfrage haben und welche davon bezahlt werden.
 *
 * Bewusst ohne Netzzugriff und ohne Datenbank: So lässt sich die Aufbereitung
 * gegen feste Beispieldaten prüfen.
 */
import type { KeywordEintrag } from '@/lib/connectors/dataforseo'

export type Absicht = 'information' | 'vergleich' | 'kauf' | 'marke' | 'unbekannt'

export type KeywordZeile = {
  begriff: string
  suchvolumen: number
  /** Klickpreis in Euro, den Werbetreibende im Mittel zahlen. */
  klickpreis: number
  /**
   * Suchvolumen × Klickpreis: Was für diesen Begriff pro Monat an Werbung
   * ausgegeben würde, wenn jede Suche einen bezahlten Klick auslöste.
   * Keine Rechnungsgrösse, sondern ein Vergleichsmass – es zeigt, wo Geld
   * im Spiel ist, und trennt teure Nachfrage von blossem Volumen.
   */
  anzeigenwert: number
  wettbewerb: 'niedrig' | 'mittel' | 'hoch' | null
  /** 0–100. Wie schwer es ist, ohne Werbung auf die erste Seite zu kommen. */
  schwierigkeit: number | null
  absicht: Absicht
  /** Veränderung des Suchvolumens gegenüber dem Vorjahr, in Prozent. */
  trendJahr: number | null
  /** Zwölf Monatswerte, ältester zuerst – für den Verlauf in der Anzeige. */
  verlauf: number[]
}

export type Zusammenfassung = {
  begriffe: number
  suchenGesamt: number
  anzeigenwertGesamt: number
  /** Begriffe mit Kauf- oder Vergleichsabsicht. */
  mitKaufabsicht: number
  suchenMitKaufabsicht: number
  anzeigenwertMitKaufabsicht: number
  /** Höchster Klickpreis in der Liste – der Begriff, der am meisten wert ist. */
  teuersterBegriff: KeywordZeile | null
}

const ABSICHTEN: Record<string, Absicht> = {
  informational: 'information',
  commercial: 'vergleich',
  transactional: 'kauf',
  navigational: 'marke',
}

export const ABSICHT_LABEL: Record<Absicht, string> = {
  information: 'Information',
  vergleich: 'Vergleich',
  kauf: 'Kauf',
  marke: 'Marke',
  unbekannt: 'Unbekannt',
}

export const ABSICHT_ERKLAERUNG: Record<Absicht, string> = {
  information: 'Sucht nach Wissen. Gut für Beiträge, die Vertrauen aufbauen – verkauft selten sofort.',
  vergleich: 'Wägt Anbieter gegeneinander ab. Hier entscheidet sich, wer in die engere Wahl kommt.',
  kauf: 'Will abschliessen. Der kürzeste Weg zum Umsatz, meist das kleinste Volumen.',
  marke: 'Sucht einen bestimmten Anbieter. Nur dann erreichbar, wenn die eigene Marke gemeint ist.',
  unbekannt: 'Die Absicht liess sich nicht bestimmen.',
}

const WETTBEWERB: Record<string, 'niedrig' | 'mittel' | 'hoch'> = {
  LOW: 'niedrig',
  MEDIUM: 'mittel',
  HIGH: 'hoch',
}

/**
 * Vergleichsform einer Suchanfrage.
 *
 * "ki-beratung" und "ki beratung" sind dieselbe Suchanfrage – der Dienst
 * führt sie getrennt und mit identischen Kennzahlen. Ohne diesen Schritt
 * besteht die halbe Liste aus Dubletten und jede Summe fällt zu hoch aus.
 *
 * Die Wortstellung bleibt bewusst erhalten: "ki beratung" wird 2.400 Mal im
 * Monat gesucht, "beratung ki" nur 260 Mal. Das sind zwei verschiedene
 * Suchanfragen, keine zwei Schreibweisen – wer sie zusammenlegt, verliert
 * genau die Unterscheidung, für die die Recherche gemacht wird.
 */
export function vergleichsform(begriff: string): string {
  return begriff
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Zwölfmonatsverlauf lesen.
 *
 * Die REST-Schnittstelle liefert eine Liste aus Jahr, Monat und Volumen; das
 * MCP-Werkzeug reicht dieselben Daten als Objekt mit "2026-07" als Schlüssel
 * weiter. Beide Formen werden angenommen, damit ein Wechsel der Quelle den
 * Verlauf nicht stillschweigend leert.
 */
export function leseVerlauf(roh: unknown): number[] {
  if (Array.isArray(roh)) {
    const punkte = roh
      .map((e) => e as { year?: number; month?: number; search_volume?: number })
      .filter((e) => typeof e.year === 'number' && typeof e.month === 'number')
      .sort((a, b) => a.year! - b.year! || a.month! - b.month!)
    return punkte.slice(-12).map((e) => e.search_volume ?? 0)
  }

  if (roh && typeof roh === 'object') {
    return Object.entries(roh as Record<string, number>)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, v]) => v ?? 0)
  }

  return []
}

/** Einen Rohdatensatz in eine Zeile übersetzen. */
export function zuZeile(eintrag: KeywordEintrag): KeywordZeile | null {
  const begriff = eintrag.keyword?.trim()
  if (!begriff) return null

  const info = eintrag.keyword_info ?? {}
  const suchvolumen = info.search_volume ?? 0
  const klickpreis = info.cpc ?? 0
  const stufe = info.competition_level ? WETTBEWERB[info.competition_level] ?? null : null

  return {
    begriff,
    suchvolumen,
    klickpreis,
    anzeigenwert: Math.round(suchvolumen * klickpreis),
    wettbewerb: stufe,
    schwierigkeit: eintrag.keyword_properties?.keyword_difficulty ?? null,
    absicht: ABSICHTEN[eintrag.search_intent_info?.main_intent ?? ''] ?? 'unbekannt',
    trendJahr: info.search_volume_trend?.yearly ?? null,
    verlauf: leseVerlauf(info.monthly_searches),
  }
}

/**
 * Rohdaten aus einer oder mehreren Quellen zu einer Liste zusammenführen.
 *
 * Bei Dubletten gewinnt die Schreibweise, die am ehesten so eingegeben wird:
 * die mit Leerzeichen statt Bindestrich. Bei gleicher Form entscheidet das
 * höhere Suchvolumen, damit nie eine Variante mit fehlenden Zahlen die
 * vollständige verdrängt.
 */
export function fuehreZusammen(eintraege: KeywordEintrag[]): KeywordZeile[] {
  const nachForm = new Map<string, KeywordZeile>()

  for (const eintrag of eintraege) {
    const zeile = zuZeile(eintrag)
    if (!zeile || zeile.suchvolumen <= 0) continue

    const form = vergleichsform(zeile.begriff)
    const bisher = nachForm.get(form)
    if (!bisher || istBessereSchreibweise(zeile, bisher)) {
      nachForm.set(form, zeile)
    }
  }

  return [...nachForm.values()].sort((a, b) => b.suchvolumen - a.suchvolumen)
}

function istBessereSchreibweise(neu: KeywordZeile, bisher: KeywordZeile): boolean {
  const neuTrennzeichen = (neu.begriff.match(/[-_/]/g) ?? []).length
  const bisherTrennzeichen = (bisher.begriff.match(/[-_/]/g) ?? []).length
  if (neuTrennzeichen !== bisherTrennzeichen) return neuTrennzeichen < bisherTrennzeichen
  if (neu.suchvolumen !== bisher.suchvolumen) return neu.suchvolumen > bisher.suchvolumen
  // Der vollständigere Datensatz gewinnt, sonst fehlt in der Anzeige der Verlauf.
  return neu.verlauf.length > bisher.verlauf.length
}

export function fasseZusammen(zeilen: KeywordZeile[]): Zusammenfassung {
  const kaufend = zeilen.filter((z) => z.absicht === 'kauf' || z.absicht === 'vergleich')
  const teuerster = zeilen.reduce<KeywordZeile | null>(
    (best, z) => (z.klickpreis > 0 && (!best || z.klickpreis > best.klickpreis) ? z : best),
    null,
  )

  return {
    begriffe: zeilen.length,
    suchenGesamt: summe(zeilen, (z) => z.suchvolumen),
    anzeigenwertGesamt: summe(zeilen, (z) => z.anzeigenwert),
    mitKaufabsicht: kaufend.length,
    suchenMitKaufabsicht: summe(kaufend, (z) => z.suchvolumen),
    anzeigenwertMitKaufabsicht: summe(kaufend, (z) => z.anzeigenwert),
    teuersterBegriff: teuerster,
  }
}

/**
 * Begriffe mit gutem Verhältnis aus Nachfrage und Aufwand.
 *
 * Gesucht sind Begriffe, die bezahlt werden, aber noch erreichbar sind: Ein
 * hoher Klickpreis belegt kaufmännischen Wert, eine niedrige Schwierigkeit
 * bedeutet, dass die erste Seite ohne grosses Verweisprofil erreichbar ist.
 * Begriffe ohne Schwierigkeitswert bleiben aussen vor – ohne diese Zahl wäre
 * die Einschätzung geraten.
 */
export function lohnendeBegriffe(zeilen: KeywordZeile[], anzahl = 8): KeywordZeile[] {
  return zeilen
    .filter((z) => z.schwierigkeit !== null && z.schwierigkeit <= 30 && z.anzeigenwert > 0)
    .sort((a, b) => b.anzeigenwert - a.anzeigenwert)
    .slice(0, anzahl)
}

function summe(zeilen: KeywordZeile[], wert: (z: KeywordZeile) => number): number {
  return zeilen.reduce((s, z) => s + wert(z), 0)
}
