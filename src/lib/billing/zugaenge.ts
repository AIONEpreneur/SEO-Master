import type { SessionUser } from '@/lib/auth/session'

/**
 * Wer verwaltet die Anbieter-Zugaenge selbst?
 *
 * Im Kundenbetrieb niemand ausser dem Betrieb. Kundinnen hinterlegen keine
 * eigenen Schluessel – sie bezahlen fuer die Nutzung, abgerechnet wird ueber
 * die Zugaenge des Betriebs. Der Datentresor waere fuer sie also nicht nur
 * ueberfluessig, sondern schaedlich:
 *
 *  - Er verlangt etwas, das sie nicht haben und nicht besorgen sollen.
 *  - Die Einstiegshilfe haette einen Schritt, den sie nie erledigen koennen.
 *  - Traegt jemand doch eigene Schluessel ein, laufen ihre Analysen ploetzlich
 *    ueber fremde Konten, und die Abrechnung ueber Guthaben stimmt nicht mehr.
 *
 * Massgeblich ist der Tarif, nicht die Rolle: Eine Kundin ist in ihrem eigenen
 * Arbeitsbereich Inhaberin und haette sonst Zugriff.
 */
export function verwaltetEigeneZugaenge(session: SessionUser): boolean {
  return session.isSuperAdmin || session.plan === 'INTERNAL'
}

/**
 * Sieht dieser Arbeitsbereich die Abrechnung?
 *
 * Guthaben und Verbrauch sind die Kostenrechnung des Betriebs: Ein Credit ist
 * ein US-Cent an Anbieterkosten. Eine Kundin zahlt einen Monatspreis – was ein
 * einzelner Aufruf bei DataForSEO kostet, ist ihre Sache nicht. Es ihr zu
 * zeigen hiesse, ihr die eigene Marge vorzurechnen.
 *
 * Was sie stattdessen braucht, ist die Zahl in ihrer Sprache: wie viele
 * Analysen noch gehen.
 */
export function siehtAbrechnung(session: SessionUser): boolean {
  return verwaltetEigeneZugaenge(session)
}

/**
 * Wie viele Analysen das Guthaben noch traegt.
 *
 * Bewusst abgerundet und mit den ueblichen Kosten gerechnet: Eine Zahl, die
 * verspricht, muss halten. Lieber eine zu wenig als eine zu viel.
 */
export function verbleibendeAnalysen(credits: number, kostenJeAnalyse: number): number {
  if (kostenJeAnalyse <= 0) return 0
  return Math.max(0, Math.floor(credits / kostenJeAnalyse))
}
