import Link from 'next/link'
import { ScanSearch, KeyRound, AlertTriangle } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { availableProviders } from '@/lib/connectors/credentials'
import { providerLabel } from '@/lib/connectors/labels'
import { ButtonLink, Card, CardHeader, EmptyState, ScoreBadge, StatusPill } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireSession()

  const [analyses, projectCount, completedCount, providers, avgScores] = await Promise.all([
    db.analysis.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { project: { select: { name: true } } },
    }),
    db.project.count({ where: { organizationId: session.organizationId, isArchived: false } }),
    db.analysis.count({ where: { organizationId: session.organizationId, status: 'COMPLETED' } }),
    availableProviders(session.organizationId),
    db.analysis.aggregate({
      where: { organizationId: session.organizationId, status: 'COMPLETED' },
      _avg: { scoreSeo: true, scoreAeo: true, scoreGeo: true, scoreOverall: true },
    }),
  ])

  const missingProviders = Object.entries(providers)
    .filter(([key, ready]) => !ready && key !== 'SEARCH_CONSOLE')
    .map(([key]) => providerLabel(key as Parameters<typeof providerLabel>[0]))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Übersicht</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">{session.organizationName}</p>
        </div>
        <ButtonLink href="/analyses/new">
          <ScanSearch size={16} />
          Neue Analyse
        </ButtonLink>
      </header>

      {missingProviders.length > 0 && (
        <Card className="border-warn/30 bg-warn-subtle p-4">
          <div className="flex gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium">
                {missingProviders.length} Anbieter noch nicht eingerichtet
              </p>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                Ohne {missingProviders.join(', ')} entfallen die zugehörigen Bausteine. Die Analyse läuft
                trotzdem und weist die Lücken im Bericht aus.
              </p>
              <Link href="/settings/vault" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline">
                <KeyRound size={14} />
                Zum Datentresor
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Analysen" value={String(completedCount)} />
        <Metric label="Projekte" value={String(projectCount)} />
        <Metric
          label="Ø Gesamtbewertung"
          value={avgScores._avg.scoreOverall ? `${avgScores._avg.scoreOverall.toFixed(1)}/10` : '–'}
        />
        <Metric
          label="Guthaben"
          value={session.credits >= 100000 ? 'Unbegrenzt' : session.credits.toLocaleString('de-DE')}
        />
      </div>

      {completedCount > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <DisciplineCard label="SEO" score={avgScores._avg.scoreSeo} />
          <DisciplineCard label="AEO" score={avgScores._avg.scoreAeo} />
          <DisciplineCard label="GEO" score={avgScores._avg.scoreGeo} />
        </div>
      )}

      <Card>
        <CardHeader
          title="Letzte Analysen"
          action={
            <Link href="/analyses" className="text-[13px] font-medium text-brand hover:underline">
              Alle anzeigen
            </Link>
          }
        />
        {analyses.length === 0 ? (
          <EmptyState
            icon={<ScanSearch size={28} />}
            title="Noch keine Analyse"
            description="Website-URL oder Social-Profil eingeben und den ersten Lauf starten."
            action={
              <ButtonLink href="/analyses/new" size="sm">
                Erste Analyse starten
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {analyses.map((analysis) => (
              <li key={analysis.id}>
                <Link
                  href={`/analyses/${analysis.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{analysis.targetUrl}</p>
                    <p className="mt-0.5 text-[12px] text-ink-subtle">
                      {analysis.project?.name ? `${analysis.project.name} · ` : ''}
                      {analysis.modules.join(', ')} ·{' '}
                      {analysis.createdAt.toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <StatusPill status={analysis.status} />
                  <ScoreBadge score={analysis.scoreOverall} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
    </Card>
  )
}

function DisciplineCard({ label, score }: { label: string; score: number | null }) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[12px] text-ink-subtle">Durchschnitt</p>
      </div>
      <ScoreBadge score={score} />
    </Card>
  )
}
