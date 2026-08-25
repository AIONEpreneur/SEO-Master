import type { AnalysisResult, Finding, ModuleResult } from './types'

/**
 * Vergleich zum letzten Lauf derselben Adresse.
 *
 * Eine Momentaufnahme beantwortet "wie steht es?" – der Vergleich beantwortet
 * "wirkt, was ich tue?". Das ist die Frage, für die man jeden Monat
 * wiederkommt.
 *
 * Verglichen wird über die Befund-Kennungen, nicht über die Titel: Titel
 * tragen Messwerte des einzelnen Laufs ("Title mit 75 Zeichen zu lang"), die
 * Kennung benennt die Art des Befundes. Behoben ist, was vorher gemeldet
 * wurde und jetzt nicht mehr; neu ist das Umgekehrte.
 */

export type NotenSchritt = {
  module: string
  vorher: number | null
  nachher: number | null
  /** Gerundet auf eine Nachkommastelle; 0 heisst unverändert. */
  delta: number | null
}

export type Verlauf = {
  vorherigesDatum: string
  schritte: NotenSchritt[]
  gesamt: NotenSchritt
  behoben: Finding[]
  neu: Finding[]
  /** Befunde, die in beiden Läufen stehen. */
  bleibt: Finding[]
  /** Abgehakt, aber vom neuen Lauf erneut gemeldet: ein Rückfall. */
  rueckfaelle: Finding[]
}

function befundeVon(result: AnalysisResult): Map<string, Finding> {
  const map = new Map<string, Finding>()
  for (const modul of result.modules) {
    for (const befund of modul.findings) map.set(befund.id, befund)
  }
  return map
}

function runde(wert: number | null): number | null {
  return wert === null ? null : Math.round(wert * 10) / 10
}

function schritt(module: string, vorher: number | null, nachher: number | null): NotenSchritt {
  const v = runde(vorher)
  const n = runde(nachher)
  return {
    module,
    vorher: v,
    nachher: n,
    delta: v === null || n === null ? null : Math.round((n - v) * 10) / 10,
  }
}

export function vergleiche(input: {
  aktuell: AnalysisResult
  vorher: AnalysisResult
  vorherigesDatum: string
  /** Kennungen, die in der App abgehakt wurden. */
  erledigt?: Set<string>
}): Verlauf {
  const { aktuell, vorher, vorherigesDatum } = input
  const erledigt = input.erledigt ?? new Set()

  const alt = befundeVon(vorher)
  const neu = befundeVon(aktuell)

  const behoben = [...alt.values()].filter((b) => !neu.has(b.id))
  const neueBefunde = [...neu.values()].filter((b) => !alt.has(b.id))
  const bleibt = [...neu.values()].filter((b) => alt.has(b.id) && !erledigt.has(b.id))
  // Abgehakt, aber wieder gemessen: Entweder war das Häkchen verfrüht oder
  // die Änderung ist zurückgerollt. Beides gehört sichtbar gemacht, nicht
  // stillschweigend als "bleibt" einsortiert.
  const rueckfaelle = [...neu.values()].filter((b) => alt.has(b.id) && erledigt.has(b.id))

  const alteModule = new Map(vorher.modules.map((m) => [m.module, m]))
  const schritte = aktuell.modules
    .map((m: ModuleResult) => schritt(m.module, alteModule.get(m.module)?.score ?? null, m.score))
    // Nur Module, die in beiden Läufen liefen – sonst vergliche man eine
    // Messung mit einer Lücke.
    .filter((s) => s.vorher !== null && s.nachher !== null)

  return {
    vorherigesDatum,
    schritte,
    gesamt: schritt('Gesamt', vorher.scores.overall, aktuell.scores.overall),
    behoben,
    neu: neueBefunde,
    bleibt,
    rueckfaelle,
  }
}

/** Ein Satz für die Übersicht: das Wichtigste aus dem Vergleich. */
export function verlaufsSatz(v: Verlauf): string {
  const teile: string[] = []
  if (v.gesamt.delta !== null && v.gesamt.delta !== 0) {
    teile.push(
      `Gesamtwert ${v.gesamt.delta > 0 ? 'von' : 'von'} ${v.gesamt.vorher} auf ${v.gesamt.nachher}`,
    )
  }
  if (v.behoben.length > 0) teile.push(`${v.behoben.length} Befund${v.behoben.length === 1 ? '' : 'e'} behoben`)
  if (v.neu.length > 0) teile.push(`${v.neu.length} neu`)
  if (v.rueckfaelle.length > 0) teile.push(`${v.rueckfaelle.length} Rückfall${v.rueckfaelle.length === 1 ? '' : 'e'}`)
  if (teile.length === 0) return 'Seit dem letzten Lauf hat sich nichts verändert.'
  return `Seit dem letzten Lauf: ${teile.join(', ')}.`
}
