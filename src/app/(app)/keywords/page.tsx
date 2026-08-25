import Link from 'next/link'
import { TrendingUp, Trash2 } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { availableProviders } from '@/lib/connectors/credentials'
import { verwaltetEigeneZugaenge } from '@/lib/billing/zugaenge'
import { Card, CardHeader, EmptyState } from '@/components/ui'
import { deleteKeywordResearchAction } from '@/lib/keywords/actions'
import type { Zusammenfassung } from '@/lib/keywords/research'
import { KeywordForm } from './form'

export const dynamic = 'force-dynamic'

export default async function KeywordsPage() {
  const session = await requireSession()
  const [researches, providers] = await Promise.all([
    db.keywordResearch.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, seed: true, createdAt: true, summary: true, locationCode: true },
    }),
    availableProviders(session.organizationId),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Keyword-Recherche</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Wonach suchen Menschen – und für welche Begriffe wird Geld ausgegeben?
        </p>
      </header>

      {session.nurAnsicht ? null : (
        <KeywordForm hatDataForSeo={providers.DATAFORSEO} eigeneZugaenge={verwaltetEigeneZugaenge(session)} />
      )}

      <Card>
        {researches.length === 0 ? (
          <EmptyState
            icon={<TrendingUp size={28} />}
            title="Noch keine Recherche"
            description="Jede Recherche bleibt gespeichert und lässt sich später wieder aufrufen."
          />
        ) : (
          <>
            <CardHeader title="Frühere Recherchen" />
            <div className="scroll-x">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="px-5 py-2.5 font-medium">Begriff</th>
                    <th className="px-3 py-2.5 font-medium">Treffer</th>
                    <th className="px-3 py-2.5 font-medium">Suchen im Monat</th>
                    <th className="px-3 py-2.5 font-medium">Werbewert</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {researches.map((r) => {
                    const s = r.summary as unknown as Zusammenfassung
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-surface-muted">
                        <td className="px-5 py-2.5">
                          <Link href={`/keywords/${r.id}`} className="block">
                            <span className="font-medium">{r.seed}</span>
                            <span className="mt-0.5 block text-[12px] text-ink-subtle">
                              {markt(r.locationCode)} ·{' '}
                              {r.createdAt.toLocaleDateString('de-DE', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-ink-muted">{s?.begriffe ?? '–'}</td>
                        <td className="px-3 py-2.5 tabular-nums">{zahl(s?.suchenGesamt)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{euro(s?.anzeigenwertGesamt)}</td>
                        <td className="px-5 py-2.5 text-right">
                          <form action={deleteKeywordResearchAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <button
                              type="submit"
                              aria-label={`Recherche zu ${r.seed} löschen`}
                              className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-bad-subtle hover:text-bad"
                            >
                              <Trash2 size={15} />
                            </button>
                          </form>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

const MARKTNAMEN: Record<number, string> = {
  2276: 'Deutschland', 2040: 'Österreich', 2756: 'Schweiz',
  2826: 'Vereinigtes Königreich', 2840: 'USA',
}

function markt(code: number): string {
  return MARKTNAMEN[code] ?? String(code)
}

function zahl(wert: number | undefined): string {
  return typeof wert === 'number' ? wert.toLocaleString('de-DE') : '–'
}

function euro(wert: number | undefined): string {
  return typeof wert === 'number'
    ? `${wert.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
    : '–'
}
