import Link from 'next/link'
import { Check, KeyRound, FolderKanban, ScanSearch, ArrowRight } from 'lucide-react'
import { db } from '@/lib/db'
import { availableProviders } from '@/lib/connectors/credentials'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils/cn'

/**
 * Einstiegshilfe auf der Übersicht.
 *
 * Der Fortschritt wird aus dem tatsächlichen Zustand abgeleitet, nicht aus
 * einem Merker: Wer die Schritte auf anderem Weg erledigt hat, bekommt sie
 * nicht erneut vorgesetzt. Sind alle erledigt, verschwindet die Hilfe.
 */
export async function Onboarding({ organizationId }: { organizationId: string }) {
  const [providers, projektAnzahl, analyseAnzahl, berichtAnzahl] = await Promise.all([
    availableProviders(organizationId),
    db.project.count({ where: { organizationId } }),
    db.analysis.count({ where: { organizationId } }),
    db.report.count({ where: { analysis: { organizationId } } }),
  ])

  const schritte = [
    {
      erledigt: providers.DATAFORSEO && providers.FIRECRAWL,
      icon: KeyRound,
      titel: 'Zugangsdaten hinterlegen',
      text: 'Ohne DataForSEO gibt es keine Platzierungen, ohne Firecrawl nur das ausgelieferte HTML. Nach dem Eintragen je Anbieter auf „Prüfen" klicken.',
      ziel: '/settings/vault',
      knopf: 'Zum Datentresor',
    },
    {
      erledigt: projektAnzahl > 0,
      icon: FolderKanban,
      titel: 'Projekt anlegen',
      text: 'Ein Projekt hält Website, Markt und Wettbewerber fest. Erst dadurch werden Analysen über die Zeit vergleichbar.',
      ziel: '/projects',
      knopf: 'Projekt anlegen',
    },
    {
      erledigt: analyseAnzahl > 0,
      icon: ScanSearch,
      titel: 'Erste Analyse starten',
      text: 'Adresse eingeben, Bausteine wählen, starten. Der Lauf dauert ein bis fünf Minuten und arbeitet im Hintergrund weiter.',
      ziel: '/analyses/new',
      knopf: 'Analyse starten',
    },
  ]

  // Alles erledigt und ein Bericht vorhanden: die Hilfe hat ihren Zweck erfüllt.
  if (schritte.every((s) => s.erledigt) && berichtAnzahl > 0) return null

  const offen = schritte.findIndex((s) => !s.erledigt)
  const erledigteAnzahl = schritte.filter((s) => s.erledigt).length

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Erste Schritte</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            In drei Schritten zur ersten vollständigen Analyse
          </p>
        </div>
        <span className="text-[13px] tabular-nums text-ink-subtle">
          {erledigteAnzahl} von {schritte.length}
        </span>
      </div>

      <ol className="divide-y divide-border">
        {schritte.map((schritt, i) => {
          const istNaechster = i === offen
          return (
            <li key={schritt.titel} className={cn('flex gap-4 px-5 py-4', schritt.erledigt && 'opacity-60')}>
              <div
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
                  schritt.erledigt
                    ? 'bg-good-subtle text-good'
                    : istNaechster
                      ? 'bg-brand text-white'
                      : 'bg-surface-muted text-ink-subtle',
                )}
              >
                {schritt.erledigt ? <Check size={14} /> : i + 1}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{schritt.titel}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{schritt.text}</p>

                {!schritt.erledigt && (
                  <Link
                    href={schritt.ziel}
                    className={cn(
                      'mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium',
                      istNaechster ? 'text-brand hover:underline' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    {schritt.knopf}
                    <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="border-t border-border bg-surface-muted px-5 py-3">
        <p className="text-[12px] leading-relaxed text-ink-muted">
          <span className="font-medium">Gut zu wissen:</span> Fehlt ein Anbieter, läuft die Analyse
          trotzdem — sie weist die Lücke dann im Bericht aus, statt auf unvollständiger Grundlage zu
          bewerten. Apify wird ausschliesslich für Social-Media-Profile gebraucht.
        </p>
      </div>
    </Card>
  )
}
