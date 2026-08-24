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
      text: 'DataForSEO für Platzierungen, Firecrawl für den Seiteninhalt.',
      ziel: '/settings/vault',
      knopf: 'Zum Datentresor',
    },
    {
      erledigt: projektAnzahl > 0,
      icon: FolderKanban,
      titel: 'Projekt anlegen',
      text: 'Macht Analysen über die Zeit vergleichbar.',
      ziel: '/projects',
      knopf: 'Projekt anlegen',
    },
    {
      erledigt: analyseAnzahl > 0,
      icon: ScanSearch,
      titel: 'Erste Analyse starten',
      text: 'Adresse eingeben, starten. Dauert ein bis fünf Minuten.',
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
      {/*
        Waagerecht statt untereinander: Die drei Schritte sind eine kurze
        Abfolge, kein Textabschnitt. Gestapelt beanspruchten sie den halben
        Bildschirm und standen damit vor dem, wofür die Übersicht da ist.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Erste Schritte</h2>
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${(erledigteAnzahl / schritte.length) * 100}%` }}
            />
          </div>
          <span className="text-[12px] tabular-nums text-ink-subtle">
            {erledigteAnzahl}/{schritte.length}
          </span>
        </div>
      </div>

      <ol className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
        {schritte.map((schritt, i) => {
          const istNaechster = i === offen
          return (
            <li
              key={schritt.titel}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                schritt.erledigt
                  ? 'border-border bg-surface-muted/50'
                  : istNaechster
                    ? 'border-brand/40 bg-brand-subtle'
                    : 'border-border',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
                    schritt.erledigt
                      ? 'bg-good-subtle text-good'
                      : istNaechster
                        ? 'bg-brand text-white'
                        : 'bg-surface-muted text-ink-subtle',
                  )}
                >
                  {schritt.erledigt ? <Check size={14} /> : i + 1}
                </span>
                <schritt.icon
                  size={15}
                  className={cn('shrink-0', istNaechster ? 'text-brand' : 'text-ink-subtle')}
                />
              </div>

              <p className={cn('mt-3 text-[13px] font-medium', schritt.erledigt && 'text-ink-muted')}>
                {schritt.titel}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{schritt.text}</p>

              {!schritt.erledigt && (
                <Link
                  href={schritt.ziel}
                  className={cn(
                    'mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium',
                    istNaechster ? 'text-brand hover:underline' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {schritt.knopf}
                  <ArrowRight size={12} />
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
