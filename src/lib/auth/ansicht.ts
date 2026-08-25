"use server"

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { BEREICH_COOKIE, echteSitzung } from '@/lib/auth/session'
import { uniqueSlug } from '@/lib/auth/actions'
import { VORSCHAU_NAME } from './vorschau'

/**
 * Ansicht wechseln.
 *
 * Zwei verschiedene Dinge, bewusst über denselben Schalter:
 *
 *  - Ein weiterer eigener Bereich (der Vorschau-Bereich): ein echter Wechsel
 *    zwischen eigenen Mitgliedschaften. Volle Rechte, denn es sind die eigenen
 *    Daten – hier lässt sich die App als Kundin wirklich benutzen.
 *  - Ein fremder Bereich: nur mit Betriebsverwaltung und nur lesend. Ansehen,
 *    wie eine Kundin die App erlebt, darf in ihren Daten nichts auslösen.
 *
 * Entschieden wird das in getSession anhand der Mitgliedschaften, nicht hier:
 * Der Cookie ist eine Bitte, kein Ausweis.
 */

const COOKIE_TAGE = 1

async function setzeBereich(organizationId: string | null) {
  const store = await cookies()
  if (!organizationId) {
    store.delete(BEREICH_COOKIE)
    return
  }
  store.set(BEREICH_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Kurz gehalten: Eine vergessene Fremdansicht soll von selbst enden.
    expires: new Date(Date.now() + COOKIE_TAGE * 24 * 60 * 60 * 1000),
  })
}

export async function wechsleBereichAction(formData: FormData): Promise<void> {
  const benutzer = await echteSitzung()
  if (!benutzer) redirect('/login')

  const organizationId = String(formData.get('organizationId') ?? '')
  const eigen = benutzer.memberships.some((m) => m.organizationId === organizationId)

  // Ohne Mitgliedschaft geht es nur mit Betriebsverwaltung – und selbst dann
  // nur lesend, wofür getSession sorgt.
  if (!eigen && !benutzer.isSuperAdmin) return

  const bereich = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  })
  if (!bereich) return

  await setzeBereich(bereich.id)
  await db.auditLog.create({
    data: {
      organizationId: bereich.id,
      userId: benutzer.id,
      action: eigen ? 'ansicht.eigener-bereich' : 'ansicht.fremder-bereich',
      target: bereich.id,
    },
  })

  redirect('/dashboard')
}

export async function beendeAnsichtAction(): Promise<void> {
  await setzeBereich(null)
  redirect('/dashboard')
}

/**
 * Legt den Vorschau-Bereich an oder wechselt hinein.
 *
 * Ein eigener Arbeitsbereich mit Kundentarif, in dem die Betreiberin selbst
 * Mitglied ist. Damit erlebt sie die App genau so wie eine Kundin – nur ohne
 * in fremden Daten zu stehen. Analysen dort kosten echtes Guthaben, deshalb
 * ein knapper Startbetrag statt eines unbegrenzten Tarifs.
 */
export async function vorschauBereichAction(): Promise<void> {
  const benutzer = await echteSitzung()
  if (!benutzer?.isSuperAdmin) redirect('/dashboard')

  const vorhanden = await db.organization.findFirst({
    where: { name: VORSCHAU_NAME, memberships: { some: { userId: benutzer.id } } },
    select: { id: true },
  })

  const bereich =
    vorhanden ??
    (await db.organization.create({
      data: {
        name: VORSCHAU_NAME,
        slug: await uniqueSlug(VORSCHAU_NAME),
        plan: 'STARTER',
        credits: 400,
        memberships: { create: { userId: benutzer.id, role: 'OWNER' } },
      },
      select: { id: true },
    }))

  await setzeBereich(bereich.id)
  revalidatePath('/admin/arbeitsbereiche')
  redirect('/dashboard')
}
