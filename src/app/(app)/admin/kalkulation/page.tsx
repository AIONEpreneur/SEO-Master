import Link from 'next/link'
import { ArrowLeft, Info } from 'lucide-react'
import { requireSuperAdmin } from '@/lib/admin/wache'
import { kostenlage } from '@/lib/admin/kalkulation'
import { Card, CardHeader } from '@/components/ui'
import { Rechner } from './rechner'

export const dynamic = 'force-dynamic'

export default async function KalkulationsSeite() {
  await requireSuperAdmin()
  const lage = await kostenlage()

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft size={14} />
          Betrieb
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Kalkulation</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Was ein Lauf wirklich kostet — gemessen an den abgerechneten Läufen, nicht geschätzt.
        </p>
      </header>

      {lage.grundlage === 0 ? (
        <Card className="flex items-start gap-3 p-5">
          <Info size={15} className="mt-0.5 shrink-0 text-ink-subtle" />
          <p className="text-[13px] text-ink-muted">
            Noch keine abgerechneten Läufe. Im internen Arbeitsbereich fallen keine Kosten an — sobald der
            erste Lauf über einen zahlenden Bereich läuft, steht hier die echte Rechnung.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kachel label="Üblicher Lauf" cent={lage.medianCent} zusatz="Median" />
            <Kachel label="Durchschnitt" cent={lage.durchschnittCent} zusatz={`${lage.grundlage} Läufe`} />
            <Kachel label="Teure Läufe" cent={lage.obereGrenzeCent} zusatz="9 von 10 darunter" />
            <Kachel label="Teuerster Lauf" cent={lage.teuersterCent} zusatz="bisher gemessen" />
          </div>

          <Card className="flex items-start gap-3 border-border bg-surface-muted p-4">
            <Info size={15} className="mt-0.5 shrink-0 text-ink-subtle" />
            <p className="text-[12px] leading-relaxed text-ink-muted">
              Rechne mit der Spalte <strong className="font-medium">Teure Läufe</strong>, nicht mit dem
              Durchschnitt. Ein Kontingent ist ein Versprechen — und wer es ausschöpft, prüft meist grosse
              Seiten mit allen Bausteinen. Der Durchschnitt sagt, was üblich ist; die obere Grenze sagt, was
              du aushalten musst.
            </p>
          </Card>

          <Rechner
            medianCent={lage.medianCent}
            obereGrenzeCent={lage.obereGrenzeCent}
            laeufeJeBereichImMonat={lage.laeufeJeBereichImMonat || 4}
          />

          <Card>
            <CardHeader title="Bisherige Nutzung" />
            <dl className="divide-y divide-border">
              <Zeile
                begriff="Aktive Arbeitsbereiche"
                wert={String(lage.aktiveBereiche)}
                erlaeuterung="Mit mindestens einem Lauf in den letzten 90 Tagen."
              />
              <Zeile
                begriff="Läufe je Bereich und Monat"
                wert={String(lage.laeufeJeBereichImMonat)}
                erlaeuterung="Beobachtet über 90 Tage. Das ist die Zahl, mit der ein Preis kalkuliert werden muss."
              />
              <Zeile
                begriff="Anbieterkosten insgesamt"
                wert={`${(lage.gesamtCent / 100).toFixed(2).replace('.', ',')} €`}
                erlaeuterung="Über die berücksichtigten Läufe."
              />
            </dl>
          </Card>
        </>
      )}
    </div>
  )
}

function Kachel({ label, cent, zusatz }: { label: string; cent: number; zusatz: string }) {
  return (
    <Card className="p-4">
      <p className="text-[12px] text-ink-subtle">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums">
        {(cent / 100).toFixed(2).replace('.', ',')} €
      </p>
      <p className="mt-0.5 text-[12px] text-ink-subtle">{zusatz}</p>
    </Card>
  )
}

function Zeile({ begriff, wert, erlaeuterung }: { begriff: string; wert: string; erlaeuterung: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <dt className="text-[13px]">{begriff}</dt>
        <p className="mt-0.5 text-[12px] leading-snug text-ink-subtle">{erlaeuterung}</p>
      </div>
      <dd className="shrink-0 text-[13px] font-semibold tabular-nums">{wert}</dd>
    </div>
  )
}
