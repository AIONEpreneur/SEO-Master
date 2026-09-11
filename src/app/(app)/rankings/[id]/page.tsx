import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ListOrdered, Medal, Search, Sparkles } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Card, CardHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

/** Eine Platzierung, wie die Extension sie abliefert. */
type RankingEintrag = {
  rank: number | null
  keyword: string
  sv: number | null
  path: string
}

export default async function RankingLookupPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params

  const lookup = await db.rankingLookup.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!lookup) notFound()

  const items = lookup.items as unknown as RankingEintrag[]
  const mitRang = items.filter((i) => typeof i.rank === 'number')
  const beste = mitRang.reduce<number | null>(
    (min, i) => (min === null || (i.rank as number) < min ? (i.rank as number) : min),
    null,
  )
  const topZehn = mitRang.filter((i) => (i.rank as number) <= 10).length
  const suchvolumen = items.reduce((s, i) => s + (i.sv ?? 0), 0)
  const ziel = lookup.target.replace(/^https?:\/\//, '')

  return (
    <div className="space-y-6">
      <div>
        <Link href="/rankings" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft size={14} />
          Alle Abfragen
        </Link>
        <h1 className="text-xl font-semibold tracking-tight break-all">{ziel}</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {lookup.scope === 'seite' ? 'Eine Unterseite' : 'Ganze Domain'} · Google Deutschland ·{' '}
          {lookup.createdAt.toLocaleString('de-DE', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kennzahl
          icon={<ListOrdered size={15} />}
          label="Rankende Keywords"
          wert={lookup.totalCount.toLocaleString('de-DE')}
          hinweis="insgesamt in den Top 100"
        />
        <Kennzahl
          icon={<Medal size={15} />}
          label="Beste Platzierung"
          wert={beste !== null ? `Platz ${beste}` : '–'}
          hinweis={beste !== null ? 'die stärkste gefundene Position' : 'keine Position gefunden'}
        />
        <Kennzahl
          icon={<Search size={15} />}
          label="In den Top 10"
          wert={String(topZehn)}
          hinweis="Keywords auf der ersten Ergebnisseite"
        />
        <Kennzahl
          icon={<Sparkles size={15} />}
          label="Suchvolumen zusammen"
          wert={suchvolumen.toLocaleString('de-DE')}
          hinweis="Suchen im Monat über die Liste unten"
        />
      </div>

      <Card>
        <CardHeader
          title="Die Platzierungen"
          description={`Die besten ${items.length} von ${lookup.totalCount.toLocaleString('de-DE')} rankenden Keywords, sortiert nach Position.`}
        />
        {items.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-ink-muted">
            Keine organischen Rankings in den Top 100 gefunden.
          </p>
        ) : (
          <div className="scroll-x">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-5 py-2.5 font-medium">Platz</th>
                  <th className="px-3 py-2.5 font-medium">Keyword</th>
                  <th className="px-3 py-2.5 font-medium">Suchen/Monat</th>
                  <th className="px-5 py-2.5 font-medium">Rankende Seite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((i, index) => (
                  <tr key={`${i.keyword}-${index}`}>
                    <td className="px-5 py-2.5 tabular-nums font-medium">
                      {typeof i.rank === 'number' ? i.rank : '–'}
                    </td>
                    <td className="px-3 py-2.5">{i.keyword}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {typeof i.sv === 'number' ? i.sv.toLocaleString('de-DE') : 'k. A.'}
                    </td>
                    <td className="px-5 py-2.5 text-ink-muted break-all">{i.path || '/'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">So geht es weiter</p>
        <p className="text-sm leading-relaxed">
          Interessante Begriffe aus dieser Liste lassen sich unter{' '}
          <Link href="/keywords" className="text-brand hover:underline">Keyword-Recherche</Link> vertiefen
          (Nachfrage, Klickpreise, Schwierigkeit). Gehört das Ziel einer Mitbewerberin, lohnt sich der
          Blick unter <Link href="/competitors" className="text-brand hover:underline">Wettbewerb</Link> —
          dort zeigt der Vergleich, welche dieser Keywords der eigenen Website noch fehlen.
        </p>
      </Card>
    </div>
  )
}

function Kennzahl({
  icon, label, wert, hinweis,
}: { icon: React.ReactNode; label: string; wert: string; hinweis: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        <span className="text-brand">{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight">{wert}</p>
      <p className="mt-0.5 text-[12px] text-ink-subtle">{hinweis}</p>
    </Card>
  )
}
