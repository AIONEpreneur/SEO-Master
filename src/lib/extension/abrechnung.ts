import { db } from '@/lib/db'
import { reichtGuthaben, rechnetAb, KOSTEN_RECHERCHE } from '@/lib/billing/guthaben'
import { verbleibendeAnalysen } from '@/lib/billing/zugaenge'
import { extAntwort } from '@/lib/extension/cors'
import type { Organization } from '@prisma/client'

/**
 * Abrechnung der Extension-Abfragen.
 *
 * Dieselbe Logik wie bei der Keyword-Recherche in der App: Credits sind Cent
 * an Anbieterkosten, interne Arbeitsbereiche rechnen nicht ab. Die Extension
 * bekommt statt der Kostenrechnung nur eine Zahl in ihrer Sprache – wie viele
 * Abfragen noch gehen.
 */

/** Grundgebühr je Extension-Abfrage in Credits, zusätzlich zu den DataForSEO-Kosten. */
const GRUNDGEBUEHR = 1

export function guthabenReicht(organisation: Organization): boolean {
  return reichtGuthaben(organisation, 'recherche')
}

export function guthabenAntwort() {
  return extAntwort(
    {
      ok: false,
      error: 'limit_reached',
      message: 'Das Kontingent ist aufgebraucht. Bitte in SEO-Master nachsehen oder die Verwaltung fragen.',
    },
    402,
  )
}

/**
 * Verbrauch verbuchen: Nutzungssatz schreiben und – ausser im internen
 * Betrieb – das Guthaben belasten. Gibt die verbuchten Credits zurück.
 */
export async function verbucheAbfrage(
  organisation: Organization,
  operation: string,
  dataforseoKostenUsd: number,
): Promise<number> {
  const dfsCent = dataforseoKostenUsd > 0 ? Math.ceil(dataforseoKostenUsd * 100) : 0
  const gesamtCent = dfsCent + GRUNDGEBUEHR

  await db.usageRecord.create({
    data: {
      organizationId: organisation.id,
      provider: 'DATAFORSEO',
      operation,
      units: 1,
      costCredits: gesamtCent,
    },
  })

  if (rechnetAb(organisation.plan) && gesamtCent > 0) {
    await db.organization.update({
      where: { id: organisation.id },
      data: { credits: { decrement: gesamtCent } },
    })
  }

  return gesamtCent
}

/**
 * Wie viele Abfragen noch gehen – null heisst unbegrenzt (interner Betrieb).
 * `verbraucht` sind die Credits des gerade verbuchten Laufs, damit die Zahl
 * ohne erneute Datenbankabfrage stimmt.
 */
export function verbleibendeAbfragen(organisation: Organization, verbraucht = 0): number | null {
  if (!rechnetAb(organisation.plan)) return null
  return verbleibendeAnalysen(organisation.credits - verbraucht, KOSTEN_RECHERCHE)
}
