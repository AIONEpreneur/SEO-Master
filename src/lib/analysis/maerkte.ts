/**
 * Die Märkte, in denen gemessen werden kann.
 *
 * Ein Lauf misst immer genau einen Google-Länderindex. Das ist keine
 * Entscheidung dieser Anwendung, sondern die Grenze der Datenquelle: Bei
 * DataForSEO ist das Land die grösste Einheit, die es als Standort gibt —
 * "Europa" oder "DACH" als einen Standort abzufragen ist schlicht nicht
 * vorgesehen (nachgeprüft an der Standort-Liste: oberhalb von `Country`
 * kommt nichts).
 *
 * Deshalb sind die Gruppen hier eine Ordnung für das Auge und keine eigenen
 * Messpunkte. Wer für den DACH-Raum arbeitet, findet Deutschland, Österreich
 * und die Schweiz beieinander und legt für jedes Land einen eigenen Lauf an.
 * Das kostet dreimal, misst aber auch dreimal — und ein Mittelwert über drei
 * Länder wäre eine Zahl, die keiner Suchanfrage entspricht.
 *
 * Die Kennziffer ist Googles eigene: 2000 plus der numerische ISO-3166-1-Code
 * des Landes. Deutschland trägt die 276, also 2276.
 */

export type Markt = {
  code: number
  label: string
  /** Die Sprache, in der dort üblicherweise gesucht wird. */
  sprache: string
}

export type Marktgruppe = {
  name: string
  /** Steht unter dem Gruppennamen, wo eine Erklärung hilft. */
  hinweis?: string
  laender: Markt[]
}

export const MARKTGRUPPEN: Marktgruppe[] = [
  {
    name: 'DACH',
    hinweis: 'Deutschland, Österreich, Schweiz',
    laender: [
      { code: 2276, label: 'Deutschland', sprache: 'de' },
      { code: 2040, label: 'Österreich', sprache: 'de' },
      { code: 2756, label: 'Schweiz', sprache: 'de' },
    ],
  },
  {
    name: 'Europa',
    laender: [
      { code: 2056, label: 'Belgien', sprache: 'nl' },
      { code: 2208, label: 'Dänemark', sprache: 'da' },
      { code: 2246, label: 'Finnland', sprache: 'fi' },
      { code: 2250, label: 'Frankreich', sprache: 'fr' },
      { code: 2300, label: 'Griechenland', sprache: 'el' },
      { code: 2372, label: 'Irland', sprache: 'en' },
      { code: 2380, label: 'Italien', sprache: 'it' },
      { code: 2191, label: 'Kroatien', sprache: 'hr' },
      { code: 2442, label: 'Luxemburg', sprache: 'fr' },
      { code: 2528, label: 'Niederlande', sprache: 'nl' },
      { code: 2578, label: 'Norwegen', sprache: 'no' },
      { code: 2616, label: 'Polen', sprache: 'pl' },
      { code: 2620, label: 'Portugal', sprache: 'pt' },
      { code: 2642, label: 'Rumänien', sprache: 'ro' },
      { code: 2752, label: 'Schweden', sprache: 'sv' },
      { code: 2703, label: 'Slowakei', sprache: 'sk' },
      { code: 2705, label: 'Slowenien', sprache: 'sl' },
      { code: 2724, label: 'Spanien', sprache: 'es' },
      { code: 2203, label: 'Tschechien', sprache: 'cs' },
      { code: 2348, label: 'Ungarn', sprache: 'hu' },
      { code: 2826, label: 'Vereinigtes Königreich', sprache: 'en' },
    ],
  },
  {
    name: 'Nordamerika',
    laender: [
      { code: 2840, label: 'USA', sprache: 'en' },
      { code: 2124, label: 'Kanada', sprache: 'en' },
    ],
  },
  {
    name: 'Asien und Pazifik',
    laender: [
      { code: 2036, label: 'Australien', sprache: 'en' },
      { code: 2356, label: 'Indien', sprache: 'en' },
      { code: 2392, label: 'Japan', sprache: 'ja' },
      { code: 2702, label: 'Singapur', sprache: 'en' },
      { code: 2410, label: 'Südkorea', sprache: 'ko' },
      { code: 2784, label: 'Vereinigte Arabische Emirate', sprache: 'en' },
      { code: 2554, label: 'Neuseeland', sprache: 'en' },
      // Hongkong und Taiwan stehen bewusst nicht dabei: Die Standort-Liste
      // der Datenquelle führt beide nicht als Land. Ein Eintrag, der bei der
      // ersten Abfrage ins Leere läuft, ist schlimmer als keiner.
    ],
  },
]

/** Alle Märkte flach — für Suche und Prüfung. */
export const MAERKTE: Markt[] = MARKTGRUPPEN.flatMap((g) => g.laender)

export const STANDARD_MARKT = 2276

export function marktName(code: number): string {
  return MAERKTE.find((m) => m.code === code)?.label ?? `Standort ${code}`
}

export function marktSprache(code: number): string {
  return MAERKTE.find((m) => m.code === code)?.sprache ?? 'de'
}

export function istMarkt(code: number): boolean {
  return MAERKTE.some((m) => m.code === code)
}

/**
 * Die Sprachen, in denen die Oberfläche Analysen anbietet.
 *
 * Bewusst knapp gehalten: Die Berichte entstehen auf Deutsch, und für alles,
 * was darüber hinausgeht, ist Englisch die verlässliche zweite Wahl. Eine
 * lange Liste, von der nur zwei Einträge wirklich getragen sind, verspricht
 * mehr als sie hält.
 *
 * Die Sprache eines Marktes (siehe `sprache` oben) ist davon unabhängig —
 * sie sagt, wonach dort gesucht wird, nicht in welcher Sprache der Bericht
 * geschrieben wird.
 */
export const BERICHTSSPRACHEN = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'Englisch' },
]
