import Link from 'next/link'
import { ScanSearch, Trash2, Download } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { ButtonLink, Card, CardHeader, EmptyState, ScoreBadge, StatusPill } from '@/components/ui'
import { deleteAnalysisAction } from '@/lib/analysis/actions'

export const dynamic = 'force-dynamic'

export default async function AnalysesPage() {
  const session = await requireSession()
  const analyses = await db.analysis.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { project: { select: { name: true } } },
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Analysen</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">{analyses.length} Läufe</p>
        </div>
        <div className="flex items-center gap-2">
          {analyses.length > 0 && (
            <ButtonLink href="/api/export" variant="secondary">
              <Download size={16} />
              Alles herunterladen
            </ButtonLink>
          )}
          <ButtonLink href="/analyses/new">
            <ScanSearch size={16} />
            Neue Analyse
          </ButtonLink>
        </div>
      </header>

      {analyses.length > 0 && (
        <Card className="flex flex-wrap items-center gap-x-3 gap-y-1 border-border bg-surface-muted px-4 py-3">
          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-muted">
            Deine Historie bleibt erhalten — sie wird weder nach einer Frist gelöscht noch beim Tarifwechsel
            entfernt. „Alles herunterladen" gibt ein Zip mit allen Berichten, nach Projekt sortiert, samt
            Messwerten und einer Übersicht für Excel.
          </p>
        </Card>
      )}

      <Card>
        {analyses.length === 0 ? (
          <EmptyState
            icon={<ScanSearch size={28} />}
            title="Noch keine Analyse"
            description="Der erste Lauf legt zugleich den Vergleichswert für alle späteren fest."
            action={
              <ButtonLink href="/analyses/new" size="sm">
                Analyse starten
              </ButtonLink>
            }
          />
        ) : (
          <>
            <CardHeader title="Alle Läufe" />
            <div className="scroll-x">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="px-5 py-2.5 font-medium">Ziel</th>
                    <th className="px-3 py-2.5 font-medium">Bausteine</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">SEO</th>
                    <th className="px-3 py-2.5 font-medium">AEO</th>
                    <th className="px-3 py-2.5 font-medium">GEO</th>
                    <th className="px-3 py-2.5 font-medium">Gesamt</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {analyses.map((analysis) => (
                    <tr key={analysis.id} className="transition-colors hover:bg-surface-muted">
                      <td className="px-5 py-2.5">
                        <Link href={`/analyses/${analysis.id}`} className="block">
                          <span className="font-medium">{shorten(analysis.targetUrl)}</span>
                          <span className="mt-0.5 block text-[12px] text-ink-subtle">
                            {analysis.project?.name ? `${analysis.project.name} · ` : ''}
                            {analysis.createdAt.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-ink-muted">{analysis.modules.join(', ')}</td>
                      <td className="px-3 py-2.5"><StatusPill status={analysis.status} /></td>
                      <td className="px-3 py-2.5"><ScoreBadge score={analysis.scoreSeo} size="sm" /></td>
                      <td className="px-3 py-2.5"><ScoreBadge score={analysis.scoreAeo} size="sm" /></td>
                      <td className="px-3 py-2.5"><ScoreBadge score={analysis.scoreGeo} size="sm" /></td>
                      <td className="px-3 py-2.5"><ScoreBadge score={analysis.scoreOverall} size="sm" /></td>
                      <td className="px-5 py-2.5 text-right">
                        <form action={deleteAnalysisAction}>
                          <input type="hidden" name="id" value={analysis.id} />
                          <button
                            type="submit"
                            aria-label={`Lauf zu ${shorten(analysis.targetUrl)} löschen`}
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

function shorten(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.hostname.replace(/^www\./, '')}${path}`.slice(0, 60)
  } catch {
    return url.slice(0, 60)
  }
}
