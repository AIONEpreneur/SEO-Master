'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { resolveSecret } from '@/lib/connectors/credentials'
import { DataForSeoClient, type KeywordEintrag } from '@/lib/connectors/dataforseo'
import type { DataForSeoSecret } from '@/lib/connectors/credentials'
import { ConnectorError } from '@/lib/connectors/http'
import { fuehreZusammen, fasseZusammen } from './research'

/**
 * Grundgebühr einer Recherche in Credits (1 Credit = 1 US-Cent).
 *
 * Deutlich niedriger als bei einer Analyse: Es fallen zwei Abfragen an, kein
 * Seitenabruf und kein erzeugter Berichtstext.
 */
const GRUNDGEBUEHR = 1

const schema = z.object({
  seed: z
    .string()
    .min(2, 'Bitte einen Suchbegriff eingeben.')
    .max(80, 'Der Begriff ist zu lang – bis zu 80 Zeichen sind möglich.'),
  locationCode: z.coerce.number().int().positive(),
  languageCode: z.string().min(2).max(5),
})

export type ResearchState = { error?: string }

export async function startKeywordResearchAction(
  _prev: ResearchState,
  formData: FormData,
): Promise<ResearchState> {
  const session = await requireRole('MEMBER')

  const parsed = schema.safeParse({
    seed: String(formData.get('seed') ?? '').trim(),
    locationCode: formData.get('locationCode') ?? 2276,
    languageCode: String(formData.get('languageCode') ?? 'de'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { seed, locationCode, languageCode } = parsed.data

  const secret = await resolveSecret<DataForSeoSecret>(session.organizationId, 'DATAFORSEO')
  if (!secret) {
    return { error: 'Die Keyword-Recherche braucht DataForSEO-Zugangsdaten. Bitte im Datentresor hinterlegen.' }
  }

  const organization = await db.organization.findUniqueOrThrow({ where: { id: session.organizationId } })
  if (organization.plan !== 'INTERNAL' && organization.credits <= 0) {
    return { error: 'Das Guthaben ist aufgebraucht. Bitte aufladen, um weitere Recherchen zu starten.' }
  }

  const client = new DataForSeoClient(secret)
  const roh: KeywordEintrag[] = []
  let quellenFehler: string | null = null

  // Zwei Quellen: Begriffe, die den Ausgangsbegriff enthalten, und Begriffe
  // aus "Ähnliche Suchanfragen". Die zweite ist die Ergänzung, nicht die
  // Grundlage – schlägt sie fehl, ist das Ergebnis trotzdem brauchbar.
  try {
    const vorschlaege = await client.keywordSuggestions({ keyword: seed, locationCode, languageCode, limit: 200 })
    roh.push(...(vorschlaege?.items ?? []))
  } catch (error) {
    return {
      error:
        error instanceof ConnectorError
          ? `Die Abfrage ist fehlgeschlagen: ${error.message}`
          : 'Die Abfrage ist fehlgeschlagen. Bitte später erneut versuchen.',
    }
  }

  try {
    const verwandt = await client.relatedKeywords({ keyword: seed, locationCode, languageCode, limit: 100 })
    roh.push(...(verwandt?.items ?? []).map((i) => i.keyword_data ?? {}))
  } catch (error) {
    quellenFehler = error instanceof ConnectorError ? error.message : 'nicht erreichbar'
  }

  const zeilen = fuehreZusammen(roh)
  if (zeilen.length === 0) {
    return {
      error: `Zu "${seed}" liegen keine Begriffe mit messbarem Suchvolumen vor. Oft hilft ein allgemeinerer Begriff.`,
    }
  }

  const summary = { ...fasseZusammen(zeilen), quellenFehler }

  // Kosten: was DataForSEO für diesen Lauf berechnet hat, plus Grundgebühr.
  const dfsCent = client.totalCost > 0 ? Math.ceil(client.totalCost * 100) : 0
  const gesamtCent = dfsCent + GRUNDGEBUEHR

  const research = await db.keywordResearch.create({
    data: {
      organizationId: session.organizationId,
      createdById: session.id,
      seed,
      locationCode,
      languageCode,
      rows: zeilen,
      summary,
      creditsUsed: gesamtCent,
    },
  })

  await db.usageRecord.create({
    data: {
      organizationId: session.organizationId,
      provider: 'DATAFORSEO',
      operation: 'keyword-research',
      units: 1,
      costCredits: gesamtCent,
    },
  })

  if (organization.plan !== 'INTERNAL' && gesamtCent > 0) {
    await db.organization.update({
      where: { id: session.organizationId },
      data: { credits: { decrement: gesamtCent } },
    })
  }

  await db.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.id,
      action: 'keywords.research',
      target: seed,
      metadata: { researchId: research.id, begriffe: zeilen.length },
    },
  })

  redirect(`/keywords/${research.id}`)
}

export async function deleteKeywordResearchAction(formData: FormData) {
  const session = await requireRole('MEMBER')
  const id = String(formData.get('id'))
  // Über organizationId mitfiltern, damit eine geratene ID keine fremde
  // Recherche löschen kann.
  await db.keywordResearch.deleteMany({ where: { id, organizationId: session.organizationId } })
  revalidatePath('/keywords')
}
