"use server"

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'

/**
 * Monatliche Prüfung eines Projekts ein- oder ausschalten.
 *
 * Beim Einschalten bleibt autoZuletzt unberührt: Gab es noch nie einen
 * automatischen Lauf, ist das Projekt sofort fällig und der Worker startet
 * innerhalb der nächsten Stunde – die Person sieht also umgehend, dass der
 * Schalter etwas tut, statt vier Wochen auf das erste Lebenszeichen zu warten.
 */
export async function schalteAutoPruefungAction(formData: FormData): Promise<void> {
  const session = await requireRole('MEMBER')
  const id = String(formData.get('id') ?? '')

  const projekt = await db.project.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { autoPruefung: true },
  })
  if (!projekt) return

  await db.project.update({ where: { id }, data: { autoPruefung: !projekt.autoPruefung } })
  revalidatePath('/projects')
}
