/**
 * Die Anrede auf der Übersicht.
 *
 * Ein Name statt einer Rubriküberschrift: Wer sich anmeldet, kommt in sein
 * Portal und nicht in eine Datenbankmaske.
 *
 * Zwei Fallstricke sind hier absichtlich vermieden. Erstens der volle Name —
 * "Guten Morgen, Dr. Kirsten Biema-Sommer" liest sich wie ein Behördenbrief;
 * genommen wird der erste Bestandteil. Zweitens die E-Mail als Ersatz: Wer
 * keinen Namen hinterlegt hat, wird mit "Schön, dass du da bist" begrüsst und
 * nicht mit "Guten Morgen, k.biema+seo".
 */

/** Der erste Namensbestandteil — mehr braucht eine Anrede nicht. */
export function vorname(name: string | null): string | null {
  const erster = (name ?? '').trim().split(/\s+/)[0]
  if (!erster || erster.length < 2) return null
  // Titel sind keine Namen.
  if (/^(dr|prof|dipl|mag|ing)\.?$/i.test(erster)) {
    const zweiter = (name ?? '').trim().split(/\s+/)[1]
    return zweiter && zweiter.length >= 2 ? zweiter : null
  }
  return erster
}

/**
 * Tageszeit in Worten.
 *
 * @param stunde Ortszeit der Leserin. Der Server steht womöglich in einer
 *   anderen Zeitzone — "Guten Morgen" um 23 Uhr wäre eine kleine, aber
 *   unnötige Fremdheit. Wird keine Stunde übergeben, bleibt es bei einer
 *   Begrüssung ohne Tageszeit.
 */
export function begruessung(name: string | null, stunde?: number): string {
  const wer = vorname(name)

  if (stunde === undefined) {
    return wer ? `Hallo, ${wer}` : 'Schön, dass du da bist'
  }

  const zeit =
    stunde < 5 ? 'Gute Nacht' : stunde < 11 ? 'Guten Morgen' : stunde < 18 ? 'Hallo' : 'Guten Abend'

  return wer ? `${zeit}, ${wer}` : zeit
}
