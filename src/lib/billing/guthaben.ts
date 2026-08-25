import type { Plan } from '@prisma/client'

/**
 * Guthaben-Sperre.
 *
 * Wichtig, sobald fremde Personen die Anwendung nutzen: Fehlen einer
 * Organisation eigene Zugangsdaten, greift die Anwendung auf die des Betriebs
 * zurück. Jeder Lauf einer Kundin verursacht dann Kosten auf der Rechnung des
 * Betreibers. Das Guthaben ist die einzige Grenze dazwischen.
 *
 * Die bisherige Prüfung "> 0" reichte dafür nicht: Mit einem einzigen
 * verbleibenden Credit liess sich ein vollständiger Lauf starten, der ein
 * Vielfaches kostet. Verlangt wird deshalb so viel Guthaben, wie ein Lauf
 * üblicherweise verbraucht.
 */

/** Guthaben entspricht Cent an externen Anbieterkosten. */
export const KOSTEN_ANALYSE = 40
export const KOSTEN_RECHERCHE = 10

export type Vorgang = 'analyse' | 'recherche'

const NOETIG: Record<Vorgang, number> = {
  analyse: KOSTEN_ANALYSE,
  recherche: KOSTEN_RECHERCHE,
}

/** Interne Arbeitsbereiche rechnen nicht ab. */
export function rechnetAb(plan: Plan): boolean {
  return plan !== 'INTERNAL'
}

export function reichtGuthaben(organisation: { plan: Plan; credits: number }, vorgang: Vorgang): boolean {
  if (!rechnetAb(organisation.plan)) return true
  return organisation.credits >= NOETIG[vorgang]
}

/**
 * Der Hinweis, wenn es nicht mehr reicht.
 *
 * Für Kundinnen ohne Zahlen aus der Kostenrechnung: Credits sind Cent an
 * Anbieterkosten und gehen sie nichts an. Sie brauchen zu wissen, dass Schluss
 * ist und an wen sie sich wenden – nicht, was ein Aufruf kostet.
 */
export function guthabenHinweis(
  organisation: { plan: Plan; credits: number },
  vorgang: Vorgang,
  optionen?: { mitZahlen?: boolean },
): string {
  const noetig = NOETIG[vorgang]
  const was = vorgang === 'analyse' ? 'Analyse' : 'Recherche'

  if (!optionen?.mitZahlen) {
    return `Für diesen Zeitraum sind keine ${was}n mehr frei. Bitte wenden Sie sich an die Verwaltung, um weitere freizuschalten.`
  }

  return organisation.credits <= 0
    ? `Das Guthaben ist aufgebraucht. Für eine ${was} werden etwa ${noetig} Credits gebraucht.`
    : `Das Guthaben reicht nicht für eine weitere ${was}: ${organisation.credits} vorhanden, etwa ${noetig} nötig.`
}
