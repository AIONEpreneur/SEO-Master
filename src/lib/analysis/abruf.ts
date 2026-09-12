/**
 * Der Seite folgen, bevor über sie geurteilt wird.
 *
 * Die Rückmeldung aus der Praxis hatte eine gemeinsame Wurzel: Das Werkzeug
 * bewertete, was es beim ersten Anfassen sah, statt der Seite zu folgen.
 * Wer `beispiel.de/seite` anfragt und auf `beispiel.de/seite/` landet,
 * bekam ein Canonical-Urteil gegen die angefragte Adresse — also gegen eine
 * Adresse, die es so gar nicht mehr gab.
 *
 * Hier entsteht deshalb *ein* Ergebnis, das alle nachfolgenden Schritte
 * benutzen: die angefragte Adresse, die tatsächlich ausgelieferte, und ob
 * dazwischen eine Weiterleitung lag. Aus dieser einen Quelle stammt jede
 * spätere Aussage darüber — damit im selben Bericht nicht zehn Zeilen
 * später steht, beide Varianten würden antworten.
 */

export type Weiterleitung = {
  /** Was angefragt wurde. */
  angefragt: string
  /** Was am Ende ausgeliefert wurde. Bei einer Weiterleitung eine andere Adresse. */
  ausgeliefert: string
  /** Gab es unterwegs eine Weiterleitung? */
  gefolgt: boolean
  /**
   * Worin sich die beiden unterscheiden — für den Bericht in Worten.
   * Null, wenn nicht weitergeleitet wurde.
   */
  art: 'schraegstrich' | 'www' | 'protokoll' | 'andere-seite' | 'anderer-host' | null
}

/** Wie unterscheiden sich angefragte und ausgelieferte Adresse? */
export function artDerWeiterleitung(angefragt: string, ausgeliefert: string): Weiterleitung['art'] {
  let a: URL
  let b: URL
  try {
    a = new URL(angefragt)
    b = new URL(ausgeliefert)
  } catch {
    return null
  }
  if (a.href === b.href) return null

  const hostA = a.host.toLowerCase()
  const hostB = b.host.toLowerCase()
  if (hostA !== hostB) {
    return hostA.replace(/^www\./, '') === hostB.replace(/^www\./, '') ? 'www' : 'anderer-host'
  }
  if (a.protocol !== b.protocol) return 'protokoll'

  const pfadA = a.pathname
  const pfadB = b.pathname
  if (pfadA.replace(/\/+$/, '') === pfadB.replace(/\/+$/, '')) return 'schraegstrich'
  return 'andere-seite'
}

export function beschreibeWeiterleitung(w: Weiterleitung): string | null {
  if (!w.gefolgt) return null
  // Ohne erkannte Art gab es nichts, was eine Weiterleitung genannt zu werden
  // verdient — etwa nur ein Schrägstrich an der Wurzel. Hier trotzdem einen
  // Satz zu schreiben, wäre genau der Widerspruch, um den es geht: Der
  // Bericht behauptete eine Weiterleitung, die niemand nachvollziehen kann.
  if (w.art === null) return null
  switch (w.art) {
    case 'schraegstrich':
      return `Die Adresse leitet auf die Fassung ${w.ausgeliefert.endsWith('/') ? 'mit' : 'ohne'} Schrägstrich am Ende weiter. Bewertet wurde die ausgelieferte Adresse.`
    case 'www':
      return `Die Adresse leitet auf ${new URL(w.ausgeliefert).host} weiter. Bewertet wurde die ausgelieferte Adresse.`
    case 'protokoll':
      return 'Die Adresse leitet auf die verschlüsselte Fassung weiter. Bewertet wurde die ausgelieferte Adresse.'
    case 'anderer-host':
      return `Die Adresse leitet auf ${new URL(w.ausgeliefert).host} weiter — eine andere Domain. Bewertet wurde die ausgelieferte Adresse.`
    default:
      return `Die Adresse leitet auf ${w.ausgeliefert} weiter. Bewertet wurde die ausgelieferte Adresse.`
  }
}

/**
 * Die Gegenprobe zu einer Adresse: einmal mit, einmal ohne Schrägstrich.
 *
 * Viele Server antworten nur auf eine der beiden Fassungen und schicken die
 * andere ins Leere. Beim ersten Fehlschlag darf deshalb nicht "nicht
 * ladbar" gemeldet werden — erst wenn auch die andere Fassung nicht
 * antwortet, ist die Seite wirklich nicht erreichbar.
 */
export function andereSchreibweise(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  // Auf der Wurzel gibt es nichts zu drehen: "/" ohne Schrägstrich ist "".
  if (u.pathname === '/' || u.pathname === '') return null
  // Eine Adresse mit Dateiendung bekommt keinen Schrägstrich angehängt.
  const letzterTeil = u.pathname.split('/').filter(Boolean).pop() ?? ''
  if (u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '')
  } else {
    if (/\.[a-z0-9]{2,5}$/i.test(letzterTeil)) return null
    u.pathname = `${u.pathname}/`
  }
  return u.href
}

/**
 * Zählt dieser Status als Fehlschlag, der einen zweiten Versuch rechtfertigt?
 *
 * Ein 404 auf `/seite` ist der klassische Fall, in dem `/seite/` antwortet.
 * Ein 403 dagegen ist eine Bot-Sperre — die trifft beide Schreibweisen
 * gleichermassen, ein zweiter Versuch wäre nur eine weitere Abfuhr.
 */
export function lohntZweiterVersuch(status: number | null): boolean {
  if (status === null) return true
  return status === 404 || status === 410 || status >= 500
}
