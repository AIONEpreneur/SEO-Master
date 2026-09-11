'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'

export async function deleteRankingLookupAction(formData: FormData) {
  const session = await requireRole('MEMBER')
  const id = String(formData.get('id'))
  // Über organizationId mitfiltern, damit eine geratene ID keine fremde
  // Abfrage löschen kann.
  await db.rankingLookup.deleteMany({ where: { id, organizationId: session.organizationId } })
  revalidatePath('/rankings')
}
