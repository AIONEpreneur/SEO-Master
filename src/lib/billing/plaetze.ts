import type { Plan } from '@prisma/client'

/**
 * Wie viele Personen ein Arbeitsbereich trägt.
 *
 * Warum überhaupt eine Grenze — das Guthaben deckelt doch schon: Credits
 * hängen am Arbeitsbereich, nicht an der Person. Zehn Mitglieder teilen
 * sich also dieselben Credits, und die Anbieterkosten bleiben gedeckelt.
 * Was sich nicht teilt, ist alles andere: Jede Person bekommt einen eigenen
 * Login, eigene Extension-Schlüssel und eine eigene KI-Anbindung. Genau die
 * drei Dinge stehen in der Preisliste beim Abo. Ohne Grenze bekäme eine
 * Agentur mit fünf Leuten fünf Extension-Plätze für einen Monatspreis.
 *
 * Warum nicht "Team nur im grossen Tarif": Eine Selbstständige mit einer
 * Assistenz oder einer Web-Betreuerin ist der Normalfall, nicht die
 * Ausnahme. Ihr das zu verbieten kostet mehr Abschlüsse, als der Sprung in
 * den grossen Tarif einbringt. Zwei Plätze fühlen sich grosszügig an und
 * schliessen die Agentur trotzdem aus — die braucht fünf.
 */
export const PLAETZE: Record<Plan, number> = {
  // Interne Bereiche des Betriebs rechnen nicht ab und zählen nicht mit.
  INTERNAL: Number.POSITIVE_INFINITY,
  FREE: 1,
  STARTER: 2,
  PRO: 10,
  // AGENCY steht im Datenmodell, wird aber öffentlich nicht angeboten. Der
  // Wert ist gesetzt, damit ein Bereich, den der Betrieb von Hand darauf
  // stellt, nicht versehentlich bei einem Platz landet.
  AGENCY: 25,
}

export function plaetzeGrenze(plan: Plan): number {
  return PLAETZE[plan] ?? 1
}

/**
 * Passt noch jemand hinein?
 *
 * `belegt` zählt Mitglieder **und offene Einladungen**. Wer drei Links
 * verschickt und wartet, bis sie angenommen werden, hätte sonst die Grenze
 * umgangen — und die dritte Person stünde nach dem Klick auf den Link vor
 * einer Absage, für die sie nichts kann.
 */
export function passtNochJemand(input: { plan: Plan; belegt: number }): boolean {
  return input.belegt < plaetzeGrenze(input.plan)
}

/**
 * Die Absage, wenn kein Platz mehr frei ist.
 *
 * Sie nennt den Grund, die Zahl und den Weg — das ist der Moment, in dem
 * jemand tatsächlich mehr will. Eine blosse Fehlermeldung verschenkt ihn.
 */
export function platzVollHinweis(plan: Plan): string {
  const grenze = plaetzeGrenze(plan)
  const personen = grenze === 1 ? 'eine Person' : `${grenze} Personen`
  if (plan === 'PRO') {
    return (
      `Dieser Arbeitsbereich trägt ${personen}, und alle Plätze sind belegt. ` +
      'Für ein grösseres Team melde dich gern — das lässt sich einrichten.'
    )
  }
  return (
    `Dieser Tarif trägt ${personen} in einem Arbeitsbereich, und alle Plätze sind belegt. ` +
    `Mit dem grossen Tarif sind es ${plaetzeGrenze('PRO')}. ` +
    'Einen Platz gibt auch frei, wer ein Mitglied entfernt.'
  )
}

/** Wie die Grenze in der Preisliste steht. */
export function plaetzeLeistung(plan: Plan): string {
  const grenze = plaetzeGrenze(plan)
  if (grenze === 1) return 'Für eine Person'
  return `Für bis zu ${grenze} Personen im Arbeitsbereich`
}
