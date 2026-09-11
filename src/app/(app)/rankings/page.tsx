import Link from 'next/link'
import { ListOrdered, Trash2 } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Card, CardHeader, EmptyState } from '@/components/ui'
import { deleteRankingLookupAction } from './actions'

export const dynamic = 'force-dynamic'

/**
 * Ranking-Abfragen aus der Browser-Extension (SEO4U).
 *
 * Jede Abfrage im Popup landet hier, damit das Ergebnis nicht mit dem
 * Schliessen des Popups verloren geht und sich in der App weiterverwenden
 * lässt – etwa als Grundlage für eine Analyse oder einen Wettbewerber.
 */
export default async function RankingsPage() {
  const session = await requireSession()
  const lookups = await db.rankingLookup.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, target: true, scope: true, totalCount: true, createdAt: true },
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Ranking-Abfragen</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Wofür rankt eine Website bei Google? Abgefragt mit der SEO4U-Extension direkt im Browser.
        </p>
      </header>

      <Card>
        {lookups.length === 0 ? (
          <EmptyState
            icon={<ListOrdered size={28} />}
            title="Noch keine Abfrage"
            description="Mit der SEO4U-Extension eine beliebige Website öffnen und auf das Icon klicken — jede Abfrage erscheint danach hier und bleibt gespeichert."
          />
        ) : (
          <>
            <CardHeader title="Frühere Abfragen" />
            <div className="scroll-x">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="px-5 py-2.5 font-medium">Ziel</th>
                    <th className="px-3 py-2.5 font-medium">Umfang</th>
                    <th className="px-3 py-2.5 font-medium">Rankende Keywords</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lookups.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-surface-muted">
                      <td className="px-5 py-2.5">
                        <Link href={`/rankings/${l.id}`} className="block">
                          <span className="font-medium break-all">{ohneProtokoll(l.target)}</span>
                          <span className="mt-0.5 block text-[12px] text-ink-subtle">
                            {l.createdAt.toLocaleDateString('de-DE', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {l.scope === 'seite' ? 'Eine Unterseite' : 'Ganze Domain'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{l.totalCount.toLocaleString('de-DE')}</td>
                      <td className="px-5 py-2.5 text-right">
                        <form action={deleteRankingLookupAction}>
                          <input type="hidden" name="id" value={l.id} />
                          <button
                            type="submit"
                            aria-label={`Abfrage zu ${ohneProtokoll(l.target)} löschen`}
                            className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-bad-subtle hover:text-bad"
                          >
                            <Trash2 size={15} />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

function ohneProtokoll(target: string): string {
  return target.replace(/^https?:\/\//, '')
}
