import { Worker, type Job } from 'bullmq'
import { db } from '@/lib/db'
import { redis, ANALYSIS_QUEUE, type AnalysisJobData } from '@/lib/queue'
import { runAnalysis } from '@/lib/analysis/run'
import { starteFaelligePruefungen } from '@/lib/analysis/auto-pruefung'
import { randomToken } from '@/lib/crypto/vault'

/**
 * Worker-Prozess.
 *
 * Läuft getrennt von der Weboberfläche (eigener Container). Damit blockieren
 * lange Analysen weder das Ausliefern der Seiten noch werden sie von einem
 * Neustart der Weboberfläche unterbrochen.
 */

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2)

const worker = new Worker<AnalysisJobData>(
  ANALYSIS_QUEUE,
  async (job: Job<AnalysisJobData>) => {
    const { analysisId } = job.data
    console.log(`[worker] Analyse ${analysisId} startet: ${job.data.targetUrl}`)

    // Ein bereits abgebrochener Auftrag darf gar nicht erst anlaufen: Zwischen
    // dem Abbruch und dem Anlaufen können Sekunden liegen.
    if (await istAbgebrochen(analysisId)) {
      console.log(`[worker] Analyse ${analysisId} war abgebrochen, wird übersprungen`)
      return { abgebrochen: true }
    }

    await db.analysis.update({
      where: { id: analysisId },
      data: { status: 'RUNNING', startedAt: new Date(), progress: 5, currentStep: 'Vorbereitung', error: null },
    })

    try {
      const { result, report, raw } = await runAnalysis({
        ...job.data,
        onStep: async (currentStep, progress) => {
          // Zwischen zwei Schritten ist der einzige Punkt, an dem sich ein
          // laufender Auftrag geordnet beenden lässt – ein laufender Netzabruf
          // ist von aussen nicht zu unterbrechen.
          if (await istAbgebrochen(analysisId)) throw new AbbruchFehler()
          await db.analysis.update({ where: { id: analysisId }, data: { currentStep, progress } })
          await job.updateProgress(progress)
        },
      })

      // Letzte Prüfung vor dem Schreiben: Der Abbruch kann während des
      // letzten Schrittes erfolgt sein. Das Ergebnis würde den Abbruch sonst
      // überschreiben und der Lauf sähe aus, als sei nichts geschehen.
      if (await istAbgebrochen(analysisId)) throw new AbbruchFehler()

      await db.$transaction([
        db.analysis.update({
          where: { id: analysisId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            currentStep: 'Abgeschlossen',
            finishedAt: new Date(),
            scoreSeo: result.scores.seo,
            scoreAeo: result.scores.aeo,
            scoreGeo: result.scores.geo,
            scoreSerp: result.scores.serp,
            scoreOverall: result.scores.overall,
            result: result as never,
            rawData: raw as never,
          },
        }),
        db.report.create({
          data: {
            analysisId,
            title: `Sichtbarkeitsanalyse ${result.target.domain ?? result.target.url}`,
            markdown: report.markdown,
            summary: report.summary,
            shareToken: randomToken(16),
          },
        }),
      ])

      console.log(`[worker] Analyse ${analysisId} fertig (${result.scores.overall}/10)`)
      return { overall: result.scores.overall }
    } catch (error) {
      // Ein Abbruch ist kein Fehlschlag: Der Status steht bereits, und ein
      // Wiederholungsversuch wäre genau das Gegenteil des Gewünschten.
      if (error instanceof AbbruchFehler) {
        console.log(`[worker] Analyse ${analysisId} wurde abgebrochen`)
        return { abgebrochen: true }
      }

      const messageText = error instanceof Error ? error.message : 'Unbekannter Fehler'
      console.error(`[worker] Analyse ${analysisId} fehlgeschlagen:`, messageText)

      // Nur beim letzten Versuch endgültig als fehlgeschlagen markieren –
      // sonst würde die Oberfläche einen Fehler zeigen, obwohl noch ein
      // Wiederholungsversuch aussteht.
      const isFinalAttempt = (job.attemptsMade ?? 0) + 1 >= (job.opts.attempts ?? 1)
      await db.analysis.update({
        where: { id: analysisId },
        data: {
          status: isFinalAttempt ? 'FAILED' : 'QUEUED',
          error: messageText.slice(0, 1000),
          currentStep: isFinalAttempt ? 'Fehlgeschlagen' : 'Wiederholung geplant',
          finishedAt: isFinalAttempt ? new Date() : null,
        },
      })
      throw error
    }
  },
  {
    connection: redis(),
    concurrency: CONCURRENCY,
    // Ein Lauf mit vielen Wettbewerbern kann länger dauern; danach gilt er
    // als hängend und wird erneut eingestellt.
    lockDuration: 15 * 60 * 1000,
  },
)

worker.on('failed', (job, error) => {
  console.error(`[worker] Auftrag ${job?.id} fehlgeschlagen:`, error.message)
})

worker.on('completed', (job) => {
  console.log(`[worker] Auftrag ${job.id} abgeschlossen`)
})

console.log(`[worker] Bereit. Nebenläufigkeit: ${CONCURRENCY}`)

/**
 * Stündliche Prüfung auf fällige automatische Läufe.
 *
 * Ein schlichter Zeitgeber statt einer BullMQ-Wiederholung: Er braucht keinen
 * eigenen Auftragstyp, überlebt Redis-Aufräumläufe und die Fälligkeit steht
 * ohnehin in der Datenbank (autoZuletzt), nicht in der Warteschlange. Läuft
 * der Worker beim Fälligkeitstermin gerade nicht, holt die nächste Stunde
 * das nach – für einen Monatsrhythmus ist eine Stunde Versatz bedeutungslos.
 */
const PRUEF_INTERVALL_MS = 60 * 60 * 1000
async function pruefeAutomatik() {
  try {
    const ergebnis = await starteFaelligePruefungen()
    if (ergebnis.gestartet > 0 || ergebnis.uebersprungen.length > 0) {
      console.log(
        `[worker] Automatik: ${ergebnis.gestartet} gestartet` +
          (ergebnis.uebersprungen.length > 0
            ? `, übersprungen: ${ergebnis.uebersprungen.map((u) => `${u.projekt} (${u.grund})`).join(', ')}`
            : ''),
      )
    }
  } catch (error) {
    console.error('[worker] Automatik fehlgeschlagen:', error instanceof Error ? error.message : error)
  }
}
void pruefeAutomatik()
const automatik = setInterval(() => void pruefeAutomatik(), PRUEF_INTERVALL_MS)

class AbbruchFehler extends Error {
  constructor() {
    super('Der Lauf wurde abgebrochen.')
    this.name = 'AbbruchFehler'
  }
}

async function istAbgebrochen(analysisId: string): Promise<boolean> {
  const analyse = await db.analysis.findUnique({
    where: { id: analysisId },
    select: { status: true },
  })
  return analyse?.status === 'CANCELLED'
}

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} empfangen, fahre herunter…`)
  clearInterval(automatik)
  await worker.close()
  await db.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
