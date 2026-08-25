/**
 * Begriffsvergleich für die Auswertung.
 *
 * Warum das ein eigenes Modul ist: Ein einfaches `includes` auf dem Rohtext
 * hat auf einer echten Seite zwei falsche Befunde erzeugt.
 *
 *   1. "Online-Business" wurde nicht als "online business" erkannt. Der
 *      Bericht meldete daraufhin, das Hauptkeyword fehle in Title, H1 und
 *      Meta Description – obwohl es an allen drei Stellen stand. Google
 *      behandelt Bindestriche als Worttrenner; diese Auswertung muss das
 *      genauso tun.
 *   2. Ohne Wortgrenzen liefert `includes` Treffer mitten in Wörtern:
 *      "live" steckt in "Livestreams", "art" in "Startseite".
 *
 * Beides wird hier an einer Stelle gelöst, damit es nicht an jedem
 * Vergleichsort erneut schiefgehen kann.
 */

/**
 * Text auf seine Wortfolge reduzieren.
 *
 * Alles, was kein Buchstabe und keine Ziffer ist, wird zum Trennzeichen:
 * Bindestriche, Schrägstriche, Satzzeichen, typografische Striche und das
 * weiche Trennzeichen. Übrig bleibt eine Folge von Wörtern in Kleinschreibung,
 * die sich verlässlich vergleichen lässt.
 */
export function wortfolge(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Enthält der Text den Begriff als vollständige Wortfolge?
 *
 * "online business" trifft auf "Online-Business für Frauen" zu, aber
 * "art" trifft nicht auf "Startseite" zu.
 */
export function enthaeltBegriff(text: string | null | undefined, begriff: string): boolean {
  if (!text) return false
  const nadel = wortfolge(begriff)
  if (!nadel) return false
  return ` ${wortfolge(text)} `.includes(` ${nadel} `)
}

/**
 * Enthält der Text mindestens ein Wort des Begriffs?
 *
 * Für Fälle, in denen die vollständige Wortfolge zu streng wäre – etwa bei
 * der Frage, ob eine Folgefrage überhaupt zum Thema gehört.
 */
export function enthaeltEinzelwort(text: string | null | undefined, begriff: string): boolean {
  if (!text) return false
  const gepolstert = ` ${wortfolge(text)} `
  return wortfolge(begriff)
    .split(' ')
    .filter((w) => w.length > 2)
    .some((w) => gepolstert.includes(` ${w} `))
}

/**
 * Deutsche und englische Füllwörter.
 *
 * Sie stehen am Anfang vieler Überschriften ("Dein Online-Business …") und
 * würden als Teil des Hauptkeywords sowohl die Platzierungsprüfung als auch
 * die Suchabfrage verfälschen.
 */
const FUELLWOERTER = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'dein', 'deine', 'deinen', 'deiner', 'mein', 'meine', 'meinen', 'meiner', 'ihr', 'ihre', 'ihren',
  'und', 'oder', 'aber', 'denn', 'sondern', 'doch',
  'für', 'mit', 'ohne', 'von', 'vom', 'zum', 'zur', 'bei', 'aus', 'nach', 'über', 'unter', 'auf',
  'ist', 'sind', 'war', 'wird', 'werden', 'kann', 'können', 'soll', 'sollen', 'hat', 'haben',
  'nicht', 'auch', 'noch', 'schon', 'nur', 'mehr', 'sehr', 'ganz', 'alle', 'alles',
  'was', 'wie', 'wer', 'wo', 'wann', 'warum', 'welche', 'welcher',
  'the', 'and', 'for', 'with', 'your', 'you', 'our', 'from', 'that', 'this',
  // Zweibuchstabige Füllwörter. Sie stehen hier, weil die Wortlänge allein
  // kein gutes Sieb ist: "KI" ist zwei Zeichen lang und trägt bei einer
  // KI-Beraterin die gesamte Aussage — "im" und "zu" tragen keine.
  'im', 'am', 'an', 'in', 'zu', 'so', 'es', 'er', 'du', 'da', 'ob', 'um', 'ab',
  'of', 'to', 'in', 'on', 'at', 'is', 'it', 'as', 'by', 'or',
])

/**
 * Deutsche Grundform eines Wortes, so weit es ohne Wörterbuch geht.
 *
 * Der Anlass: Auf einer Seite standen Title und H1 wörtlich
 * "KI-Beratung für Solopreneurinnen ab 40", geprüft wurde gegen
 * "ki-beratung solopreneure" – und die Auswertung meldete, das Hauptkeyword
 * fehle an beiden Stellen. Ein Vergleich, der "Solopreneurinnen" und
 * "Solopreneure" für verschiedene Dinge hält, misst die Schreibweise, nicht
 * die Sache.
 *
 * Zwei Schritte, in dieser Reihenfolge:
 *
 *   1. Weibliche Formen: "-innen" und "-in" fallen weg. Das ist im Deutschen
 *      der häufigste Grund, warum dasselbe Wort zweimal verschieden aussieht,
 *      und es betrifft ausgerechnet Berufs- und Rollenbezeichnungen – also
 *      genau die Wörter, um die es bei einer Positionierung geht.
 *   2. Beugungsendungen: -ern, -em, -er, -en, -es, -e.
 *
 * Bewusst NICHT dabei: das blosse "-n" und "-s". Sie würden "beratung" zu
 * "beratun" verkürzen, während "beratungen" zu "beratung" wird – aus einem
 * Wort würden zwei. Ebenso wenig werden Verbformen zusammengeführt
 * ("kostet"/"kosten"); dafür bräuchte es ein Wörterbuch, und bei Suchbegriffen
 * überwiegen ohnehin die Hauptwörter.
 *
 * Die Mindestlänge von vier Zeichen im Rest schützt kurze Wörter davor,
 * zerlegt zu werden.
 */
