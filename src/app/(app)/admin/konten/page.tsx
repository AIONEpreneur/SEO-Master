import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireSuperAdmin } from '@/lib/admin/wache'
import { db } from '@/lib/db'
import { Card, CardHeader } from '@/components/ui'
import { KontoZeile } from './zeile'

export const dynamic = 'force-dynamic'

export default async function KontenSeite() {
  const admin = await requireSuperAdmin()

  const konten = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      isSuperAdmin: true,
      suspendedAt: true,
      lastLoginAt: true,
      createdAt: true,
      memberships: {
        select: { role: true, organization: { select: { name: true, plan: true } } },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={14} />
          Betrieb
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Konten</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Passwort zurücksetzen und Zugänge sperren. Was in den Arbeitsbereichen liegt, ist hier nicht
          einsehbar.
        </p>
      </header>

      <Card>
        <CardHeader title={`${konten.length} Konten`} />
        <ul className="divide-y divide-border">
          {konten.map((konto) => (
            <KontoZeile key={konto.id} konto={konto} istIchSelbst={konto.id === admin.id} />
          ))}
        </ul>
      </Card>
    </div>
  )
}
