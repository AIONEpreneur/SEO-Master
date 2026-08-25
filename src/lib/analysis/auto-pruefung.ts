import { db } from '@/lib/db'
import { enqueueAnalysis } from '@/lib/queue'
import { reichtGuthaben } from '@/lib/billing/guthaben'
import type { ModuleKey } from '@/lib/analysis/run'

/**
 * Automatische Monats-Prüfung.
 *
 * Der Wert der Anwendung liegt im Verlauf – und ein Verlauf entsteht nur,
 * wenn regelmässig gemessen wird. Daran denkt niemand vier Wochen später von
 * selbst; also stellt der Worker fällige Projekte selbst wieder ein.
 *
 * Fällig ist ein Projekt mit eingeschalteter Prüfung, dessen letzter
 * automatischer Lauf 30 Tage oder länger zurückliegt. Von Hand gestartete
 * Läufe setzen die Frist nicht zurück – die Zusage lautet "mindestens einmal
 * im Monat", nicht "genau 30 Tage nach dem letzten Klick".
 */

export const PRUEF_ABSTAND_TAGE = 30

/** Bausteine des automatischen Laufs: alles ausser dem Wettbewerbsvergleich,
 *  der die teuerste Stufe ist und eine bewusste Entscheidung bleiben soll. */
const AUTO_MODULE: ModuleKey[] = ['SEO', 'AEO', 'GEO', 'SERP']

export type AutoErgebnis = { gestartet: number; uebersprungen: Array<{ projekt: string; grund: string }> }

export async function starteFaelligePruefungen(jetzt = new Date()): Promise<AutoErgebnis> {
  const stichtag = new Date(jetzt.getTime() - PRUEF_ABSTAND_TAGE * 24 * 60 * 60 * 1000)

  const faellig = await db.project.findMany({
    where: {
      autoPruefung: true,
      isArchived: false,
      OR: [{ autoZuletzt: null }, { autoZuletzt: { lte: stichtag } }],
    },
    include: { organization: { select: { id: true, plan: true, credits: true } } },
  })

  const ergebnis: AutoErgebnis = { gestartet: 0, uebersprungen: [] }

  for (const projekt of faellig) {
    // Die Guthaben-Sperre gilt auch hier – gerade hier: Ein automatischer
    // Lauf, den niemand anstösst, darf erst recht keine Kosten über das
    // Kontingent hinaus erzeugen.
    if (!reichtGuthaben(projekt.organization, 'analyse')) {
      ergebnis.uebersprungen.push({ projekt: projekt.name, grund: 'Guthaben reicht nicht' })
      continue
    }

    // Läuft zu dieser Adresse gerade etwas, wird nicht doppelt gestartet.
    const offen = await db.analysis.count({
      where: {
        organizationId: projekt.organizationId,
        targetUrl: projekt.url,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
    })
    if (offen > 0) {
      ergebnis.uebersprungen.push({ projekt: projekt.name, grund: 'Lauf steht bereits an' })
      continue
    }

    // Der Umfang folgt dem letzten Lauf derselben Adresse: Wer die Website
    // einmal vollständig geprüft hat, bekommt sie auch monatlich vollständig.
    const letzter = await db.analysis.findFirst({
      where: { organizationId: projekt.organizationId, targetUrl: projekt.url, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { pageLimit: true },
    })
    const pageLimit = letzter?.pageLimit ?? 1

    const analyse = await db.analysis.create({
      data: {
        organizationId: projekt.organizationId,
        projectId: projekt.id,
        // Kein createdById: Der Lauf kam von der Anwendung, nicht von einer Person.
        targetUrl: projekt.url,
        targetKind: projekt.kind,
        modules: AUTO_MODULE,
        status: 'QUEUED',
        pageLimit,
        locationCode: projekt.locationCode,
        languageCode: projekt.languageCode,
        seedKeywords: [],
      },
    })

    await enqueueAnalysis({
      analysisId: analyse.id,
      organizationId: projekt.organizationId,
      targetUrl: projekt.url,
      targetKind: projekt.kind,
      modules: AUTO_MODULE,
      locationCode: projekt.locationCode,
      languageCode: projekt.languageCode,
      pageLimit,
    })

    await db.project.update({ where: { id: projekt.id }, data: { autoZuletzt: jetzt } })
    ergebnis.gestartet++
  }

  return ergebnis
}
