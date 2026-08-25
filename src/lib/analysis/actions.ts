'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireSession, requireRole } from '@/lib/auth/session'
import { enqueueAnalysis, analysisQueue } from '@/lib/queue'
import { availableProviders } from '@/lib/connectors/credentials'
import { reichtGuthaben, guthabenHinweis } from '@/lib/billing/guthaben'
import { siehtAbrechnung } from '@/lib/billing/zugaenge'
import { detectPlatform } from '@/lib/connectors/apify'
import type { ModuleKey } from './run'

const MODULE_KEYS = ['SEO', 'AEO', 'GEO', 'SERP', 'COMPETITORS'] as const

const schema = z.object({
  url: z.string().url('Bitte eine vollständige URL inklusive https:// angeben.'),
  modules: z.array(z.enum(MODULE_KEYS)).min(1, 'Mindestens einen Baustein auswählen.'),
  locationCode: z.coerce.number().int().positive(),
  languageCode: z.string().min(2).max(5),
  projectId: z.string().optional(),
  seedKeywords: z.array(z.string()).optional(),
  competitorDomains: z.array(z.string()).optional(),
})

export type StartState = { error?: string }

export async function startAnalysisAction(_prev: StartState, formData: FormData): Promise<StartState> {
  const session = await requireRole('MEMBER')

  const parsed = schema.safeParse({
    url: String(formData.get('url') ?? '').trim(),
    modules: formData.getAll('modules').map(String),
    locationCode: formData.get('locationCode') ?? 2276,
    languageCode: String(formData.get('languageCode') ?? 'de'),
    projectId: (formData.get('projectId') as string) || undefined,
    seedKeywords: splitList(formData.get('seedKeywords')),
    competitorDomains: splitList(formData.get('competitorDomains')).map(stripToDomain),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { url, modules, locationCode, languageCode } = parsed.data
  // Ein Social-Link wird als Profil behandelt, unabhängig von der Auswahl –
  // die Website-Bausteine sind darauf nicht anwendbar.
  const platform = detectPlatform(url)
  const targetKind = platform ? 'SOCIAL_PROFILE' : 'WEBSITE'

  // Ohne mindestens einen Anbieter kommt kein belastbares Ergebnis zustande.
  const providers = await availableProviders(session.organizationId)
  if (targetKind === 'SOCIAL_PROFILE' && !providers.APIFY) {
    return { error: 'Für Social-Profile werden Apify-Zugangsdaten benötigt. Bitte im Datentresor hinterlegen.' }
  }
  if (targetKind === 'WEBSITE' && (modules.includes('SERP') || modules.includes('COMPETITORS')) && !providers.DATAFORSEO) {
    return {
      error:
        'SERP- und Wettbewerbsanalyse brauchen DataForSEO-Zugangsdaten. Bitte im Datentresor hinterlegen oder diese Bausteine abwählen.',
    }
  }

  const organization = await db.organization.findUniqueOrThrow({ where: { id: session.organizationId } })
  if (!reichtGuthaben(organization, 'analyse')) {
    return { error: guthabenHinweis(organization, 'analyse', { mitZahlen: siehtAbrechnung(session) }) }
  }

  const analysis = await db.analysis.create({
    data: {
      organizationId: session.organizationId,
      projectId: parsed.data.projectId || null,
      createdById: session.id,
      targetUrl: url,
      targetKind,
      modules: targetKind === 'SOCIAL_PROFILE' ? ['SOCIAL'] : modules,
      status: 'QUEUED',
      currentStep: 'In Warteschlange',
      locationCode,
      languageCode,
      seedKeywords: parsed.data.seedKeywords?.filter(Boolean) ?? [],
      competitorDomains: parsed.data.competitorDomains?.filter(Boolean) ?? [],
    },
  })

  const job = await enqueueAnalysis({
    analysisId: analysis.id,
    organizationId: session.organizationId,
    targetUrl: url,
    targetKind,
    modules: modules as ModuleKey[],
    locationCode,
    languageCode,
    seedKeywords: parsed.data.seedKeywords?.filter(Boolean),
    competitorDomains: parsed.data.competitorDomains?.filter(Boolean),
  })

  await db.analysis.update({ where: { id: analysis.id }, data: { jobId: String(job.id) } })
  await db.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.id,
      action: 'analysis.start',
      target: url,
      metadata: { modules, analysisId: analysis.id },
    },
  })

  redirect(`/analyses/${analysis.id}`)
}

/**
 * Einen laufenden oder wartenden Auftrag abbrechen.
 *
 * Zwei Fälle: Wartet der Auftrag noch, lässt er sich aus der Warteschlange
 * entfernen. Läuft er bereits, ist ein laufender Netzabruf nicht von aussen
 * zu unterbrechen – dann wird der Status gesetzt, und der Worker beendet den
 * Lauf beim nächsten Zwischenschritt von selbst.
 *
 * Der Status wird in beiden Fällen sofort gesetzt: Ein Lauf, der sich nicht
 * mehr meldet, darf die Oberfläche nicht dauerhaft blockieren.
 */
