'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'

/**
 * Befund abhaken oder das Häkchen zurücknehmen.
 *
 * Gespeichert je (Organisation, Adresse, Befund-Kennung), nicht je Analyse:
 * Ein Häkchen soll den nächsten Lauf überleben. requireRole sperrt zugleich
 * die Fremdansicht – wer nur zusieht, hakt nichts ab.
 */
export async function hakeBefundAbAction(formData: FormData): Promise<void> {
  const session = await requireRole('MEMBER')
  const targetUrl = String(formData.get('targetUrl') ?? '').slice(0, 2000)
  const findingId = String(formData.get('findingId') ?? '').slice(0, 200)
  const analysisId = String(formData.get('analysisId') ?? '')
  if (!targetUrl || !findingId) return

  const schluessel = {
    organizationId: session.organizationId,
    targetUrl,
    findingId,
  }

  const vorhanden = await db.erledigterBefund.findUnique({
    where: { organizationId_targetUrl_findingId: schluessel },
  })

  if (vorhanden) {
    await db.erledigterBefund.delete({ where: { id: vorhanden.id } })
  } else {
    await db.erledigterBefund.create({ data: { ...schluessel, erledigtVonId: session.id } })
  }

  revalidatePath(`/analyses/${analysisId}`)
}
