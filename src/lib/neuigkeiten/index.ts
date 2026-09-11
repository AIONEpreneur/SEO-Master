import { db } from '@/lib/db'
import type { NeuigkeitArt } from '@prisma/client'

/**
 * Neuigkeiten — was sich in der Anwendung geändert hat.
 *
 * Der Zweck ist nicht Werbung, sondern Verlässlichkeit: Wer eine Woche nicht
 * da war und plötzlich einen neuen Knopf vorfindet, soll nachlesen können,
 * woher er kommt. Deshalb gibt es beides — die Meldung beim Anmelden und die
 * Liste zum Nachschlagen. Eine Meldung allein verschwindet mit dem Klick.
 */

export const ART_LABEL: Record<NeuigkeitArt, string> = {
  NEU: 'Neu',
  VERBESSERT: 'Verbessert',
  BEHOBEN: 'Behoben',
}

/** Die Farben der Vorlage, je Art eine. */
export const ART_FARBE: Record<NeuigkeitArt, string> = {
  NEU: 'bg-limette',
  VERBESSERT: 'bg-blau',
  BEHOBEN: 'bg-orange',
}

/**
 * Ab wann gilt etwas als ungelesen?
 *
 * Beim allerersten Mal ist der Merker leer. Dann gilt der Beginn der
 * Mitgliedschaft — sonst bekäme jemand, der sich heute anmeldet, die
 * gesammelte Änderungshistorie von zwei Jahren als Begrüssung vorgesetzt.
 */
function stichtag(user: { neuigkeitenGesehenAm: Date | null; createdAt: Date }): Date {
  return user.neuigkeitenGesehenAm ?? user.createdAt
}

export type NeuigkeitAnzeige = {
  id: string
  art: NeuigkeitArt
  titel: string
  text: string
  veroeffentlichtAm: Date
}

/** Alles, was seit dem letzten Hinsehen dazugekommen ist. */
export async function ungeleseneNeuigkeiten(user: {
  neuigkeitenGesehenAm: Date | null
  createdAt: Date
}): Promise<NeuigkeitAnzeige[]> {
  return db.neuigkeit.findMany({
    where: {
      veroeffentlichtAm: { gt: stichtag(user), lte: new Date() },
    },
    orderBy: { veroeffentlichtAm: 'desc' },
    // Mehr als fünf liest im Aufsteller niemand. Der Rest steht in der Liste.
    take: 5,
    select: { id: true, art: true, titel: true, text: true, veroeffentlichtAm: true },
  })
}

/** Die vollständige Historie — für die Seite, nicht für den Aufsteller. */
export async function alleNeuigkeiten(): Promise<NeuigkeitAnzeige[]> {
  return db.neuigkeit.findMany({
    where: { veroeffentlichtAm: { lte: new Date() } },
    orderBy: { veroeffentlichtAm: 'desc' },
    take: 100,
    select: { id: true, art: true, titel: true, text: true, veroeffentlichtAm: true },
  })
}

/** Wie viele ungelesen sind — für die Zahl in der Seitenleiste. */
export async function anzahlUngelesen(user: {
  neuigkeitenGesehenAm: Date | null
  createdAt: Date
}): Promise<number> {
  return db.neuigkeit.count({
    where: { veroeffentlichtAm: { gt: stichtag(user), lte: new Date() } },
  })
}
