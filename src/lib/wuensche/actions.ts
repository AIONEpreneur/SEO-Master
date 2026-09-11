'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { requireSuperAdmin } from '@/lib/admin/wache'
import { env } from '@/lib/env'
import { sendeEreignis } from '@/lib/benachrichtigung/webhook'

export type WunschState = { ok?: string; error?: string }

const wunsch = z.object({
  titel: z
    .string()
    .trim()
    .min(4, 'Bitte einen kurzen Titel angeben.')
    .max(120, 'Der Titel ist zu lang — die Beschreibung darunter hat Platz.'),
  text: z
    .string()
    .trim()
    .min(15, 'Bitte kurz beschreiben, was fehlt und wofür du es brauchst.')
    .max(3000, 'Das ist zu lang.'),
})

/**
 * Einen Wunsch eintragen.
 *
 * Über requireRole und damit gesperrt in der Fremdansicht: Ein Wunsch, der
 * aus einer Kundensicht heraus entsteht, stünde im Bereich der Kundin und
 * käme scheinbar von ihr.
 */
export async function legeWunschAn(_prev: WunschState, formData: FormData): Promise<WunschState> {
  const session = await requireRole('VIEWER')

  const parsed = wunsch.safeParse({
    titel: String(formData.get('titel') ?? ''),
    text: String(formData.get('text') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const angelegt = await db.wunsch.create({
    data: {
      organizationId: session.organizationId,
      userId: session.id,
      titel: parsed.data.titel,
      text: parsed.data.text,
    },
  })

  /*
    Nach draussen melden — erst jetzt, und ohne Folgen für die Eintragende.

    Der Wunsch ist gespeichert, bevor hier irgendetwas passiert. Scheitert
    das Melden, hat sie trotzdem recht, wenn sie glaubt, es habe geklappt:
    Es hat. Der Fehlschlag steht im Protokoll des Servers, nicht in ihrem
    Formular — sie könnte ohnehin nichts daran ändern.
  */
  void sendeEreignis({
    art: 'wunsch.neu',
    titel: parsed.data.titel,
    text: parsed.data.text,
    bereich: session.organizationName,
    person: session.name ?? session.email,
    url: `${env().APP_URL}/admin/wuensche`,
  })

  revalidatePath('/wuensche')
  revalidatePath('/dashboard')
  return { ok: 'Angekommen. Du siehst hier, sobald sich der Stand ändert.' }
}

/**
 * Einen eigenen Wunsch zurückziehen.
 *
 * Nur solange er offen ist: Was schon geplant oder umgesetzt wurde, ist
 * keine Bitte mehr, sondern Teil der Geschichte dieser Anwendung.
 */
export async function ziehWunschZurueck(formData: FormData): Promise<void> {
  const session = await requireRole('VIEWER')
  const id = String(formData.get('id') ?? '')
  await db.wunsch.deleteMany({
    where: { id, organizationId: session.organizationId, userId: session.id, status: 'OFFEN' },
  })
  revalidatePath('/wuensche')
}

const antwort = z.object({
  status: z.enum(['OFFEN', 'GEPLANT', 'UMGESETZT', 'ABGELEHNT']),
  antwort: z.string().trim().max(2000, 'Das ist zu lang.').optional(),
})

/** Stand und Antwort setzen — nur der Betrieb. */
export async function beantworteWunsch(formData: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(formData.get('id') ?? '')

  const parsed = antwort.safeParse({
    status: String(formData.get('status') ?? 'OFFEN'),
    antwort: String(formData.get('antwort') ?? ''),
  })
  if (!parsed.success) return

  await db.wunsch.update({
    where: { id },
    data: {
      status: parsed.data.status,
      antwort: parsed.data.antwort?.trim() || null,
    },
  })

  revalidatePath('/admin/wuensche')
  revalidatePath('/wuensche')
}

/**
 * Eine Probe an den Webhook schicken.
 *
 * Wer einen Workflow baut, will ihn auslösen können, ohne auf einen echten
 * Wunsch zu warten — sonst wird zum Testen ein Wunsch eingetragen, und der
 * steht danach in den Daten einer Kundin.
 */
export async function sendeWebhookProbe(): Promise<void> {
  await requireSuperAdmin()
  await sendeEreignis({
    art: 'probe',
    titel: 'Probe aus SEO-Master',
    text: 'Wenn diese Nachricht ankommt, ist der Webhook richtig eingerichtet. Echte Ereignisse tragen die Art "wunsch.neu".',
    bereich: 'Betrieb',
    url: `${env().APP_URL}/admin/wuensche`,
  })
  revalidatePath('/admin/wuensche')
}
