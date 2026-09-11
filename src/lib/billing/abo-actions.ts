'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { requireRole } from '@/lib/auth/session'
import { stripe, preisFuer } from './stripe'

/**
 * Die beiden Wege zu Stripe.
 *
 * Beide enden mit einer Weiterleitung auf eine von Stripe gehostete Seite:
 * einmal zum Abschliessen, einmal zum Verwalten. Kartendaten, Kündigung und
 * Rechnungen liegen damit dort, wo sie hingehören.
 *
 * Nur wer den Arbeitsbereich verwaltet, darf hier etwas auslösen: Ein Abo
 * ist eine Zahlungsverpflichtung, kein Arbeitsschritt.
 */

/** Die Adresse, unter der die Anwendung von aussen erreichbar ist. */
async function basisUrl(): Promise<string> {
  const konfiguriert = env().APP_URL
  if (konfiguriert && !/^https?:\/\/localhost(:|$)/.test(konfiguriert)) {
    return konfiguriert.replace(/\/+$/, '')
  }
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
  if (!host) return konfiguriert.replace(/\/+$/, '')
  const protokoll = hdrs.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protokoll}://${host}`
}

export async function starteKaufAction(formData: FormData): Promise<void> {
  const session = await requireRole('OWNER')
  const s = stripe()
  if (!s) redirect('/settings/profil?fehler=stripe')

  const tarif = String(formData.get('tarif') ?? '')
  if (tarif !== 'STARTER' && tarif !== 'PRO') redirect('/settings/profil')

  const preis = preisFuer(tarif)
  if (!preis) redirect('/settings/profil?fehler=preis')

  const organisation = await db.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
  })

  const basis = await basisUrl()
  const sitzung = await s.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: preis, quantity: 1 }],
    // Vorhandene Kundschaft wiederverwenden, sonst legt jeder Kauf einen
    // neuen Eintrag bei Stripe an und die Zuordnung zerfällt.
    ...(organisation.stripeKundeId
      ? { customer: organisation.stripeKundeId }
      : { customer_email: session.email }),
    // Der Arbeitsbereich muss im Webhook wiederzufinden sein — dort gibt es
    // keine Sitzung, nur die Nachricht von Stripe.
    client_reference_id: organisation.id,
    subscription_data: { metadata: { organizationId: organisation.id } },
    metadata: { organizationId: organisation.id },
    allow_promotion_codes: true,
    success_url: `${basis}/settings/profil?abo=erfolg`,
    cancel_url: `${basis}/settings/profil?abo=abgebrochen`,
  })

  await db.auditLog.create({
    data: {
      organizationId: organisation.id,
      userId: session.id,
      action: 'abo.kauf.gestartet',
      target: tarif,
    },
  })

  if (!sitzung.url) redirect('/settings/profil?fehler=stripe')
  redirect(sitzung.url)
}

/**
 * Das Kundenportal öffnen.
 *
 * Dort ändert die Kundin ihre Bezahldaten, lädt Rechnungen und kündigt —
 * alles bei Stripe. Diese Anwendung baut dafür keine eigene Oberfläche: Sie
 * müsste sonst Kartendaten anfassen und Kündigungsfristen selbst abbilden.
 */
export async function oeffnePortalAction(): Promise<void> {
  const session = await requireRole('OWNER')
  const s = stripe()
  if (!s) redirect('/settings/profil?fehler=stripe')

  const organisation = await db.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
  })
  if (!organisation.stripeKundeId) redirect('/settings/profil?fehler=kein-abo')

  const basis = await basisUrl()
  const portal = await s.billingPortal.sessions.create({
    customer: organisation.stripeKundeId,
    return_url: `${basis}/settings/profil`,
  })

  redirect(portal.url)
}
