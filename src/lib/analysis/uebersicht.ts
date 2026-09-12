/**
 * Zahlen für die Übersicht: Wo stehe ich, und geht es aufwärts?
 *
 * Die Analyseseite beantwortet "was ist an dieser Seite zu tun?". Die
 * Übersicht beantwortet die andere Frage, die jemand beim Anmelden hat:
 * bewegt sich überhaupt etwas? Dafür braucht es keine neuen Messungen,
 * sondern nur die, die schon gelaufen sind — die Noten stehen als Spalten
 * an jeder Analyse, das Tempo in den Rohdaten des jeweiligen Laufs.
 */

/** Ein Messpunkt: ein abgeschlossener Lauf, auf seine Noten reduziert. */
export type Messpunkt = {
  id: string
  datum: Date
  gesamt: number | null
  seo: number | null
  aeo: number | null
  geo: number | null
  serp: number | null
}

export type Reihe = {
  /** Die Adresse, deren Verlauf gezeigt wird. */
  adresse: string
  /** Chronologisch, ältester zuerst. Mindestens zwei Punkte. */
  punkte: Messpunkt[]
  erste: Messpunkt
  letzte: Messpunkt
  /** Veränderung der Gesamtnote, gerundet. Null, wenn eine Seite fehlt. */
  delta: number | null
  /** Tage zwischen erster und letzter Messung. */
  spanne: number
}

type Roh = {
  id: string
  targetUrl: string
  createdAt: Date
  scoreOverall: number | null
  scoreSeo: number | null
  scoreAeo: number | null
  scoreGeo: number | null
  scoreSerp: number | null
}

/**
 * Die Adresse mit der längsten Messreihe — und nur die.
 *
 * Wer fünf verschiedene Seiten je einmal geprüft hat, hat keinen Verlauf,
 * sondern fünf Momentaufnahmen; die in ein Liniendiagramm zu zwingen wäre
 * eine erfundene Entwicklung. Deshalb: die Adresse mit den meisten Läufen,
 * bei Gleichstand die zuletzt gemessene, und unter zwei Läufen gar nichts.
 */
export function laengsteReihe(analysen: Roh[]): Reihe | null {
  const nachAdresse = new Map<string, Roh[]>()
  for (const a of analysen) {
    const liste = nachAdresse.get(a.targetUrl)
    if (liste) liste.push(a)
    else nachAdresse.set(a.targetUrl, [a])
  }

  let beste: Roh[] | null = null
  for (const liste of nachAdresse.values()) {
    if (liste.length < 2) continue
    if (!beste || liste.length > beste.length) {
      beste = liste
      continue
    }
    if (liste.length === beste.length && juengstes(liste) > juengstes(beste)) beste = liste
  }
  if (!beste) return null

  const punkte = [...beste]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(
      (a): Messpunkt => ({
        id: a.id,
        datum: a.createdAt,
        gesamt: a.scoreOverall,
        seo: a.scoreSeo,
        aeo: a.scoreAeo,
        geo: a.scoreGeo,
        serp: a.scoreSerp,
      }),
    )

  const erste = punkte[0]
  const letzte = punkte[punkte.length - 1]
  const delta =
    erste.gesamt === null || letzte.gesamt === null
      ? null
      : Math.round((letzte.gesamt - erste.gesamt) * 10) / 10

  return {
    adresse: beste[0].targetUrl,
    punkte,
    erste,
    letzte,
    delta,
    spanne: Math.max(
      0,
      Math.round((letzte.datum.getTime() - erste.datum.getTime()) / (24 * 60 * 60 * 1000)),
    ),
  }
}

function juengstes(liste: Roh[]): number {
  return Math.max(...liste.map((a) => a.createdAt.getTime()))
}

// --- Tempo ------------------------------------------------------------------

export type Tempowerte = {
  tempo: number | null
  bedienbarkeit: number | null
  standards: number | null
  seo: number | null
  /** Grösster sichtbarer Inhalt, in Sekunden. */
  lcpSekunden: number | null
  /** Wie stark das Layout beim Laden springt. */
  cls: number | null
}

/**
 * Die Lighthouse-Werte aus den Rohdaten eines Laufs.
 *
 * Sie werden bei jeder Analyse mitgeschrieben (`rawData.pagespeed`), bisher
 * aber nur innerhalb der SEO-Note verrechnet. Für die Übersicht werden sie
 * hier wieder herausgeholt, statt eine zweite Messung zu starten: Eine
 * Anzeige, die selbst Kosten verursacht, gehört nicht auf eine Seite, die
 * bei jedem Anmelden aufgeht.
 */
export function tempowerte(rawData: unknown): Tempowerte | null {
  if (!rawData || typeof rawData !== 'object') return null
  const psi = (rawData as Record<string, unknown>).pagespeed
  if (!psi || typeof psi !== 'object') return null

  const scores = (psi as Record<string, unknown>).scores
  const metrics = (psi as Record<string, unknown>).metrics
  if (!scores || typeof scores !== 'object') return null

  const s = scores as Record<string, unknown>
  const m = (metrics ?? {}) as Record<string, unknown>
  const lcp = zahl(m.lcp)

  const werte: Tempowerte = {
    tempo: zahl(s.performance),
    bedienbarkeit: zahl(s.accessibility),
    standards: zahl(s.bestPractices),
    seo: zahl(s.seo),
    // Lighthouse liefert Millisekunden; auf der Anzeige stehen Sekunden mit
    // einer Nachkommastelle — "2,4 s" sagt mehr als "2412".
    lcpSekunden: lcp === null ? null : Math.round(lcp / 100) / 10,
    cls: zahl(m.cls),
  }

  // Ohne eine einzige Note ist die Kachel leer und gehört gar nicht erst hin.
  const hatNote = [werte.tempo, werte.bedienbarkeit, werte.standards, werte.seo].some(
    (w) => w !== null,
  )
  return hatNote ? werte : null
}

function zahl(wert: unknown): number | null {
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : null
}

// --- Einordnung -------------------------------------------------------------

export type Stufe = 'gut' | 'mittel' | 'schwach'

/**
 * Die Lighthouse-Schwellen, wie Google sie selbst zieht: ab 90 grün, ab 50
 * orange, darunter rot. Bewusst dieselben Grenzen — wer den Wert schon aus
 * PageSpeed Insights kennt, soll hier nicht plötzlich eine andere Farbe
 * sehen und an einem der beiden Werkzeuge zweifeln.
 */
export function stufeVonHundert(wert: number | null): Stufe | null {
  if (wert === null) return null
  if (wert >= 90) return 'gut'
  if (wert >= 50) return 'mittel'
  return 'schwach'
}

/** Die Noten der App laufen von 0 bis 10, nicht von 0 bis 100. */
export function stufeVonZehn(wert: number | null): Stufe | null {
  return wert === null ? null : stufeVonHundert(wert * 10)
}

export const STUFEN_WORT: Record<Stufe, string> = {
  gut: 'gut',
  mittel: 'mittel',
  schwach: 'schwach',
}