export function grundform(wort: string): string {
  let w = wort
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')

  if (w.length > 7 && w.endsWith('innen')) w = w.slice(0, -5)
  else if (w.length > 4 && w.endsWith('in')) w = w.slice(0, -2)

  for (const endung of ['ern', 'em', 'er', 'en', 'es', 'e']) {
    if (w.endsWith(endung) && w.length - endung.length >= 4) {
      return w.slice(0, -endung.length)
    }
  }
  return w
}

/**
 * Wie viel einer Suchanfrage steht auf der Seite? Ein Wert zwischen 0 und 1.
 *
 * Für die Frage "behandelt die Seite dieses Thema" ist der Vergleich auf die
 * exakte Wortfolge zu streng: Wer nach "ki beratung kosten" sucht und auf der
 * Seite "Was kostet KI-Beratung?" liest, hat die Antwort gefunden – die
 * Wortfolge stimmt trotzdem nicht überein.
 *
 * Deshalb wird je Inhaltswort verglichen, ob die Seite dasselbe Wort in
 * irgendeiner Beugungsform enthält – über die Grundform oben.
 *
 * Füllwörter zählen nicht mit – sie stehen auf jeder Seite und würden jede
 * Anfrage als abgedeckt erscheinen lassen.
 */
export function deckungsgrad(text: string | null | undefined, begriff: string): number {
  if (!text) return 0

  const inhaltswoerter = wortfolge(begriff)
    .split(' ')
    .filter((w) => w.length >= 2 && !istFuellwort(w))
  if (inhaltswoerter.length === 0) return 0

  const seitenstaemme = [...new Set(wortfolge(text).split(' ').map(grundform))]
  const gefunden = inhaltswoerter.filter((wort) => {
    const gesucht = grundform(wort)
    return seitenstaemme.some((vorhanden) => stimmenUeberein(gesucht, vorhanden))
  })
  return gefunden.length / inhaltswoerter.length
}

/**
 * Zwei Grundformen als dasselbe Wort werten.
 *
 * Die Regeln oben fassen Hauptwörter zusammen, aber keine Verbformen:
 * "kosten" wird zu "kost", "kostet" bleibt stehen. Für die Frage, ob eine
 * Seite ein Thema behandelt, ist das zu streng – wer "was kostet KI-Beratung"
 * schreibt, beantwortet "ki beratung kosten".
 *
 * Deshalb gilt zusätzlich: Ist die eine Form der Anfang der anderen, zählt es
 * als Treffer. Die Untergrenze von vier Zeichen ist entscheidend – ohne sie
 * fände "ki" jedes Wort, das mit diesen beiden Buchstaben beginnt, von
 * "Kinder" bis "Kiste".
 */
function stimmenUeberein(a: string, b: string): boolean {
  if (a === b) return true
  const [kurz, lang] = a.length <= b.length ? [a, b] : [b, a]
  return kurz.length >= 4 && lang.startsWith(kurz)
}

export function istFuellwort(wort: string): boolean {
  return FUELLWOERTER.has(wort)
}

/**
 * Aus einer Überschrift oder einem Title den tragenden Begriff gewinnen.
 *
 * Zuerst wird der Markenzusatz nach einem Trennzeichen abgeschnitten, dann
 * fallen Füllwörter weg. Was übrig bleibt, sind die inhaltstragenden Wörter –
 * aus "Dein Online-Business — ohne alles allein rauszufinden" wird
 * "online business", nicht "dein online business ohne".
 *
 * Die Obergrenze von drei Wörtern ist bewusst: Längere Ketten sind als
 * Suchanfrage unbrauchbar, weil niemand so sucht.
 */
export function tragenderBegriff(quelle: string | null | undefined, maxWoerter = 3): string | null {
  if (!quelle) return null

  const ohneMarke = quelle.split(/[|–—•·:]/)[0]
  const woerter = wortfolge(ohneMarke)
    .split(' ')
    .filter((w) => w.length >= 2 && !istFuellwort(w))

  if (woerter.length === 0) return null
  return woerter.slice(0, maxWoerter).join(' ')
}

/** Trennzeichen, mit denen Seiten ihren Markennamen an den Title hängen. */
const MARKENTRENNER = /\s[|\u2013\u2014\u2022\u00b7]\s/

/**
 * Zerlegt einen Title in Aussage und Markenzusatz.
 *
 * Google kürzt den Title von hinten. Steht hinten der Markenname, geht die
 * Aussage nicht verloren – abgeschnitten wird der Name. Die Länge der
 * Aussage ist deshalb die Grösse, die zählt, nicht die Gesamtlänge.
 *
 * Getrennt wird nur am letzten Trenner und nur, wenn hinten wirklich ein
 * kurzer Zusatz steht. "Preise in Euro, netto und brutto" darf nicht als
 * Marke gelten, bloss weil ein Gedankenstrich davorsteht.
 */
export function teileMarke(title: string): { kern: string; marke: string | null } {
  const treffer = [...title.matchAll(new RegExp(MARKENTRENNER, 'g'))]
  const letzter = treffer[treffer.length - 1]
  if (!letzter || letzter.index === undefined) return { kern: title.trim(), marke: null }

  const kern = title.slice(0, letzter.index).trim()
  const marke = title.slice(letzter.index + letzter[0].length).trim()

  // Ein Markenzusatz ist kurz und besteht aus wenigen Wörtern. Alles andere
  // ist Teil der Aussage.
  const istMarke = marke.length > 0 && marke.length <= 30 && marke.split(/\s+/).length <= 4
  if (!istMarke || kern.length === 0) return { kern: title.trim(), marke: null }

  return { kern, marke }
}