export async function cancelAnalysisAction(formData: FormData) {
  const session = await requireRole('MEMBER')
  const id = String(formData.get('id'))

  const analysis = await db.analysis.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, jobId: true, status: true },
  })
  if (!analysis) return
  if (analysis.status === 'COMPLETED' || analysis.status === 'CANCELLED') return

  if (analysis.jobId) {
    try {
      const job = await analysisQueue().getJob(analysis.jobId)
      // remove() verweigert den Dienst bei einem laufenden Auftrag; das ist
      // kein Fehlerfall, sondern der zweite der beiden Fälle oben.
      if (job) await job.remove()
    } catch {
      // Der Statuswechsel unten genügt.
    }
  }

  await db.analysis.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      currentStep: 'Abgebrochen',
      error: 'Der Lauf wurde abgebrochen.',
      finishedAt: new Date(),
    },
  })

  await db.auditLog.create({
    data: { organizationId: session.organizationId, userId: session.id, action: 'analysis.cancel', target: id },
  })

  revalidatePath(`/analyses/${id}`)
  revalidatePath('/analyses')
}

/**
 * Einen Lauf mit denselben Einstellungen erneut starten.
 *
 * Bewusst als neuer Datensatz: Das Ergebnis eines früheren Laufs zu
 * überschreiben würde den Vergleich über die Zeit zerstören, der der
 * eigentliche Zweck wiederholter Analysen ist.
 */
export async function restartAnalysisAction(formData: FormData) {
  const session = await requireRole('MEMBER')
  const id = String(formData.get('id'))

  const alt = await db.analysis.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!alt) return

  const organization = await db.organization.findUniqueOrThrow({ where: { id: session.organizationId } })
  if (!reichtGuthaben(organization, 'analyse')) return

  const neu = await db.analysis.create({
    data: {
      organizationId: session.organizationId,
      projectId: alt.projectId,
      createdById: session.id,
      targetUrl: alt.targetUrl,
      targetKind: alt.targetKind,
      modules: alt.modules,
      status: 'QUEUED',
      currentStep: 'In Warteschlange',
      locationCode: alt.locationCode,
      languageCode: alt.languageCode,
      seedKeywords: alt.seedKeywords,
      competitorDomains: alt.competitorDomains,
    },
  })

  const job = await enqueueAnalysis({
    analysisId: neu.id,
    organizationId: session.organizationId,
    targetUrl: alt.targetUrl,
    targetKind: alt.targetKind,
    modules: alt.modules as ModuleKey[],
    locationCode: alt.locationCode,
    languageCode: alt.languageCode,
    seedKeywords: alt.seedKeywords,
    competitorDomains: alt.competitorDomains,
  })

  await db.analysis.update({ where: { id: neu.id }, data: { jobId: String(job.id) } })
  redirect(`/analyses/${neu.id}`)
}

export async function deleteAnalysisAction(formData: FormData) {
  const session = await requireRole('MEMBER')
  const id = String(formData.get('id'))
  // Über organizationId mitfiltern: sonst könnte eine fremde Analyse
  // gelöscht werden, wenn jemand eine ID errät.
  await db.analysis.deleteMany({ where: { id, organizationId: session.organizationId } })
  revalidatePath('/analyses')
}

export async function createProjectAction(_prev: StartState, formData: FormData): Promise<StartState> {
  const session = await requireRole('MEMBER')
  const url = String(formData.get('url') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()

  if (!name) return { error: 'Bitte einen Namen angeben.' }
  let domain: string | null = null
  try {
    domain = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return { error: 'Bitte eine vollständige URL inklusive https:// angeben.' }
  }

  const platform = detectPlatform(url)
  await db.project.create({
    data: {
      organizationId: session.organizationId,
      name,
      url,
      domain,
      kind: platform ? 'SOCIAL_PROFILE' : 'WEBSITE',
      locationCode: Number(formData.get('locationCode') ?? 2276),
      languageCode: String(formData.get('languageCode') ?? 'de'),
      description: String(formData.get('description') ?? '').trim() || null,
    },
  })

  revalidatePath('/projects')
  return {}
}

export async function deleteProjectAction(formData: FormData) {
  const session = await requireRole('ADMIN')
  const id = String(formData.get('id'))
  await db.project.deleteMany({ where: { id, organizationId: session.organizationId } })
  revalidatePath('/projects')
}

export async function addCompetitorAction(formData: FormData) {
  await requireSession()
  const session = await requireRole('MEMBER')
  const projectId = String(formData.get('projectId'))
  const url = String(formData.get('url') ?? '').trim()

  const project = await db.project.findFirst({ where: { id: projectId, organizationId: session.organizationId } })
  if (!project) return

  let domain: string
  try {
    domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return
  }

  await db.competitor.upsert({
    where: { projectId_domain: { projectId, domain } },
    create: { projectId, domain, url: url.startsWith('http') ? url : `https://${domain}`, isAuto: false },
    update: {},
  })
  revalidatePath('/competitors')
}

export async function removeCompetitorAction(formData: FormData) {
  const session = await requireRole('MEMBER')
  const id = String(formData.get('id'))
  // Zugehörigkeit über das Projekt prüfen.
  const competitor = await db.competitor.findFirst({
    where: { id, project: { organizationId: session.organizationId } },
  })
  if (competitor) await db.competitor.delete({ where: { id } })
  revalidatePath('/competitors')
}

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(/[\n,;]/)
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 10)
}

function stripToDomain(value: string): string {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}
