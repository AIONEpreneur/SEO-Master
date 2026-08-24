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
