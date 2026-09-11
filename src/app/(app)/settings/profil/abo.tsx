import Link from 'next/link'
import { CreditCard, ExternalLink, Sparkles } from 'lucide-react'
import { db } from '@/lib/db'
import { Card, CardHeader, Button } from '@/components/ui'
import { TARIFE } from '@/lib/billing/tarife'
import { stripeBereit, buchbareTarife, aboTraegt, ABO_TEXTE } from '@/lib/billing/stripe'
import { starteKaufAction, oeffnePortalAction } from '@/lib/billing/abo-actions'
import type { SessionUser } from '@/lib/auth/session'

/**
 * Der Abo-Bereich im Profil.
 *
 * Drei Zustände, und jeder sagt offen, was Sache ist: kein Stripe
 * eingerichtet, kein Abo vorhanden, oder ein laufendes Abo. Kündigung und
 * Bezahldaten führen ins Stripe-Kundenportal — dorthin, wo die Kartendaten
 * liegen. Diese Anwendung sieht sie nie.
 */
export async function AboBereich({ session }: { session: SessionUser }) {
  const organisation = await db.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
  })

  const darfBuchen = session.role === 'OWNER' && !session.nurAnsicht
  const buchbar = buchbareTarife()
  const laeuft = aboTraegt(organisation.aboStatus)

  // Interne Arbeitsbereiche rechnen nicht ab — ein Abo-Kasten wäre dort
  // schlicht falsch.
  if (organisation.plan === 'INTERNAL') {
    return (
      <Card>
        <CardHeader title="Abo" description="Dieser Arbeitsbereich läuft intern und rechnet nicht ab." />
      </Card>
    )
  }

  if (!stripeBereit() || buchbar.length === 0) {
    return (
      <Card>
        <CardHeader title="Abo" description="Die Bezahlung wird gerade eingerichtet." />
        <div className="p-5">
          <p className="text-[13px] font-medium text-ink-muted">
            Sobald sie steht, kannst du hier ein Abo abschliessen, deine Bezahldaten ändern und
            jederzeit kündigen. Bis dahin gilt dein aktuelles Guthaben — bei Fragen melde dich
            gern.
          </p>
        </div>
      </Card>
    )
  }

  if (laeuft) {
    const tarif = TARIFE.find((t) => t.kennung === organisation.plan)
    return (
      <Card>
        <CardHeader
          title="Abo"
          description="Bezahldaten, Rechnungen und Kündigung verwaltest du im Zahlungsportal."
        />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border-2 border-tinte bg-limette px-4 py-1.5 text-[13px] font-bold">
              {tarif?.name ?? organisation.plan}
            </span>
            <span className="rounded-full border-2 border-tinte bg-creme px-4 py-1.5 text-[13px] font-bold">
              {ABO_TEXTE[organisation.aboStatus ?? ''] ?? organisation.aboStatus}
            </span>
            {organisation.aboEndetMitPeriode && (
              <span className="rounded-full border-2 border-tinte bg-orange px-4 py-1.5 text-[13px] font-bold">
                Läuft aus
              </span>
            )}
          </div>

          {organisation.aboLaeuftBis && (
            <p className="text-[13px] font-medium text-ink-muted">
              {organisation.aboEndetMitPeriode
                ? `Gekündigt — dein Zugang endet am ${organisation.aboLaeuftBis.toLocaleDateString('de-DE')}.`
                : `Verlängert sich am ${organisation.aboLaeuftBis.toLocaleDateString('de-DE')}.`}
            </p>
          )}

          {darfBuchen ? (
            <form action={oeffnePortalAction}>
              <Button type="submit" variant="secondary">
                <CreditCard size={15} />
                Zahlungsportal öffnen
                <ExternalLink size={13} />
              </Button>
            </form>
          ) : (
            <p className="text-[13px] font-medium text-ink-muted">
              Das Abo verwaltet die Inhaberin des Arbeitsbereichs.
            </p>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Abo"
        description="Zum Mitnehmen: Exporte, Extension und die KI-Anbindung."
      />
      <div className="space-y-4 p-5">
        <p className="text-[13px] font-medium text-ink-muted">
          Dein Arbeitsbereich läuft im kostenlosen Tarif. Alles bleibt sichtbar — mit einem Abo
          kannst du Ergebnisse zusätzlich herunterladen, die Browser-Extension nutzen und deine KI
          direkt anbinden.
        </p>

        {darfBuchen ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {TARIFE.filter((t) => buchbar.includes(t.kennung as 'STARTER' | 'PRO')).map((tarif) => (
              <div
                key={tarif.kennung}
                className={`rounded-xl border-2 border-border p-5 ${
                  tarif.farbe === 'orange' ? 'bg-orange' : 'bg-limette'
                }`}
              >
                <p className="font-display text-[15px] uppercase">{tarif.name}</p>
                <p className="mt-2 font-display text-[28px] leading-none">
                  {tarif.preis}
                  <span className="ml-1.5 font-sans text-[12px] font-medium normal-case">
                    {tarif.preisHinweis}
                  </span>
                </p>
                <p className="mt-2 text-[13px] font-medium">{tarif.beschreibung}</p>
                <form action={starteKaufAction} className="mt-4">
                  <input type="hidden" name="tarif" value={tarif.kennung} />
                  <Button type="submit" size="sm" className="w-full">
                    <Sparkles size={14} />
                    {tarif.name} buchen
                  </Button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] font-medium text-ink-muted">
            Ein Abo schliesst die Inhaberin des Arbeitsbereichs ab.
          </p>
        )}

        <p className="text-[12px] font-medium text-ink-subtle">
          Die Zahlung läuft über Stripe. Kartendaten sieht SEO-Master zu keinem Zeitpunkt.{' '}
          <Link href="/datenschutz" className="underline decoration-2 underline-offset-2">
            Datenschutz
          </Link>
        </p>
      </div>
    </Card>
  )
}
