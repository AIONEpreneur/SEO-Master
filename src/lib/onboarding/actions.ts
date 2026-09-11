'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { echteSitzung } from '@/lib/auth/session'

/**
 * Merker für die Einstiegstour.
 *
 * Gespeichert wird am Konto, nicht im Browser: Wer die Tour am Rechner
 * gesehen hat, soll sie am Telefon nicht noch einmal vorgesetzt bekommen.
 */
export async function tourAbgeschlossen(): Promise<void> {
  const user = await echteSitzung()
  if (!user) return
  await db.user.update({ where: { id: user.id }, data: { tourGesehenAm: new Date() } })
  revalidatePath('/dashboard')
}

/** Die Tour erneut zeigen — aufrufbar über die Hilfe-Seite. */
export async function tourZuruecksetzen(): Promise<void> {
  const user = await echteSitzung()
  if (!user) return
  await db.user.update({ where: { id: user.id }, data: { tourGesehenAm: null } })
  revalidatePath('/dashboard')
}
