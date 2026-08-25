import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireSuperAdmin } from '@/lib/admin/wache'
import { db } from '@/lib/db'
import { Card, CardHeader } from '@/components/ui'
import { BereichsZeile } from './zeile'

export const dynamic = 'force-dynamic'

export default async function ArbeitsbereicheSeite() {
  await requireSuperAdmin()

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

      <Card>
        <CardHeader title={`${bereiche.length} Arbeitsbereiche`} />
        <ul className="divide-y divide-border">
          {bereiche.map((bereich) => (
            <BereichsZeile key={bereich.id} bereich={bereich} />
          ))}
        </ul>
      </Card>
    </div>
  )
}
