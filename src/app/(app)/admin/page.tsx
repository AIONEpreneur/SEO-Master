import Link from 'next/link'
import {
  Building2, Users2, FileText, Clock, ShieldCheck, Repeat, Coins, AlertTriangle,
} from 'lucide-react'
import { requireSuperAdmin } from '@/lib/admin/wache'
import { betriebszahlen, MINUTEN_JE_ANALYSE } from '@/lib/admin/kennzahlen'
import { Card, CardHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function AdminSeite() {
  await requireSuperAdmin()
  const z = await betriebszahlen()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Betrieb</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Zahlen über alle Arbeitsbereiche. Ohne Adressen, ohne Suchbegriffe.
          </p>
        </div>
        <div className="flex gap-2 text-[13px]">
          <Link href="/admin/arbeitsbereiche" className="font-medium text-brand hover:underline">
            Arbeitsbereiche
          </Link>
          <span className="text-ink-subtle">·</span>
          <Link href="/admin/konten" className="font-medium text-brand hover:underline">
            Konten
          </Link>
          <span className="text-ink-subtle">·</span>
          <Link href="/admin/analysen" className="font-medium text-brand hover:underline">
            Läufe
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kachel icon={<Building2 size={15} />} label="Arbeitsbereiche" wert={z.organisationen} />
        <Kachel
          icon={<Users2 size={15} />}
          label="Konten"
          wert={z.konten}
          zusatz={z.gesperrteKonten > 0 ? `${z.gesperrteKonten} gesperrt` : undefined}
        />
        <Kachel
          icon={<FileText size={15} />}
          label="Analysen"
          wert={z.analysenGesamt}
          zusatz={`${z.analysenLetzte30Tage} in 30 Tagen`}
        />
        <Kachel
          icon={<Coins size={15} />}
          label="Anbieterkosten"
          wert={`${(z.kostenCent / 100).toFixed(2).replace('.', ',')} €`}
          zusatz="seit Beginn"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={14} className="text-ink-subtle" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Wirkung</p>
          </div>
          <dl className="space-y-3">
            <Zeile
              begriff="Aufgedeckte Befunde"
              wert={z.befundeGesamt.toLocaleString('de-DE')}
              erlaeuterung="Über die letzten 200 abgeschlossenen Läufe."
            />
            <Zeile
              begriff="Keyword-Recherchen"
              wert={z.recherchen.toLocaleString('de-DE')}
              erlaeuterung="Zusätzlich zu den Analysen."
            />
            <Zeile
              begriff="Eingesparte Zeit"
              wert={`~ ${z.gesparteStunden.toLocaleString('de-DE')} Std.`}
              erlaeuterung={`Geschätzt, nicht gemessen: ${MINUTEN_JE_ANALYSE} Minuten je Analyse, bewusst niedrig angesetzt.`}
            />
          </dl>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock size={14} className="text-ink-subtle" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Zustand</p>
          </div>
          <dl className="space-y-3">
            <Zeile begriff="Gerade in Arbeit" wert={String(z.laufendeAnalysen)} />
            <Zeile
              begriff="Fehlgeschlagen"
              wert={String(z.fehlgeschlagen)}
              erlaeuterung={z.fehlgeschlagen > 0 ? 'Unter „Läufe" nachsehen, woran es lag.' : undefined}
            />
            <Zeile begriff="Offene Einladungen" wert={String(z.offeneEinladungen)} />
          </dl>
        </Card>
      </div>

      {z.haeufigsteBefunde.length > 0 && (
        <Card>
          <CardHeader
            title="Was am häufigsten auffällt"
            description="Über alle Arbeitsbereiche hinweg. Zeigt, worauf sich eine Anleitung oder ein Standard lohnt."
          />
          <ul className="divide-y divide-border">
            {z.haeufigsteBefunde.map((befund) => (
              <li key={befund.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Repeat size={13} className="shrink-0 text-ink-subtle" />
                  <span className="truncate text-[13px]">{befund.bezeichnung}</span>
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-subtle">
                  {befund.laeufe} Läufe
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="flex items-start gap-3 border-border bg-surface-muted p-4">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-ink-subtle" />
        <p className="text-[12px] leading-relaxed text-ink-muted">
          Diese Seite zeigt keine geprüften Adressen und keine eingegebenen Suchbegriffe. Was eine Kundin
          untersucht, bleibt in ihrem Arbeitsbereich.
        </p>
      </Card>
    </div>
  )
}

function Kachel({
  icon, label, wert, zusatz,
}: {
  icon: React.ReactNode
  label: string
  wert: string | number
  zusatz?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-ink-subtle">
        {icon}
        <span className="text-[12px]">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums">{wert}</p>
      {zusatz && <p className="mt-0.5 text-[12px] text-ink-subtle">{zusatz}</p>}
    </Card>
  )
}

function Zeile({ begriff, wert, erlaeuterung }: { begriff: string; wert: string; erlaeuterung?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <dt className="text-[13px]">{begriff}</dt>
        {erlaeuterung && <p className="mt-0.5 text-[12px] leading-snug text-ink-subtle">{erlaeuterung}</p>}
      </div>
      <dd className="shrink-0 text-[13px] font-semibold tabular-nums">{wert}</dd>
    </div>
  )
}
