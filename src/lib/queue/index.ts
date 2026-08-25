import { Queue, type JobsOptions } from 'bullmq'
import IORedis from 'ioredis'
import type { ModuleKey } from '@/lib/analysis/run'

export const ANALYSIS_QUEUE = 'analysis'

export type AnalysisJobData = {
  analysisId: string
  organizationId: string
  targetUrl: string
  targetKind: 'WEBSITE' | 'SOCIAL_PROFILE'
  modules: ModuleKey[]
  locationCode: number
  languageCode: string
  seedKeywords?: string[]
  competitorDomains?: string[]
  pageLimit?: number
}

/**
 * Analysen laufen in einem eigenen Prozess.
 *
 * Ein vollständiger Lauf dauert je nach Umfang eine bis mehrere Minuten – zu
 * lang für eine HTTP-Antwort. Die Weboberfläche stellt den Auftrag ein und
 * fragt den Fortschritt ab; der Worker arbeitet ihn ab.
 */
let connection: IORedis | null = null

export function redis(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    })
  }
  return connection
}

let queue: Queue<AnalysisJobData> | null = null

export function analysisQueue(): Queue<AnalysisJobData> {
  if (!queue) {
    queue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE, { connection: redis() })
  }
  return queue
}

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
  removeOnFail: { age: 30 * 24 * 3600 },
}

export async function enqueueAnalysis(data: AnalysisJobData) {
  return analysisQueue().add('run', data, DEFAULT_JOB_OPTIONS)
}
