import { Worker, type Job } from 'bullmq'
import { db } from '@/lib/db'
import { redis, ANALYSIS_QUEUE, type AnalysisJobData } from '@/lib/queue'
import { runAnalysis } from '@/lib/analysis/run'
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

    await db.analysis.update({
      where: { id: analysisId },
      data: { status: 'RUNNING', startedAt: new Date(), progress: 5, currentStep: 'Vorbereitung', error: null },
    })

    try {
      const { result, report, raw } = await runAnalysis({
        ...job.data,
        onStep: async (currentStep, progress) => {
          await db.analysis.update({ where: { id: analysisId }, data: { currentStep, progress } })
          await job.updateProgress(progress)
        },
      })

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

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} empfangen, fahre herunter…`)
  await worker.close()
  await db.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
