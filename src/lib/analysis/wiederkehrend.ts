import type { Severity } from './types'

/**
 * Was über mehrere Läufe hinweg immer wieder auffällt.
 *
 * Ein Durchschnitt über verschiedene Websites sagt nichts: Wer eine starke und
 * eine schwache Seite prüft, bekommt eine mittlere Zahl, die für keine der
 * beiden gilt. Was sich über verschiedene Seiten hinweg dagegen sehr wohl
 * ablesen lässt, ist das Muster – die Sorte Mangel, die immer wiederkehrt.
 * Das sagt etwas über die Arbeitsweise, nicht über den Durchschnitt.
 *
 * Gezählt wird pro Lauf höchstens einmal: Drei Bilder ohne Alt-Text in einem
 * Lauf sind ein Befund, nicht drei.
 */
export type WiederkehrenderBefund = {
  id: string
  bezeichnung: string
  severity: Severity
  laeufe: number
}

const RANG: Record<Severity, number> = { critical: 0, quickwin: 1, longterm: 2 }

/**
 * Macht aus einem Befundtitel eine wiederverwendbare Bezeichnung.
 *
 * Titel enthalten Messwerte des einzelnen Laufs ("Title mit 75 Zeichen zu
 * lang"). Über mehrere Läufe ist die konkrete Zahl falsch – 75 galt nur für
 * einen davon. Die Zahlen weichen deshalb einem Auslassungszeichen; steht die
 * Zahl vorn, fällt sie ganz weg.
 */
export function bezeichnung(titel: string): string {
  return titel
    .replace(/\d+(?:[.,]\d+)?/g, '…')
    .replace(/^(?:…\s*)+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

type Befund = { id?: unknown; title?: unknown; severity?: unknown }

/** Liest die Befunde aus einem gespeicherten Analyse-Ergebnis. */
function befundeAus(ergebnis: unknown): Befund[] {
  if (!ergebnis || typeof ergebnis !== 'object') return []
  const module = (ergebnis as { modules?: unknown }).modules
  if (!Array.isArray(module)) return []
  return module.flatMap((m) => {
    const f = (m as { findings?: unknown })?.findings
    return Array.isArray(f) ? (f as Befund[]) : []
  })
}

export function wiederkehrendeBefunde(
  ergebnisse: unknown[],
  optionen?: { mindestens?: number; hoechstens?: number },
): WiederkehrenderBefund[] {
  const mindestens = optionen?.mindestens ?? 2
  const hoechstens = optionen?.hoechstens ?? 5

  const gesammelt = new Map<string, { bezeichnung: string; severity: Severity; laeufe: number }>()

  for (const ergebnis of ergebnisse) {
    // Pro Lauf zählt jede Befundart nur einmal.
    const imLauf = new Set<string>()
    for (const befund of befundeAus(ergebnis)) {
      const id = typeof befund.id === 'string' ? befund.id : null
      const titel = typeof befund.title === 'string' ? befund.title : null
      if (!id || !titel || imLauf.has(id)) continue
      imLauf.add(id)

      const schwere: Severity =
        befund.severity === 'critical' || befund.severity === 'longterm' ? befund.severity : 'quickwin'

      const vorhanden = gesammelt.get(id)
      if (vorhanden) {
        vorhanden.laeufe++
        // Die schwerere Einstufung gewinnt – ein Mangel wird nicht dadurch
        // harmlos, dass er anderswo milder ausfiel.
        if (RANG[schwere] < RANG[vorhanden.severity]) vorhanden.severity = schwere
      } else {
        gesammelt.set(id, { bezeichnung: bezeichnung(titel), severity: schwere, laeufe: 1 })
      }
    }
  }

  return [...gesammelt.entries()]
    .map(([id, wert]) => ({ id, ...wert }))
    .filter((b) => b.laeufe >= mindestens)
    .sort((a, b) => b.laeufe - a.laeufe || RANG[a.severity] - RANG[b.severity] || a.id.localeCompare(b.id))
    .slice(0, hoechstens)
}
