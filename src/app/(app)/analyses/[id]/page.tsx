import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download, ExternalLink, RotateCw } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Button, ButtonLink, Card, CardHeader, ScoreBadge, ScoreBar, ScoreRing, SeverityPill, StatusPill } from '@/components/ui'
import { restartAnalysisAction } from '@/lib/analysis/actions'
import type { AnalysisResult } from '@/lib/analysis/types'
import { ProgressWatcher } from './progress'
import { ReportView } from './report-view'

export const dynamic = 'force-dynamic'

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params

  const analysis = await db.analysis.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      reports: { orderBy: { createdAt: 'desc' }, take: 1 },
      project: { select: { name: true, id: true } },
    },
  })

  if (!analysis) notFound()

  const result = analysis.result as AnalysisResult | null
  const report = analysis.reports[0] ?? null
  const isRunning = analysis.status === 'QUEUED' || analysis.status === 'RUNNING'

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/analyses"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={14} />
          Alle Analysen
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{analysis.targetUrl}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
              <span>
                {analysis.createdAt.toLocaleString('de-DE', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span>·</span>
              <span>{analysis.modules.join(', ')}</span>
              {analysis.project && (
                <>
                  <span>·</span>
                  <Link href="/projects" className="hover:underline">
                    {analysis.project.name}
                  </Link>
                </>
              )}
              <a
                href={analysis.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-brand"
              >
                <ExternalLink size={12} />
                Seite öffnen
              </a>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={analysis.status} />
            <ScoreBadge score={analysis.scoreOverall} size="lg" />
          </div>
        </div>
      </div>

      {isRunning && <ProgressWatcher analysisId={analysis.id} initialProgress={analysis.progress} initialStep={analysis.currentStep} />}

      {analysis.status === 'FAILED' && (
        <Card className="border-bad/30 bg-bad-subtle p-4">
          <p className="text-[13px] font-medium">Der Lauf ist fehlgeschlagen</p>
          <p className="mt-1 text-[13px] text-ink-muted">{analysis.error}</p>
          <form action={restartAnalysisAction} className="mt-3">
            <input type="hidden" name="id" value={analysis.id} />
            <Button type="submit" size="sm" variant="secondary">
              <RotateCw size={15} />
              Mit denselben Einstellungen wiederholen
            </Button>
          </form>
        </Card>
      )}

      {analysis.status === 'CANCELLED' && (
        <Card className="p-4">
          <p className="text-[13px] font-medium">Der Lauf wurde abgebrochen</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Es wurde nichts ausgewertet und nichts vom Guthaben abgezogen.
          </p>
          <form action={restartAnalysisAction} className="mt-3">
            <input type="hidden" name="id" value={analysis.id} />
            <Button type="submit" size="sm" variant="secondary">
              <RotateCw size={15} />
              Erneut starten
            </Button>
          </form>
        </Card>
      )}

      {result && (
        <>
          {/*
            Der Umfang steht ganz oben, gleichberechtigt neben dem Ziel.
            Eine Analyse über eine Seite darf nicht wie ein Urteil über die
            ganze Website gelesen werden – genau das ist passiert.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Umfang · {result.meta.scope.pages === 1 ? '1 Seite' : `${result.meta.scope.pages} Seiten`}
            </span>
            <span className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              {result.meta.market}
            </span>
            {result.meta.keyword.value && (
              <span className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                Keyword · {result.meta.keyword.value}
                {result.meta.keyword.source === 'abgeleitet' && ' (abgeleitet)'}
              </span>
            )}
            <span className="text-[12px] text-ink-subtle">{result.meta.scope.note}</span>
          </div>

          {result.executiveSummary && (
            <Card className="p-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Kurzfazit</p>
              <p className="text-sm leading-relaxed">{result.executiveSummary}</p>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.modules.map((module) => (
              <Card key={module.module} className="p-4">
                <div className="mb-4 flex items-center gap-4">
                  <ScoreRing score={module.score} size={58} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">{module.module}</p>
                    <p className="text-[12px] text-ink-subtle">{module.label}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {module.criteria
                    .filter((c) => c.status !== 'unknown')
                    .slice(0, 5)
                    .map((c) => (
                      <ScoreBar key={c.key} score={c.score} label={c.label} />
                    ))}
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Datenquellen
            </p>
            {result.meta.providersUsed.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {result.meta.providersUsed.map((anbieter) => (
                  <span
                    key={anbieter}
                    className="inline-flex h-6 items-center rounded-full bg-good-subtle px-2.5 text-[12px] font-medium text-good"
                  >
                    {anbieter}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink-muted">
                Keine externen Datenquellen genutzt – bewertet wurde allein der abgerufene Seiteninhalt.
              </p>
            )}
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-subtle">
              Apify wird ausschliesslich für Social-Media-Profile herangezogen und bleibt bei
              Website-Analysen aussen vor. Firecrawl lädt die Seite mit ausgeführtem JavaScript;
              fehlt es, wird nur das ausgelieferte HTML gemessen. Anthropic formuliert den Bericht.
            </p>
          </Card>

          {result.meta.skipped.length > 0 && (
            <Card className="border-warn/30 bg-warn-subtle p-4">
              <p className="text-[13px] font-medium">Nicht erhoben</p>
              <ul className="mt-1.5 space-y-1">
                {result.meta.skipped.map((s, i) => (
                  <li key={i} className="text-[13px] text-ink-muted">
                    <span className="font-medium">{s.module}:</span> {s.reason}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {result.priorities.length > 0 && (
            <Card>
              <CardHeader
                title="Handlungsempfehlungen"
                description={`${result.priorities.length} Befunde, nach Dringlichkeit und Wirkung sortiert`}
              />
              <ul className="divide-y divide-border">
                {result.priorities.map((finding) => (
                  <li key={finding.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <SeverityPill severity={finding.severity} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold">{finding.title}</p>
                        <p className="mt-1 text-[13px] text-ink-muted">{finding.why}</p>
                        <p className="mt-2 text-[13px]">
                          <span className="font-medium">Zu tun: </span>
                          {finding.action}
                        </p>
                        <p className="mt-1.5 text-[12px] text-ink-subtle">
                          Aufwand: {finding.effort} · Wirkung: {finding.impact}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {report && (
            <Card>
              <CardHeader
                title="Vollständiger Bericht"
                action={
                  // Ein <button> innerhalb eines <a> ist ungültiges HTML; der
                  // Klick landet dann beim Knopf statt beim Link, und der
                  // Download startet nie. Deshalb ein gestalteter Link.
                  <a
                    href={`/api/reports/${report.id}/download`}
                    download
                    className="inline-flex h-8 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-[13px] font-medium transition-colors hover:bg-surface-muted"
                  >
                    <Download size={14} />
                    Markdown
                  </a>
                }
              />
              <div className="p-5">
                <ReportView markdown={report.markdown} />
              </div>
            </Card>
          )}

          <DetailTables result={result} />
        </>
      )}
    </div>
  )
}

/** Rohdaten je Baustein, soweit sie für die Umsetzung nützlich sind. */
function DetailTables({ result }: { result: AnalysisResult }) {
  const serp = result.modules.find((m) => m.module === 'SERP')
  const competitors = result.modules.find((m) => m.module === 'COMPETITORS')

  const striking = (serp?.data.strikingDistance ?? []) as Array<{
    keyword: string; position: number; volume: number; difficulty: number | null
  }>
  const gaps = (competitors?.data.keywordGaps ?? []) as Array<{
    keyword: string; volume: number; difficulty: number | null; competitor: string; competitorPosition: number | null
  }>
  const rivals = (competitors?.data.competitors ?? []) as Array<{
    domain: string; keywordsTop100: number | null; estimatedTraffic: number | null; referringDomains: number | null
  }>

  return (
    <>
      {striking.length > 0 && (
        <Card>
          <CardHeader
            title="Knapp vor der ersten Seite"
            description="Positionen 11–25: die Seiten mit dem besten Verhältnis von Aufwand zu Wirkung"
          />
          <div className="scroll-x">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-5 py-2 font-medium">Keyword</th>
                  <th className="px-3 py-2 font-medium">Position</th>
                  <th className="px-3 py-2 font-medium">Suchvolumen</th>
                  <th className="px-5 py-2 font-medium">Schwierigkeit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {striking.slice(0, 12).map((k) => (
                  <tr key={k.keyword}>
                    <td className="px-5 py-2">{k.keyword}</td>
                    <td className="px-3 py-2 tabular-nums">{k.position}</td>
                    <td className="px-3 py-2 tabular-nums">{k.volume.toLocaleString('de-DE')}</td>
                    <td className="px-5 py-2 tabular-nums">{k.difficulty ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {rivals.length > 0 && (
        <Card>
          <CardHeader title="Wettbewerbsumfeld" />
          <div className="scroll-x">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-5 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium">Keywords</th>
                  <th className="px-3 py-2 font-medium">Traffic/Monat</th>
                  <th className="px-5 py-2 font-medium">Verweisende Domains</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rivals.map((r) => (
                  <tr key={r.domain}>
                    <td className="px-5 py-2">{r.domain}</td>
                    <td className="px-3 py-2 tabular-nums">{r.keywordsTop100?.toLocaleString('de-DE') ?? '–'}</td>
                    <td className="px-3 py-2 tabular-nums">{r.estimatedTraffic?.toLocaleString('de-DE') ?? '–'}</td>
                    <td className="px-5 py-2 tabular-nums">{r.referringDomains?.toLocaleString('de-DE') ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {gaps.length > 0 && (
        <Card>
          <CardHeader
            title="Themenlücken"
            description="Suchanfragen, für die Wettbewerber ranken und die eigene Domain nicht"
          />
          <div className="scroll-x">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-5 py-2 font-medium">Keyword</th>
                  <th className="px-3 py-2 font-medium">Suchvolumen</th>
                  <th className="px-3 py-2 font-medium">Schwierigkeit</th>
                  <th className="px-5 py-2 font-medium">Wettbewerber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {gaps.slice(0, 15).map((g, i) => (
                  <tr key={`${g.keyword}-${i}`}>
                    <td className="px-5 py-2">{g.keyword}</td>
                    <td className="px-3 py-2 tabular-nums">{g.volume.toLocaleString('de-DE')}</td>
                    <td className="px-3 py-2 tabular-nums">{g.difficulty ?? '–'}</td>
                    <td className="px-5 py-2">
                      {g.competitor}
                      {g.competitorPosition ? ` (Pos. ${g.competitorPosition})` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
