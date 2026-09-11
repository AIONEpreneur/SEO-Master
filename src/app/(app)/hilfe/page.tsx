import Link from 'next/link'
import {
  ScanSearch, TrendingUp, ListOrdered, FolderKanban, Swords, Puzzle, Bot, FileText, Coins,
  RotateCcw, ArrowRight,
} from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { verwaltetEigeneZugaenge } from '@/lib/billing/zugaenge'
import { Card, CardHeader, Button } from '@/components/ui'
import { tourZuruecksetzen } from '@/lib/onboarding/actions'

export const dynamic = 'force-dynamic'

/**
 * Erste Schritte — was wo passiert.
 *
 * Die Seite beantwortet genau eine Frage: „Ich will X tun, wo mache ich
 * das?" Deshalb ist sie nach Vorhaben sortiert, nicht nach Menüpunkten, und
 * jeder Abschnitt endet mit dem Verweis dorthin.
 */
const BEREICHE = [
  {
    icon: ScanSearch,
    farbe: 'bg-orange',
    titel: 'Eine Website analysieren',
    text: 'Adresse eingeben, Bausteine wählen, starten. Der Lauf dauert ein bis fünf Minuten. Heraus kommt ein Bericht mit Noten für SEO, AEO und GEO, den echten Platzierungen bei Google und einer nach Dringlichkeit sortierten Liste, was zu tun ist.',
    tipp: 'Gib eigene Suchbegriffe an, wenn du welche hast — sonst leitet das Werkzeug sie aus der Seite ab, und das ist immer nur eine Vermutung.',
    ziel: { href: '/analyses/new', text: 'Neue Analyse starten' },
  },
  {
    icon: TrendingUp,
    farbe: 'bg-limette',
    titel: 'Wissen, wonach gesucht wird',
    text: 'Ein Begriff genügt. Du bekommst die verwandten Suchanfragen mit Suchvolumen, Klickpreis, Schwierigkeit und Suchabsicht — samt Zwölfmonatsverlauf. Der Klickpreis verrät, wo Geld im Spiel ist.',
    tipp: 'Über „Für KI kopieren" nimmst du die ganze Liste mit nach Claude oder ChatGPT — mit echten Zahlen statt Vermutungen.',
    ziel: { href: '/keywords', text: 'Zur Keyword-Recherche' },
  },
  {
    icon: ListOrdered,
    farbe: 'bg-rosa',
    titel: 'Sehen, wofür eine Seite rankt',
    text: 'Jede Ranking-Abfrage aus der Browser-Extension landet hier: Keyword, Position, Suchvolumen und die rankende Unterseite — für die eigene Domain wie für die einer Mitbewerberin.',
    tipp: null,
    ziel: { href: '/rankings', text: 'Zu den Ranking-Abfragen' },
  },
  {
    icon: FolderKanban,
    farbe: 'bg-blau',
    titel: 'Fortschritt sichtbar machen',
    text: 'Ordne Analysen einem Projekt zu. Erst dann kann das Werkzeug vergleichen und dir sagen, ob sich etwas verbessert hat — ohne Projekt bleibt jede Analyse eine Momentaufnahme.',
    tipp: null,
    ziel: { href: '/projects', text: 'Zu den Projekten' },
  },
  {
    icon: Swords,
    farbe: 'bg-creme',
    titel: 'Den Wettbewerb einschätzen',
    text: 'Wer besetzt dieselben Suchergebnisse, und welche Themen fehlen dir? Domains, die nur ein einzelnes Keyword mit dir teilen, werden aussortiert — Namensähnlichkeit ist kein Wettbewerb.',
    tipp: null,
    ziel: { href: '/competitors', text: 'Zum Wettbewerb' },
  },
  {
    icon: Puzzle,
    farbe: 'bg-sand',
    titel: 'Im Browser und in der KI arbeiten',
    text: 'Die SEO4U-Extension zeigt auf jeder Website per Klick die Rankings. Und über die KI-Anbindung holen sich Claude oder ChatGPT deine Daten selbst — nach Anmeldung und deiner Zustimmung.',
    tipp: 'Beides richtest du mit demselben Zugangsschlüssel ein.',
    ziel: { href: '/settings/extension', text: 'Zur Einrichtung' },
  },
]

