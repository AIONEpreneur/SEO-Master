import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Coins, Search, ShoppingCart, Sparkles } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Card, CardHeader } from '@/components/ui'
import {
  ABSICHT_ERKLAERUNG,
  lohnendeBegriffe,
  type KeywordZeile,
  type Zusammenfassung,
} from '@/lib/keywords/research'
import { KeywordTabelle } from './table'

export const dynamic = 'force-dynamic'

const MARKTNAMEN: Record<number, string> = {
  2276: 'Deutschland', 2040: 'Österreich', 2756: 'Schweiz',
  2826: 'Vereinigtes Königreich', 2840: 'USA',
}

export default async function KeywordResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params

  const research = await db.keywordResearch.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!research) notFound()

  const zeilen = research.rows as unknown as KeywordZeile[]
  const summary = research.summary as unknown as Zusammenfassung & { quellenFehler?: string | null }
  const lohnend = lohnendeBegriffe(zeilen)

  // Anteil der Nachfrage, hinter der eine Kauf- oder Vergleichsabsicht steht.
  const anteilKauf = summary.suchenGesamt > 0
    ? Math.round((summary.suchenMitKaufabsicht / summary.suchenGesamt) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <Link href="/keywords" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft size={14} />
          Alle Recherchen
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{research.seed}</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {MARKTNAMEN[research.locationCode] ?? research.locationCode} ·{' '}
          {research.createdAt.toLocaleString('de-DE', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kennzahl
          icon={<Search size={15} />}
          label="Begriffe gefunden"
          wert={summary.begriffe.toLocaleString('de-DE')}
          hinweis="mit messbarem Suchvolumen"
        />
        <Kennzahl
          icon={<Sparkles size={15} />}
          label="Suchen im Monat"
          wert={summary.suchenGesamt.toLocaleString('de-DE')}
          hinweis="über alle Begriffe zusammen"
        />
        <Kennzahl
          icon={<Coins size={15} />}
          label="Werbewert im Monat"
          wert={`${summary.anzeigenwertGesamt.toLocaleString('de-DE')} €`}
          hinweis="was für diese Begriffe an Werbung ausgegeben würde"
        />
        <Kennzahl
          icon={<ShoppingCart size={15} />}
          label="Davon Kaufabsicht"
          wert={`${anteilKauf} %`}
          hinweis={`${summary.mitKaufabsicht} Begriffe, ${summary.anzeigenwertMitKaufabsicht.toLocaleString('de-DE')} € Werbewert`}
        />
      </div>

      <Card className="p-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Was das heisst</p>
        <p className="text-sm leading-relaxed">{lies(summary, anteilKauf)}</p>
      </Card>

      {lohnend.length > 0 && (
        <Card>
          <CardHeader
            title="Hier lohnt sich der Aufwand zuerst"
            description="Begriffe, für die Geld ausgegeben wird und deren erste Seite trotzdem erreichbar ist (Schwierigkeit bis 30)."
          />
          <div className="scroll-x">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-5 py-2.5 font-medium">Begriff</th>
                  <th className="px-3 py-2.5 font-medium">Suchen/Monat</th>
                  <th className="px-3 py-2.5 font-medium">Klickpreis</th>
                  <th className="px-3 py-2.5 font-medium">Werbewert</th>
                  <th className="px-5 py-2.5 font-medium">Schwierigkeit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lohnend.map((z) => (
                  <tr key={z.begriff}>
                    <td className="px-5 py-2.5 font-medium">{z.begriff}</td>
                    <td className="px-3 py-2.5 tabular-nums">{z.suchvolumen.toLocaleString('de-DE')}</td>
                    <td className="px-3 py-2.5 tabular-nums">{z.klickpreis.toFixed(2).replace('.', ',')} €</td>
                    <td className="px-3 py-2.5 tabular-nums font-medium">{z.anzeigenwert.toLocaleString('de-DE')} €</td>
                    <td className="px-5 py-2.5 tabular-nums text-good">{z.schwierigkeit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Alle Begriffe" description="Spaltenüberschrift anklicken, um danach zu sortieren." />
        <KeywordTabelle zeilen={zeilen} />
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          Die vier Suchabsichten
        </p>
        <dl className="space-y-2.5">
          {(['kauf', 'vergleich', 'information', 'marke'] as const).map((a) => (
            <div key={a} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="w-24 shrink-0 text-[13px] font-medium capitalize">{a}</dt>
              <dd className="text-[13px] text-ink-muted">{ABSICHT_ERKLAERUNG[a]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {summary.quellenFehler && (
        <p className="text-[12px] text-ink-subtle">
          Die verwandten Suchanfragen liessen sich nicht abrufen ({summary.quellenFehler}). Die Liste
          beruht auf den Begriffen, die „{research.seed}" enthalten.
        </p>
      )}
    </div>
  )
}

function Kennzahl({
  icon, label, wert, hinweis,
}: { icon: React.ReactNode; label: string; wert: string; hinweis: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        <span className="text-brand">{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight">{wert}</p>
      <p className="mt-0.5 text-[12px] text-ink-subtle">{hinweis}</p>
    </Card>
  )
}

/**
 * Ein Satz, der die Zahlen einordnet.
 *
 * Bewusst fest berechnet und nicht von einem Sprachmodell erzeugt: Diese
 * Aussage entscheidet mit darüber, wo Arbeitszeit hingeht, und muss deshalb
 * bei gleichen Zahlen jedes Mal gleich ausfallen.
 */
function lies(summary: Zusammenfassung & { quellenFehler?: string | null }, anteilKauf: number): string {
  const teile: string[] = []

  teile.push(
    `Rund um diesen Begriff wird ${summary.suchenGesamt.toLocaleString('de-DE')} Mal im Monat gesucht, verteilt auf ${summary.begriffe} Suchanfragen.`,
  )

  if (summary.anzeigenwertGesamt > 0) {
    teile.push(
      `Würde jede dieser Suchen einen bezahlten Klick auslösen, entspräche das ${summary.anzeigenwertGesamt.toLocaleString('de-DE')} € Werbeausgaben im Monat – das ist der Massstab dafür, wie viel dieses Themenfeld wert ist.`,
    )
  } else {
    teile.push(
      'Für diese Begriffe wird praktisch keine Werbung geschaltet. Das spricht für ein Feld ohne kaufkräftige Nachfrage – oder für eines, das noch niemand erschlossen hat.',
    )
  }

  if (anteilKauf >= 40) {
    teile.push(
      `${anteilKauf} % der Nachfrage trägt eine Kauf- oder Vergleichsabsicht. Hier wird nicht nur gelesen, hier wird ausgewählt.`,
    )
  } else if (anteilKauf > 0) {
    teile.push(
      `Nur ${anteilKauf} % der Nachfrage trägt eine Kauf- oder Vergleichsabsicht; der Rest sucht Wissen. Inhalte zahlen sich hier über Vertrauen aus, nicht über den direkten Abschluss.`,
    )
  }

  if (summary.teuersterBegriff) {
    const t = summary.teuersterBegriff
    teile.push(
      `Am meisten zahlen Werbetreibende für „${t.begriff}": ${t.klickpreis.toFixed(2).replace('.', ',')} € je Klick.`,
    )
  }

  return teile.join(' ')
}
