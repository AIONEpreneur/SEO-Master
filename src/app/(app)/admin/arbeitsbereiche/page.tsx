import Link from 'next/link'
import { ArrowLeft, Eye } from 'lucide-react'
import { requireSuperAdmin } from '@/lib/admin/wache'
import { db } from '@/lib/db'
import { Card, CardHeader, Button } from '@/components/ui'
import { BereichsZeile } from './zeile'
import { vorschauBereichAction } from '@/lib/auth/ansicht'
import { VORSCHAU_NAME } from '@/lib/auth/vorschau'

export const dynamic = 'force-dynamic'

export default async function ArbeitsbereicheSeite() {
  const session = await requireSuperAdmin()

  const hatVorschau =
    (await db.organization.count({
      where: { name: VORSCHAU_NAME, memberships: { some: { userId: session.id } } },
    })) > 0

  const bereiche = await db.organization.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      plan: true,
      credits: true,
      createdAt: true,
      _count: { select: { memberships: true, analyses: true, projects: true } },
    },
  })

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft size={14} />
          Betrieb
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Arbeitsbereiche</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Tarif und Guthaben. Das Guthaben begrenzt, wie viel externe Anbieterkosten ein Bereich verursachen
          kann.
        </p>
      </header>

      {/*
        Der Vorschau-Bereich ist ein eigener Arbeitsbereich mit Kundentarif.
        Darin laesst sich die App wirklich benutzen – ohne in fremden Daten zu
        stehen und ohne dass eine Kundin merkt, dass jemand mitliest.
      */}
      <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">
            {hatVorschau ? 'In die Kundensicht wechseln' : 'Vorschau-Bereich anlegen'}
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Ein eigener Arbeitsbereich mit Kundentarif. Dort erleben Sie die App genau so wie eine Kundin —
            ohne Datentresor, ohne Verbrauch, mit Kontingent statt Guthaben. Analysen darin verbrauchen
            echtes Guthaben, deshalb ein knapper Startbetrag.
          </p>
        </div>
        <form action={vorschauBereichAction} className="shrink-0">
          <Button type="submit" variant="secondary">
            <Eye size={15} />
            {hatVorschau ? 'Kundensicht öffnen' : 'Anlegen und öffnen'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title={`${bereiche.length} Arbeitsbereiche`}
          description="„Ansicht“ zeigt einen Bereich so, wie seine Inhaberin ihn sieht — nur lesend."
        />
        <ul className="divide-y divide-border">
          {bereiche.map((bereich) => (
            <BereichsZeile key={bereich.id} bereich={bereich} istEigener={bereich.id === session.organizationId} />
          ))}
        </ul>
      </Card>
    </div>
  )
}
