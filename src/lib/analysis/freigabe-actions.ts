'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { randomToken } from '@/lib/crypto/vault'

/**
 * Freigabe-Link widerrufen oder neu ausstellen.
 *
 * Widerrufen setzt den Schlüssel auf null – alle verschickten Links sind
 * damit sofort tot. Neu ausstellen erzeugt einen frischen Schlüssel; die
 * alten Links bleiben tot. Es gibt absichtlich kein "denselben Link wieder
 * aktivieren": Wer widerruft, will genau das.
 */
export async function widerrufeFreigabeAction(formData: FormData): Promise<void> {
  const session = await requireRole('MEMBER')
  const reportId = String(formData.get('reportId') ?? '')
  const analysisId = String(formData.get('analysisId') ?? '')

  await db.report.updateMany({
    where: { id: reportId, analysis: { organizationId: session.organizationId } },
    data: { shareToken: null },
  })
  revalidatePath(`/analyses/${analysisId}`)
}

export async function erstelleFreigabeAction(formData: FormData): Promise<void> {
  const session = await requireRole('MEMBER')
  const reportId = String(formData.get('reportId') ?? '')
  const analysisId = String(formData.get('analysisId') ?? '')

  await db.report.updateMany({
    where: { id: reportId, analysis: { organizationId: session.organizationId } },
    data: { shareToken: randomToken(16) },
  })
  revalidatePath(`/analyses/${analysisId}`)
}
