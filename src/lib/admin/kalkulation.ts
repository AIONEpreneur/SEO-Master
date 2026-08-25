import { db } from '@/lib/db'

/**
 * Mischkalkulation.
 *
 * Die Anwendung rechnet immer über die Zugangsdaten des Betriebs ab – niemand
 * hinterlegt eigene. Jeder Lauf einer Kundin ist damit eine Position auf der
 * eigenen Anbieterrechnung. Ein Monatspreis, der das nicht deckt, verliert mit
 * jeder aktiven Kundin mehr Geld, und zwar genau bei den Kundinnen, die das
 * Werkzeug am meisten nutzen.
 *
 * Gerechnet wird deshalb mit den tatsächlich verbuchten Kosten, nicht mit
 * Annahmen: creditsUsed steht je Lauf fest und entspricht einem US-Cent.
 *
 * Wichtig ist neben dem Mittelwert der teuerste Lauf. Der Mittelwert sagt, was
 * es üblicherweise kostet; der teuerste sagt, was passieren kann, wenn jemand
 * eine grosse Seite mit allen Bausteinen prüft.
 */

export type Kostenlage = {
  /** Wie viele abgerechnete Läufe der Rechnung zugrunde liegen. */
  grundlage: number
  durchschnittCent: number
  medianCent: number
  teuersterCent: number
  /** 90 % der Läufe kosten höchstens so viel. */
  obereGrenzeCent: number
  gesamtCent: number

  /** Analysen je aktivem Arbeitsbereich und Monat, über die letzten 90 Tage. */
  laeufeJeBereichImMonat: number
  aktiveBereiche: number
}

export async function kostenlage(): Promise<Kostenlage> {
  const vor90Tagen = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const [abgerechnet, letzte90Tage] = await Promise.all([
    db.analysis.findMany({
      where: { status: 'COMPLETED', creditsUsed: { gt: 0 } },
      select: { creditsUsed: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    db.analysis.groupBy({
      by: ['organizationId'],
      where: { status: 'COMPLETED', createdAt: { gte: vor90Tagen } },
      _count: { _all: true },
    }),
  ])

  const kosten = abgerechnet.map((a) => a.creditsUsed).sort((a, b) => a - b)
  const gesamtCent = kosten.reduce((s, c) => s + c, 0)

  const aktiveBereiche = letzte90Tage.length
  const laeufeGesamt = letzte90Tage.reduce((s, g) => s + g._count._all, 0)

  return {
    grundlage: kosten.length,
    durchschnittCent: kosten.length ? Math.round(gesamtCent / kosten.length) : 0,
    medianCent: quantil(kosten, 0.5),
    obereGrenzeCent: quantil(kosten, 0.9),
    teuersterCent: kosten.length ? kosten[kosten.length - 1] : 0,
    gesamtCent,
    aktiveBereiche,
    // Drei Monate Beobachtung, umgerechnet auf einen Monat.
    laeufeJeBereichImMonat: aktiveBereiche ? Math.round(laeufeGesamt / aktiveBereiche / 3) : 0,
  }
}

function quantil(sortiert: number[], anteil: number): number {
  if (sortiert.length === 0) return 0
  const index = Math.min(sortiert.length - 1, Math.floor(sortiert.length * anteil))
  return sortiert[index]
}

/**
 * Deckungsrechnung für einen Monatspreis.
 *
 * Alle Beträge in Cent. Der Preis wird netto gerechnet – die Umsatzsteuer ist
 * durchlaufender Posten und gehört nicht in die Marge.
 */
export type Deckung = {
  /** Wie viele Analysen der Preis trägt, bis nichts mehr übrig bleibt. */
  gedeckteLaeufe: number
  /** Dasselbe, aber mit dem teuren Fall gerechnet statt mit dem Mittelwert. */
  gedeckteLaeufeUngunst: number
  /** Was bei der erwarteten Nutzung übrig bleibt, in Cent. */
  margeCent: number
  margeAnteil: number
  traegtSich: boolean
}

export function deckung(input: {
  preisCent: number
  kostenJeLaufCent: number
  ungunstJeLaufCent: number
  laeufeImMonat: number
}): Deckung {
  const { preisCent, kostenJeLaufCent, ungunstJeLaufCent, laeufeImMonat } = input

  const kosten = kostenJeLaufCent * laeufeImMonat
  const margeCent = preisCent - kosten

  return {
    gedeckteLaeufe: kostenJeLaufCent > 0 ? Math.floor(preisCent / kostenJeLaufCent) : Infinity,
    gedeckteLaeufeUngunst: ungunstJeLaufCent > 0 ? Math.floor(preisCent / ungunstJeLaufCent) : Infinity,
    margeCent,
    margeAnteil: preisCent > 0 ? margeCent / preisCent : 0,
    traegtSich: margeCent >= 0,
  }
}

/**
 * Wie viele Analysen ein Tarif enthalten darf, damit eine Zielmarge bleibt.
 *
 * Gerechnet wird mit dem ungünstigen Fall, nicht mit dem Mittelwert: Ein
 * Kontingent ist ein Versprechen, und wer es ausschöpft, tut das meist mit
 * grossen Seiten.
 */
export function empfohlenesKontingent(input: {
  preisCent: number
  ungunstJeLaufCent: number
  zielmarge: number
}): number {
  const { preisCent, ungunstJeLaufCent, zielmarge } = input
  if (ungunstJeLaufCent <= 0) return 0
  const verfuegbar = preisCent * (1 - zielmarge)
  return Math.max(0, Math.floor(verfuegbar / ungunstJeLaufCent))
}
