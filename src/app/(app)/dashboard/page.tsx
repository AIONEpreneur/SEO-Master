import Link from 'next/link'
import { ScanSearch, KeyRound, AlertTriangle, FileText, FolderKanban, Globe, Coins, Repeat } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { availableProviders } from '@/lib/connectors/credentials'
import { providerLabel } from '@/lib/connectors/labels'
import { ButtonLink, Card, CardHeader, EmptyState, ScoreBadge, StatusPill } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import { Onboarding } from '@/components/onboarding'
import { Tour } from '@/components/tour'
import { echteSitzung } from '@/lib/auth/session'
import { verwaltetEigeneZugaenge, siehtAbrechnung, verbleibendeAnalysen } from '@/lib/billing/zugaenge'
import { KOSTEN_ANALYSE } from '@/lib/billing/guthaben'
import { wiederkehrendeBefunde } from '@/lib/analysis/wiederkehrend'
import { Begruessung } from '@/components/begruessung'
import { laengsteReihe, tempowerte } from '@/lib/analysis/uebersicht'
import { Tacho, TempoBalken, BereichsLinien } from '@/components/diagramme'
import { Verlaufskurve } from '@/components/verlaufskurve'
import { NeuigkeitenAufsteller } from '@/components/neuigkeiten-aufsteller'
import { ungeleseneNeuigkeiten } from '@/lib/neuigkeiten'
import { Lightbulb } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireSession()
  // Die Tour beim allerersten Besuch. Der Merker haengt am Konto, nicht am
  // Browser: Wer sie am Rechner gesehen hat, bekommt sie am Telefon nicht
  // noch einmal.
  const konto = await echteSitzung()
  const zeigeTour = Boolean(konto && !konto.tourGesehenAm)

  // Die Neuigkeiten gehören zur angemeldeten Person, nicht zum gezeigten
  // Bereich — und sie warten, bis die Einstiegstour vorbei ist. Zwei
  // Aufsteller übereinander beim allerersten Anmelden wären keine Begrüssung,
  // sondern ein Hindernis.
  const neuigkeiten = konto && !zeigeTour && !session.nurAnsicht
    ? await ungeleseneNeuigkeiten(konto)
    : []

  /*
    Offene Wünsche gehören auf die Übersicht, nicht nur in die Seitenleiste.

    Eine Zahl neben einem Menüpunkt sieht, wer hinschaut. Ein Wunsch ist
    aber eine Frage an die Betreiberin — und eine Frage, die tagelang
    unbeantwortet liegt, ist schlimmer als gar kein Wunschformular: Es hat
    ein Versprechen gegeben. Deshalb steht sie hier, wo ohnehin jeder
    Arbeitstag beginnt, mit dem neuesten Titel als Vorschau.
  */
  const offeneWuensche = session.isSuperAdmin
    ? await db.wunsch.findMany({
        where: { status: 'OFFEN' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, titel: true, organization: { select: { name: true } } },
      })
    : []

  const [
    analyses,
    projectCount,
    completedCount,
    providers,
    geprueft,
    letzteErgebnisse,
    messreihe,
    neuester,
  ] = await Promise.all([
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
    /*
      Die Messreihe für den Verlauf: nur Noten und Datum, keine Ergebnisse.
      Sechzig Läufe reichen für jede sinnvolle Kurve und halten die Abfrage
      klein — die vollständigen Ergebnisse hängen als grosses JSON an jeder
      Analyse und haben auf einer Seite, die bei jedem Anmelden aufgeht,
      nichts verloren.
    */
    db.analysis.findMany({
      where: { organizationId: session.organizationId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        targetUrl: true,
        createdAt: true,
        scoreOverall: true,
        scoreSeo: true,
        scoreAeo: true,
        scoreGeo: true,
        scoreSerp: true,
      },
    }),
    // Die Tempo-Werte stehen in den Rohdaten des jeweiligen Laufs. Nur der
    // neueste wird dafür geholt.
    db.analysis.findFirst({
      where: { organizationId: session.organizationId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, targetUrl: true, createdAt: true, scoreOverall: true, rawData: true },
    }),
  ])

  const reihe = laengsteReihe(messreihe)
  const tempo = tempowerte(neuester?.rawData)

  const muster = wiederkehrendeBefunde(letzteErgebnisse.map((a) => a.result))

  const eigeneZugaenge = verwaltetEigeneZugaenge(session)
  const missingProviders = Object.entries(providers)
    .filter(([, ready]) => !ready)
    .map(([key]) => providerLabel(key as Parameters<typeof providerLabel>[0]))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl">
            <Begruessung name={session.name} />
          </h1>
          <p className="mt-1 text-[13px] font-medium text-ink-muted">{session.organizationName}</p>
        </div>
        <ButtonLink href="/analyses/new">
          <ScanSearch size={16} />
          Neue Analyse
        </ButtonLink>
      </header>

      {zeigeTour && <Tour />}
      {neuigkeiten.length > 0 && <NeuigkeitenAufsteller neuigkeiten={neuigkeiten} />}

      {offeneWuensche.length > 0 && (
        <Link
          href="/admin/wuensche"
          className="karte-hover block rounded-2xl border-2 border-border bg-rosa p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-tinte bg-creme">
              <Lightbulb size={17} className="text-tinte" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[15px] uppercase leading-tight text-tinte">
                {offeneWuensche.length === 1
                  ? 'Ein Wunsch wartet auf Antwort'
                  : `${offeneWuensche.length} Wünsche warten auf Antwort`}
              </p>
              <ul className="mt-2 space-y-1">
                {offeneWuensche.map((w) => (
                  <li key={w.id} className="truncate text-[13px] font-medium text-tinte">
                    „{w.titel}" — {w.organization.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Link>
      )}

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

      {/*
        Wo stehe ich, und geht es aufwärts?

        Das ist die Frage beim Anmelden — nicht "welche Analysen gibt es".
        Deshalb steht sie vor allem anderen. Sie kostet keine einzige neue
        Abfrage: Die Noten stehen an jedem Lauf, die Tempo-Werte in seinen
        Rohdaten. Wer noch nichts gemessen hat, sieht hier nichts; dafür
        steht die Einstiegshilfe darüber.
      */}
      {neuester && (
        <Card className="p-5">
          <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:items-center">
            <Tacho
              wert={neuester.scoreOverall}
              titel="Deine Gesamtnote"
              hinweis={`${kurzeAdresse(neuester.targetUrl)} · ${neuester.createdAt.toLocaleDateString('de-DE')}`}
            />
            {tempo ? (
              <div>
                <p className="mb-3 font-display text-[13px] uppercase text-ink">
                  Wie schnell und sauber die Seite lädt
                </p>
                <TempoBalken werte={tempo} />
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-border/40 p-5">
                <p className="text-[13px] font-medium text-ink-muted">
                  Für diesen Lauf liegen keine Tempo-Werte vor. Sie entstehen mit dem Baustein
                  „SEO“, sobald ein PageSpeed-Zugang hinterlegt ist.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/*
        Vorher–Nachher. Erst ab der zweiten Messung derselben Adresse: Aus
        einem Punkt eine Linie zu zeichnen wäre eine erfundene Entwicklung.
      */}
      {reihe && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <p className="font-display text-[13px] uppercase text-ink">
                Deine Entwicklung
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-ink-subtle">
                {kurzeAdresse(reihe.adresse)} · {reihe.punkte.length} Messungen
                {reihe.spanne > 0 && ` über ${reihe.spanne} Tage`}
              </p>
            </div>
            {reihe.delta !== null && (
              <p className="text-[13px] font-bold text-ink">
                {reihe.delta === 0
                  ? 'Unverändert seit der ersten Messung'
                  : `${reihe.delta > 0 ? 'Aufwärts' : 'Abwärts'}: ${reihe.delta > 0 ? '+' : '−'}${Math.abs(reihe.delta).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Punkte`}
                <span className="ml-1 font-medium text-ink-subtle">
                  (von {reihe.erste.gesamt?.toLocaleString('de-DE', { maximumFractionDigits: 1 })} auf{' '}
                  {reihe.letzte.gesamt?.toLocaleString('de-DE', { maximumFractionDigits: 1 })})
                </span>
              </p>
            )}
          </div>

          <Verlaufskurve
            adresse={reihe.adresse}
            punkte={reihe.punkte.map((p) => ({
              datum: p.datum.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }),
              wert: p.gesamt,
            }))}
          />

          <p className="mb-3 mt-6 font-display text-[13px] uppercase text-ink">
            Die vier Bereiche einzeln
          </p>
          <BereichsLinien punkte={reihe.punkte} />
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

/**
 * Die Adresse in lesbarer Länge.
 *
 * Auf der Übersicht steht sie als Beschriftung neben einer Zahl. Eine
 * vollständige URL mit Parametern würde die Zeile sprengen und sagt an
 * dieser Stelle nichts, was der Host und der Pfad nicht auch sagen.
 */
function kurzeAdresse(url: string): string {
  try {
    const u = new URL(url)
    const pfad = u.pathname === '/' ? '' : u.pathname
    const ganz = u.host.replace(/^www\./, '') + pfad
    return ganz.length > 42 ? `${ganz.slice(0, 41)}…` : ganz
  } catch {
    return url
  }
}
