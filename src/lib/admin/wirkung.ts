import { db } from '@/lib/db'

/**
 * Hat die Arbeit mit dem Werkzeug etwas bewirkt?
 *
 * Die ehrliche Antwort lässt sich nur dort geben, wo dieselbe Adresse
 * mehrfach geprüft wurde: Dann ist die zweite Note mit der ersten
 * vergleichbar. Eine einzelne Analyse sagt nichts über Wirkung — sie ist
 * eine Momentaufnahme.
 *
 * Bewusst anonym wie die übrige Betriebsübersicht: Welche Adresse sich
 * verbessert hat, taucht hier nicht auf. Gezählt werden Paare aus erster
 * und letzter Messung, und daraus entsteht ein Durchschnitt.
 */

export type Wirkung = {
  /** Adressen, die mindestens zweimal geprüft wurden. */
  verfolgteAdressen: number
  /** Davon mit besserer Gesamtnote als beim ersten Mal. */
  verbessert: number
  verschlechtert: number
  unveraendert: number
  /** Mittlere Veränderung der Gesamtnote über alle verfolgten Adressen. */
  schnittVeraenderung: number
  /** Der grösste einzelne Zugewinn — ohne zu verraten, wo. */
  groessteVerbesserung: number
}

/**
 * Die Auswertung läuft vollständig in der Datenbank.
 *
 * Das ist keine Frage der Geschwindigkeit, sondern der Zusage: Die geprüften
 * Adressen dienen nur als Gruppierungsschlüssel und verlassen die Datenbank
 * überhaupt nicht. Heraus kommen fünf Zahlen — aus ihnen lässt sich nicht
 * zurückrechnen, wessen Seite sich verbessert hat.
 *
 * Ein Zehntel Note ist die Auflösung der Anzeige; darunter ist es Rauschen
 * und keine Veränderung.
 */
export async function wirkung(): Promise<Wirkung> {
  const [zeile] = await db.$queryRaw<
    Array<{
      verfolgt: number
      verbessert: number
      verschlechtert: number
      unveraendert: number
      schnitt: number | null
      groesste: number | null
    }>
  >`
    WITH paare AS (
      SELECT
        (array_agg("scoreOverall" ORDER BY "createdAt" DESC))[1]
          - (array_agg("scoreOverall" ORDER BY "createdAt" ASC))[1] AS differenz
      FROM analyses
      WHERE status = 'COMPLETED' AND "scoreOverall" IS NOT NULL
      GROUP BY "organizationId", "targetUrl"
      HAVING COUNT(*) >= 2
    )
    SELECT
      COUNT(*)::int AS verfolgt,
      COUNT(*) FILTER (WHERE differenz > 0.1)::int AS verbessert,
      COUNT(*) FILTER (WHERE differenz < -0.1)::int AS verschlechtert,
      COUNT(*) FILTER (WHERE ABS(differenz) <= 0.1)::int AS unveraendert,
      AVG(differenz)::float AS schnitt,
      MAX(differenz)::float AS groesste
    FROM paare
  `

  return {
    verfolgteAdressen: zeile?.verfolgt ?? 0,
    verbessert: zeile?.verbessert ?? 0,
    verschlechtert: zeile?.verschlechtert ?? 0,
    unveraendert: zeile?.unveraendert ?? 0,
    schnittVeraenderung: Math.round((zeile?.schnitt ?? 0) * 10) / 10,
    groessteVerbesserung: Math.round((zeile?.groesste ?? 0) * 10) / 10,
  }
}

/**
 * Wie rege wird das Werkzeug benutzt?
 *
 * „Verbrachte Zeit" lässt sich nicht messen, ohne mitzuprotokollieren, wann
 * wer wie lange auf welcher Seite war — genau das tut diese Anwendung
 * bewusst nicht. Was sich ehrlich sagen lässt: an wie vielen Tagen jemand
 * gearbeitet hat und wie viele Konten überhaupt aktiv sind. Das ist eine
 * Messung, keine Schätzung.
 */
export type Nutzung = {
  /** Konten mit mindestens einer Anmeldung in den letzten 30 Tagen. */
  aktiveKonten30: number
  aktiveKonten7: number
  /** Arbeitsbereiche mit mindestens einem Lauf in den letzten 30 Tagen. */
  aktiveBereiche30: number
  /** Summe der Tage, an denen irgendwo gearbeitet wurde (je Bereich gezählt). */
  arbeitstage30: number
  /** Läufe je aktivem Arbeitsbereich in 30 Tagen. */
  laeufeJeBereich: number
}

export async function nutzung(): Promise<Nutzung> {
  const vor30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const vor7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [aktiveKonten30, aktiveKonten7, laeufe] = await Promise.all([
    db.user.count({ where: { lastLoginAt: { gte: vor30 } } }),
    db.user.count({ where: { lastLoginAt: { gte: vor7 } } }),
    db.analysis.findMany({
      where: { createdAt: { gte: vor30 } },
      select: { organizationId: true, createdAt: true },
    }),
  ])

  // Ein Arbeitstag ist ein Kalendertag, an dem ein Bereich mindestens einen
  // Lauf gestartet hat — mehrere Läufe am selben Tag zählen einmal.
  const tageJeBereich = new Map<string, Set<string>>()
  for (const lauf of laeufe) {
    const tag = lauf.createdAt.toISOString().slice(0, 10)
    const bisher = tageJeBereich.get(lauf.organizationId)
    if (bisher) bisher.add(tag)
    else tageJeBereich.set(lauf.organizationId, new Set([tag]))
  }

  const aktiveBereiche30 = tageJeBereich.size
  const arbeitstage30 = [...tageJeBereich.values()].reduce((s, tage) => s + tage.size, 0)

  return {
    aktiveKonten30,
    aktiveKonten7,
    aktiveBereiche30,
    arbeitstage30,
    laeufeJeBereich: aktiveBereiche30 ? Math.round((laeufe.length / aktiveBereiche30) * 10) / 10 : 0,
  }
}
