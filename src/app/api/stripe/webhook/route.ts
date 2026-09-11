import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { stripe, planFuerPreis, monatsguthaben, aboTraegt } from '@/lib/billing/stripe'

export const dynamic = 'force-dynamic'

/**
 * Was Stripe uns über ein Abo mitteilt.
 *
 * Der Webhook ist die einzige Stelle, an der sich Tarif und Guthaben aus
 * einer Zahlung heraus ändern — nicht die Rückkehr von der Bezahlseite: Die
 * lässt sich im Browser aufrufen, ohne dass je Geld geflossen ist.
 *
 * Jede Nachricht wird über die Signatur geprüft. Ohne Signaturgeheimnis
 * wird gar nichts angenommen; ein offener Endpunkt, der Tarife verteilt,
 * wäre ein Selbstbedienungsladen.
 */
export async function POST(request: Request) {
  const s = stripe()
  const geheimnis = env().STRIPE_WEBHOOK_SECRET
  if (!s || !geheimnis) {
    return Response.json({ error: 'Stripe ist auf diesem Server nicht eingerichtet.' }, { status: 503 })
  }

  const signatur = request.headers.get('stripe-signature')
  if (!signatur) return Response.json({ error: 'Signatur fehlt.' }, { status: 400 })

  // Die Signatur gilt für den unveränderten Text — deshalb der Rohtext und
  // nicht das geparste JSON.
  const rohtext = await request.text()

  let ereignis: Stripe.Event
  try {
    ereignis = await s.webhooks.constructEventAsync(rohtext, signatur, geheimnis)
  } catch (fehler) {
    return Response.json(
      { error: `Signatur ungültig: ${fehler instanceof Error ? fehler.message : 'unbekannt'}` },
      { status: 400 },
    )
  }

  switch (ereignis.type) {
    case 'checkout.session.completed': {
      const sitzung = ereignis.data.object
      const organizationId = sitzung.client_reference_id ?? sitzung.metadata?.organizationId
      const kundeId = typeof sitzung.customer === 'string' ? sitzung.customer : sitzung.customer?.id
      if (organizationId && kundeId) {
        // Die Kundennummer merken: Ohne sie liesse sich später kein
        // Kundenportal öffnen.
        await db.organization.updateMany({
          where: { id: organizationId },
          data: { stripeKundeId: kundeId },
        })
      }
      // Tarif und Guthaben setzt erst das Abo-Ereignis, das unmittelbar
      // folgt — dort stehen Preis, Status und Laufzeit vollständig.
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await uebernehmeAbo(ereignis.data.object)
      break
    }

    case 'invoice.paid': {
      // Verlängerung: Ein neuer bezahlter Monat füllt das Guthaben auf.
      const rechnung = ereignis.data.object as Stripe.Invoice & { subscription?: string | null }
      const aboId = typeof rechnung.subscription === 'string' ? rechnung.subscription : null
      if (aboId) {
        const abo = await s.subscriptions.retrieve(aboId)
        await uebernehmeAbo(abo, { guthabenAuffuellen: true })
      }
      break
    }

    default:
      // Alles andere geht uns nichts an — aber bestätigt werden muss es,
      // sonst versucht Stripe es tagelang erneut.
      break
  }

  return Response.json({ empfangen: true })
}

/**
 * Den Zustand eines Abos in den Arbeitsbereich übernehmen.
 *
 * Die Datenbank ist hier Abschrift, nicht Quelle: Was gilt, steht bei
 * Stripe. Deshalb wird bei jedem Ereignis der volle Zustand übernommen und
 * nicht versucht, Änderungen einzeln nachzuvollziehen.
 */
async function uebernehmeAbo(
  abo: Stripe.Subscription,
  optionen?: { guthabenAuffuellen?: boolean },
): Promise<void> {
  const kundeId = typeof abo.customer === 'string' ? abo.customer : abo.customer.id
  const organisation =
    (await db.organization.findFirst({ where: { stripeKundeId: kundeId } })) ??
    (abo.metadata?.organizationId
      ? await db.organization.findUnique({ where: { id: abo.metadata.organizationId } })
      : null)

  if (!organisation) return

  const posten = abo.items.data[0]
  const plan = planFuerPreis(posten?.price?.id)
  const traegt = aboTraegt(abo.status)

  // Das Ende des bezahlten Zeitraums steht am Posten, nicht am Abo selbst.
  const bisSekunden = posten?.current_period_end ?? null
  const laeuftBis = bisSekunden ? new Date(bisSekunden * 1000) : null

  // Ein Abo, das nicht mehr trägt, fällt auf den kostenlosen Tarif zurück.
  // Das Guthaben bleibt stehen: Dafür wurde bezahlt.
  const neuerPlan = traegt && plan ? plan : 'FREE'

  const frisch = optionen?.guthabenAuffuellen && traegt && plan
  const guthaben = frisch ? monatsguthaben(plan) : null

  await db.organization.update({
    where: { id: organisation.id },
    data: {
      stripeKundeId: kundeId,
      stripeAboId: abo.id,
      aboStatus: abo.status,
      aboLaeuftBis: laeuftBis,
      aboEndetMitPeriode: abo.cancel_at_period_end,
      // Interne Arbeitsbereiche bleiben, was sie sind — sie zahlen nicht.
      ...(organisation.plan === 'INTERNAL' ? {} : { plan: neuerPlan }),
      ...(guthaben !== null ? { credits: guthaben } : {}),
    },
  })

  await db.auditLog.create({
    data: {
      organizationId: organisation.id,
      action: 'abo.aktualisiert',
      target: abo.status,
      metadata: {
        plan: neuerPlan,
        endetMitPeriode: abo.cancel_at_period_end,
        guthabenGesetzt: guthaben,
      },
    },
  })
}