export default async function HilfeSeite() {
  const session = await requireSession()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl">Erste Schritte</h1>
        <p className="mt-1 text-[13px] font-medium text-ink-muted">
          Was wo passiert — sortiert danach, was du vorhast.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {BEREICHE.map((b) => (
          <div
            key={b.titel}
            className={`flex flex-col gap-3 rounded-2xl border-2 border-border p-6 ${b.farbe}`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-tinte bg-creme">
              <b.icon size={20} className="text-tinte" />
            </span>
            <p className="font-display text-[17px] uppercase text-tinte">{b.titel}</p>
            <p className="text-[14px] font-medium leading-relaxed text-tinte">{b.text}</p>
            {b.tipp && (
              <p className="rounded-xl border-2 border-tinte bg-creme/70 px-3.5 py-2.5 text-[13px] font-medium text-tinte">
                <span className="font-bold">Tipp: </span>
                {b.tipp}
              </p>
            )}
            <Link
              href={b.ziel.href}
              className="lift mt-auto inline-flex w-fit items-center gap-2 rounded-full border-2 border-tinte bg-tinte px-5 py-2.5 text-[14px] font-bold text-creme"
            >
              {b.ziel.text}
              <ArrowRight size={15} />
            </Link>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Gut zu wissen" />
        <div className="divide-y-2 divide-border">
          <Punkt
            icon={<FileText size={16} />}
            titel="Ein Lauf liest genau die Seiten, die du angibst"
            text="Standardmässig ist das die eingegebene Adresse. Wähle beim Start einen grösseren Umfang, wenn der Bericht die ganze Website beurteilen soll — sonst gilt jeder Befund nur für diese eine Seite."
          />
          <Punkt
            icon={<Bot size={16} />}
            titel="SEO, AEO und GEO sind drei verschiedene Fragen"
            text="SEO fragt, ob Google die Seite findet. AEO, ob sie in der Antwortbox landet. GEO, ob ChatGPT und Perplexity sie kennen und zitieren können. Eine Seite kann bei einem stark und beim anderen schwach sein."
          />
          {siehtGuthaben(session) && (
            <Punkt
              icon={<Coins size={16} />}
              titel="Jeder Lauf kostet Kontingent"
              text="Analysen und Recherchen fragen bezahlte Datendienste ab. Wie viel noch frei ist, steht unten in der Seitenleiste — und im Konto siehst du, wie du mehr bekommst."
            />
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[14px] font-bold">Die Einstiegstour noch einmal ansehen</p>
            <p className="mt-1 text-[13px] font-medium text-ink-muted">
              Zeigt beim nächsten Aufruf der Übersicht wieder die fünf Karten vom Anfang.
            </p>
          </div>
          <form action={tourZuruecksetzen}>
            <Button type="submit" variant="secondary" size="sm">
              <RotateCcw size={14} />
              Tour wiederholen
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}

function siehtGuthaben(session: Awaited<ReturnType<typeof requireSession>>): boolean {
  // Interne Arbeitsbereiche rechnen nicht ab — der Hinweis wäre dort falsch.
  return !verwaltetEigeneZugaenge(session) || session.plan !== 'INTERNAL'
}

function Punkt({ icon, titel, text }: { icon: React.ReactNode; titel: string; text: string }) {
  return (
    <div className="flex gap-4 p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-bold">{titel}</p>
        <p className="mt-1 text-[13px] font-medium leading-relaxed text-ink-muted">{text}</p>
      </div>
    </div>
  )
}
