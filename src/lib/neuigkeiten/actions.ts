'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { echteSitzung } from '@/lib/auth/session'
import { requireSuperAdmin } from '@/lib/admin/wache'

/**
 * Gelesen-Merker und Pflege der Einträge.
 *
 * Der Merker hängt am Konto, nicht am Browser: Wer die Meldung am Rechner
 * weggeklickt hat, soll sie am Telefon nicht noch einmal vorgesetzt bekommen.
 */

export async function neuigkeitenGelesen(): Promise<void> {
  const user = await echteSitzung()
  if (!user) return
  await db.user.update({
    where: { id: user.id },
    data: { neuigkeitenGesehenAm: new Date() },
  })
  revalidatePath('/dashboard')
  revalidatePath('/neuigkeiten')
}

const eintrag = z.object({
  titel: z.string().trim().min(3, 'Bitte einen Titel angeben.').max(120, 'Der Titel ist zu lang.'),
  text: z.string().trim().min(10, 'Bitte zwei, drei Sätze schreiben.').max(2000, 'Das ist zu lang.'),
  art: z.enum(['NEU', 'VERBESSERT', 'BEHOBEN']),
})

export type NeuigkeitState = { ok?: string; error?: string }

export async function legeNeuigkeitAn(
  _prev: NeuigkeitState,
  formData: FormData,
): Promise<NeuigkeitState> {
  const session = await requireSuperAdmin()

  const parsed = eintrag.safeParse({
    titel: String(formData.get('titel') ?? ''),
    text: String(formData.get('text') ?? ''),
    art: String(formData.get('art') ?? 'NEU'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await db.neuigkeit.create({
    data: { ...parsed.data, verfasstVonId: session.id },
  })

  revalidatePath('/neuigkeiten')
  revalidatePath('/dashboard')
  return { ok: 'Veröffentlicht. Beim nächsten Anmelden sehen es alle.' }
}

export async function loescheNeuigkeit(formData: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(formData.get('id') ?? '')
  await db.neuigkeit.deleteMany({ where: { id } })
  revalidatePath('/neuigkeiten')
}
