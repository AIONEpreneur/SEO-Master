import Link from 'next/link'
import { ScanSearch, KeyRound, AlertTriangle, FileText, FolderKanban, Gauge, Coins } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { availableProviders } from '@/lib/connectors/credentials'
import { providerLabel } from '@/lib/connectors/labels'
import { ButtonLink, Card, CardHeader, EmptyState, ScoreBadge, ScoreRing, StatusPill } from '@/components/ui'
import { Onboarding } from '@/components/onboarding'

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

      <Onboarding organizationId={session.organizationId} />

      {/* Nur zeigen, wenn schon analysiert wurde – sonst sagt die Einstiegshilfe
          darüber bereits dasselbe. */}
      {missingProviders.length > 0 && completedCount > 0 && (
        // Einzeilig: Die ausführliche Begründung steht bereits in der
        // Einstiegshilfe darüber. Zweimal dasselbe in voller Länge macht die
        // Übersicht zu einer Textseite.
        <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 border-warn/30 bg-warn-subtle px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 text-warn" />
          <p className="min-w-0 flex-1 text-[13px]">
            <span className="font-medium">{missingProviders.length} Anbieter fehlen</span>
            <span className="text-ink-muted"> — {missingProviders.join(', ')}. Die Analyse läuft trotzdem und weist die Lücken aus.</span>
          </p>
          <Link href="/settings/vault" className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-brand hover:underline">
            <KeyRound size={14} />
            Datentresor
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<FileText size={15} />} label="Analysen" value={String(completedCount)} />
        <Metric icon={<FolderKanban size={15} />} label="Projekte" value={String(projectCount)} />
        <Metric
          icon={<Gauge size={15} />}
          label="Ø Gesamtbewertung"
          value={avgScores._avg.scoreOverall ? `${avgScores._avg.scoreOverall.toFixed(1).replace('.', ',')}` : '–'}
          zusatz={avgScores._avg.scoreOverall ? 'von 10' : undefined}
        />
        <Metric
          icon={<Coins size={15} />}
          label="Guthaben"
          value={session.credits >= 100000 ? 'Unbegrenzt' : session.credits.toLocaleString('de-DE')}
        />
      </div>

      {completedCount > 0 && (
        <Card className="p-5">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Durchschnitt über alle Läufe
          </p>
          <div className="grid grid-cols-3 gap-3">
            <ScoreRing score={avgScores._avg.scoreSeo} label="SEO" />
            <ScoreRing score={avgScores._avg.scoreAeo} label="AEO" />
            <ScoreRing score={avgScores._avg.scoreGeo} label="GEO" />
          </div>
        </Card>
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

function Metric({
  icon, label, value, zusatz,
}: { icon: React.ReactNode; label: string; value: string; zusatz?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-subtle text-brand">
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
        {zusatz && <span className="ml-1 text-[13px] font-normal text-ink-subtle">{zusatz}</span>}
      </p>
    </Card>
  )
}
