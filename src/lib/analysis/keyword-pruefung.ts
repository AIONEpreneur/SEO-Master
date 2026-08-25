/**
 * Vorprüfung der Suchbegriffe.
 *
 * Der Anlass ist der teuerste Fehler, den dieses Werkzeug machen kann: Es
 * vergab eine SERP-Note von 1,8 – und die Note beschrieb nicht die Website,
 * sondern die fünf Wörter, die jemand eingegeben hatte. Für vier davon gab es
 * kein messbares Suchvolumen; das Ergebnis konnte nur null sein.
 *
 * Eine Note, die aus einer Eingabe folgt statt aus einer Messung, ist
 * schlimmer als keine Note. Sie sieht aus wie ein Befund und wird wie einer
 * behandelt.
 *
 * Deshalb wird vor jeder Platzierungsprüfung sortiert: Was wird gesucht, was
 * ist zu allgemein, und was existiert schlicht nicht als Suchanfrage.
 */
import { wortfolge } from './begriffe'

export type BegriffsUrteil = {
  begriff: string
  /** Suchen im Monat, sofern erhoben. */
  volumen: number | null
  urteil: 'messbar' | 'zu-allgemein' | 'ohne-volumen' | 'ungeprueft'
  grund?: string
}

/**
 * Begriffe, die als Ziel für eine einzelne Website nicht taugen.
 *
 * Ein Wort wie "ki" hat sehr viel Suchvolumen und ist trotzdem kein Ziel:
 * Dahinter steht keine Absicht, die sich mit einer Seite beantworten liesse,
 * und die erste Ergebnisseite gehört Nachschlagewerken und Konzernen. Wer
 * darauf misst, misst eine Niederlage, die nichts bedeutet.
 *
 * Die Grenze liegt bei drei Zeichen, weil kürzere Einzelwörter im Deutschen
 * praktisch immer Abkürzungen ganzer Themengebiete sind: ki, ai, seo, crm.
 */
const KUERZESTE_SINNVOLLE_LAENGE = 4

export function istZuAllgemein(begriff: string): boolean {
  const woerter = wortfolge(begriff).split(' ').filter(Boolean)
  return woerter.length === 1 && woerter[0].length < KUERZESTE_SINNVOLLE_LAENGE
}

/**
 * Ab wann ein Suchvolumen als messbar gilt.
 *
 * Unter zehn Suchen im Monat ist der Wert nicht mehr von Rauschen zu
 * unterscheiden, und eine Platzierung dort bewegt nichts – auch Platz eins
 * bliebe ohne Wirkung.
 */
export const VOLUMEN_SCHWELLE = 10

export function beurteile(
  begriffe: string[],
  volumen: Map<string, number | null> | null,
): BegriffsUrteil[] {
  return begriffe.map((begriff) => {
    if (istZuAllgemein(begriff)) {
      return {
        begriff,
        volumen: null,
        urteil: 'zu-allgemein' as const,
        grund:
          'Ein einzelnes, sehr kurzes Wort steht für ein ganzes Themengebiet. Die erste Ergebnisseite gehört dort Nachschlagewerken und Konzernen – eine Platzierung dafür ist kein erreichbares Ziel und ihr Fehlen kein Befund.',
      }
    }

    if (!volumen) {
      return { begriff, volumen: null, urteil: 'ungeprueft' as const }
    }

    const wert = volumen.get(wortfolge(begriff)) ?? null
    if (wert === null || wert < VOLUMEN_SCHWELLE) {
      return {
        begriff,
        volumen: wert,
        urteil: 'ohne-volumen' as const,
        grund:
          wert === null
            ? 'Für diesen Begriff liegt kein Suchvolumen vor – er wird als Suchanfrage praktisch nicht verwendet.'
            : `Nur ${wert} Suchen im Monat. Auch Platz eins brächte hier keine Besuche.`,
      }
    }

    return { begriff, volumen: wert, urteil: 'messbar' as const }
  })
}

/** Die Begriffe, für die eine Platzierungsprüfung überhaupt sinnvoll ist. */
export function messbare(urteile: BegriffsUrteil[]): string[] {
  return urteile.filter((u) => u.urteil === 'messbar' || u.urteil === 'ungeprueft').map((u) => u.begriff)
}

/**
 * Ein Befund über die Eingabe, nicht über die Website.
 *
 * Er ist als „schneller Hebel" eingestuft, nicht als Mangel: Es ist nichts
 * kaputt, es wurde nur am falschen Ort gemessen. Und er nennt Alternativen,
 * sofern welche gefunden wurden – ein Hinweis ohne Ausweg hilft niemandem.
 */
export function begriffsBefund(
  urteile: BegriffsUrteil[],
  alternativen: Array<{ begriff: string; volumen: number }>,
) {
  const untauglich = urteile.filter((u) => u.urteil === 'ohne-volumen' || u.urteil === 'zu-allgemein')
  if (untauglich.length === 0) return null

  const messbarAnzahl = urteile.length - untauglich.length
  const liste = untauglich.map((u) => `„${u.begriff}" (${u.grund})`).join(' ')

  const vorschlag = alternativen.length
    ? ` Tatsächlich gesucht wird dagegen: ${alternativen
        .slice(0, 5)
        .map((a) => `„${a.begriff}" (${a.volumen.toLocaleString('de-DE')}/Monat)`)
        .join(', ')}.`
    : ' Für dieses Themenfeld liessen sich keine Begriffe mit nennenswertem Volumen finden – möglicherweise ist es kein Suchmarkt, sondern ein Positionierungsthema.'

  return {
    id: 'keyword-ohne-nachfrage',
    severity: 'quickwin' as const,
    title:
      messbarAnzahl === 0
        ? 'Keiner der geprüften Begriffe wird nennenswert gesucht'
        : `${untauglich.length} von ${urteile.length} geprüften Begriffen werden nicht gesucht`,
    why: `Eine Platzierungsbewertung für solche Begriffe misst die Eingabe, nicht die Website: ${liste}${vorschlag}`,
    action:
      'Beim nächsten Lauf die tatsächlich gesuchten Begriffe eintragen. Positionierungswörter — wie sich die Zielgruppe selbst nennt — gehören auf die Seite, taugen aber nicht als Messgrösse: Sie werden verwendet, wenn man schon da ist, nicht bei der Suche.',
    effort: 'gering' as const,
    impact: 'hoch' as const,
  }
}
