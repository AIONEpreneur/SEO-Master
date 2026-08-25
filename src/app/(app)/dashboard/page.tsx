import Link from 'next/link'
import { ScanSearch, KeyRound, AlertTriangle, FileText, FolderKanban, Globe, Coins, Repeat } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { availableProviders } from '@/lib/connectors/credentials'
import { providerLabel } from '@/lib/connectors/labels'
import { ButtonLink, Card, CardHeader, EmptyState, ScoreBadge, StatusPill } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import { Onboarding } from '@/components/onboarding'
import { verwaltetEigeneZugaenge, siehtAbrechnung, verbleibendeAnalysen } from '@/lib/billing/zugaenge'
import { KOSTEN_ANALYSE } from '@/lib/billing/guthaben'
import { wiederkehrendeBefunde } from '@/lib/analysis/wiederkehrend'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireSession()

  const [analyses, projectCount, completedCount, providers, geprueft, letzteErgebnisse] = await Promise.all([
    db.analysis.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { project: { select: { name: true } } },
    }),
    db.project.count({ where: { organizationId: session.organizationId, isArchived: false } }),
    db.analysis.count({ where: { organizationId: session.organizationId, status: 'COMPLETED' } }),
    availableProviders(session.organizationId),
    // Wie viele verschiedene Adressen geprüft wurden. Eine Zahl, die auch dann
    // stimmt, wenn die geprüften Seiten nichts miteinander zu tun haben.
    db.analysis.findMany({
      where: { organizationId: session.organizationId, status: 'COMPLETED' },
      select: { targetUrl: true },
      distinct: ['targetUrl'],
    }),
    db.analysis.findMany({
      where: { organizationId: session.organizationId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { result: true },
    }),
  ])

  const muster = wiederkehrendeBefunde(letzteErgebnisse.map((a) => a.result))

  const eigeneZugaenge = verwaltetEigeneZugaenge(session)
  const missingProviders = Object.entries(providers)
    .filter(([, ready]) => !ready)
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

      <Onboarding organizationId={session.organizationId} eigeneZugaenge={eigeneZugaenge} />

      {/* Nur zeigen, wenn schon analysiert wurde – sonst sagt die Einstiegshilfe
          darüber bereits dasselbe. */}
      {/* Fehlende Anbieter sind nur dort eine Aufgabe, wo eigene Zugänge
          verwaltet werden. Eine Kundin könnte daran nichts ändern – der
          Hinweis wäre eine Mahnung ohne Adressat. */}
      {eigeneZugaenge && missingProviders.length > 0 && completedCount > 0 && (
        // Einzeilig: Die ausführliche Begründung steht bereits in der
        // Einstiegshilfe darüber. Zweimal dasselbe in voller Länge macht die
        // Übersicht zu einer Textseite.
        <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 border-warn/30 bg-warn-subtle px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 text-warn" />
          <p className="min-w-0 flex-1 text-[13px]">
            <span className="font-medium">
              {missingProviders.length === 1 ? '1 Anbieter fehlt' : `${missingProviders.length} Anbieter fehlen`}
            </span>
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
          icon={<Globe size={15} />}
          label="Geprüfte Adressen"
          value={String(geprueft.length)}
        />
        {siehtAbrechnung(session) ? (
          <Metric
            icon={<Coins size={15} />}
            label="Guthaben"
            value={session.credits >= 100000 ? 'Unbegrenzt' : session.credits.toLocaleString('de-DE')}
          />
        ) : (
          <Metric
            icon={<ScanSearch size={15} />}
            label="Analysen frei"
            value={verbleibendeAnalysen(session.credits, KOSTEN_ANALYSE).toLocaleString('de-DE')}
            zusatz="in diesem Zeitraum"
          />
        )}
      </div>

      {/* Kein Durchschnitt über alle Läufe: Wer eine starke und eine schwache
          Seite prüft, bekommt eine mittlere Zahl, die für keine von beiden
          gilt. Was über verschiedene Seiten hinweg trägt, ist das Muster. */}
      {muster.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Repeat size={14} className="text-ink-subtle" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Was immer wieder auftaucht
            </p>
          </div>
          <ul className="space-y-2.5">
            {muster.map((befund) => (
              <li key={befund.id} className="flex items-center gap-3">
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    befund.severity === 'critical'
                      ? 'bg-bad'
                      : befund.severity === 'quickwin'
                        ? 'bg-warn'
                        : 'bg-ink-subtle',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">{befund.bezeichnung}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-subtle">
                  {befund.laeufe} von {letzteErgebnisse.length}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-ink-subtle">
            Über die letzten {letzteErgebnisse.length} Läufe. Pro Lauf zählt jede Art einmal — das zeigt, was
            sich durch deine Seiten zieht, nicht wie viele Bilder gerade fehlen.
          </p>
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
