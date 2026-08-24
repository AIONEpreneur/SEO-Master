import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Search, Bot, Sparkles, Globe, Swords, ArrowRight,
  ShieldCheck, FileText, Gauge,
} from 'lucide-react'
import { getSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'SEO-Master — Sichtbarkeit messen, statt sie zu vermuten',
  description:
    'Analysiert Websites und Social-Profile auf SEO, AEO, GEO, Platzierungen und Wettbewerb. Ergebnis: ein Bericht mit priorisierten Massnahmen.',
}

const DISZIPLINEN = [
  {
    kuerzel: 'SEO',
    icon: Search,
    frage: 'Rankt die Seite bei Google?',
    text: 'Technik, Inhaltstiefe, Keyword-Platzierung, E-E-A-T-Signale und Backlink-Profil — gewichtet nach dem, was tatsächlich zählt.',
  },
  {
    kuerzel: 'AEO',
    icon: Bot,
    frage: 'Erscheint sie in Antwortboxen?',
    text: 'Answer Engine Optimization: Frage-Antwort-Struktur, FAQ-Auszeichnung und die Formate, aus denen Suchmaschinen ihre Antwortboxen füllen.',
  },
  {
    kuerzel: 'GEO',
    icon: Sparkles,
    frage: 'Kennen ChatGPT & Co. sie?',
    text: 'Generative Engine Optimization: Zitierbarkeit, Autoritätssignale und ob KI-Crawler den Inhalt überhaupt lesen können.',
  },
  {
    kuerzel: 'SERP',
    icon: Globe,
    frage: 'Wo steht sie wirklich?',
    text: 'Echte Platzierungen statt Schätzungen. Inklusive KI-Übersichten und der Frage, wer die Antwortflächen oberhalb der Ergebnisse besetzt.',
  },
  {
    kuerzel: 'Wettbewerb',
    icon: Swords,
    frage: 'Wie gross ist der Abstand?',
    text: 'Vergleichszahlen zu den Domains, die sich dieselben Suchergebnisse teilen — und die Themen, die dort ranken und bei Ihnen fehlen.',
  },
]

const SCHRITTE = [
  {
    titel: 'Adresse eingeben',
    text: 'Eine Website-Seite oder ein Profil bei Instagram, LinkedIn, TikTok, YouTube, Facebook oder X.',
  },
  {
    titel: 'Messen lassen',
    text: 'Der Lauf holt Seiteninhalt, Platzierungen, Keyword- und Backlink-Daten und wertet sie nach festen Kriterien aus.',
  },
  {
    titel: 'Bericht bekommen',
    text: 'Bewertungen von 1 bis 10 je Disziplin, dazu eine nach Dringlichkeit und Wirkung sortierte Massnahmenliste.',
  },
]

export default async function Startseite() {
  const session = await getSession()

  return (
    <div className="min-h-dvh">
      {/* Kopfzeile */}
      <header className="sticky top-0 z-20 border-b border-border bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-[13px] font-bold text-white">
              S
            </div>
            <span className="text-sm font-semibold tracking-tight">SEO-Master</span>
          </div>
          <Link
            href={session ? '/dashboard' : '/login'}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover"
          >
            {session ? 'Zum Arbeitsbereich' : 'Anmelden'}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        {/* Aufmacher */}
        <section className="py-20 lg:py-28">
          <p className="text-[13px] font-medium uppercase tracking-wider text-brand">
            Sichtbarkeitsanalyse
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-balance lg:text-5xl">
            Sichtbarkeit messen, statt sie zu vermuten.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
            Eine Adresse eingeben — heraus kommt ein Bericht, der sagt, was funktioniert, was nicht,
            und was als Nächstes zu tun ist. Für Google genauso wie für die KI-Systeme, über die
            heute immer mehr Menschen suchen.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href={session ? '/analyses/new' : '/login'}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              {session ? 'Neue Analyse starten' : 'Anmelden'}
              <ArrowRight size={16} />
            </Link>
            <span className="text-[13px] text-ink-subtle">
              Zugang derzeit auf Einladung
            </span>
          </div>
        </section>

        {/* Die fünf Disziplinen */}
        <section className="border-t border-border py-16 lg:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Fünf Fragen, eine Analyse</h2>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Sichtbarkeit entscheidet sich längst nicht mehr nur bei Google. Jede Disziplin bekommt
            eine eigene Bewertung — und eigene Massnahmen.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DISZIPLINEN.map((d) => (
              <div
                key={d.kuerzel}
                className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center gap-2.5">
                  <d.icon size={17} className="text-brand" />
                  <span className="text-sm font-semibold">{d.kuerzel}</span>
                </div>
                <p className="mt-3 text-[14px] font-medium">{d.frage}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{d.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ablauf */}
        <section className="border-t border-border py-16 lg:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Wie es abläuft</h2>

          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {SCHRITTE.map((s, i) => (
              <li key={s.titel} className="flex flex-col gap-2">
                <span className="font-mono text-[13px] text-brand">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] font-semibold">{s.titel}</span>
                <span className="text-[13px] leading-relaxed text-ink-muted">{s.text}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Haltung */}
        <section className="border-t border-border py-16 lg:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Wofür der Bericht taugt</h2>

          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            <div>
              <Gauge size={18} className="text-brand" />
              <p className="mt-3 text-[15px] font-semibold">Vergleichbar über die Zeit</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                Die Bewertungen entstehen aus festen, messbaren Kriterien. Zwei Läufe über dieselbe
                Seite ergeben dieselbe Note — sonst liesse sich Fortschritt nicht von Rauschen
                unterscheiden.
              </p>
            </div>
            <div>
              <FileText size={18} className="text-brand" />
              <p className="mt-3 text-[15px] font-semibold">Konkret genug zum Loslegen</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                Keine Hinweise wie „Meta Description verbessern", sondern der fertige Vorschlagstext.
                Jeder Befund nennt Aufwand und erwartete Wirkung.
              </p>
            </div>
            <div>
              <ShieldCheck size={18} className="text-brand" />
              <p className="mt-3 text-[15px] font-semibold">Ehrlich über Lücken</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                Was nicht gemessen werden konnte, steht als solches im Bericht. Eine Bewertung auf
                Basis fehlender Daten wäre wertlos.
              </p>
            </div>
          </div>
        </section>

        {/* Abschluss */}
        <section className="border-t border-border py-16 lg:py-20">
          <div className="rounded-xl border border-border bg-surface p-8 lg:p-10">
            <h2 className="text-xl font-semibold tracking-tight">
              {session ? 'Bereit für den nächsten Lauf' : 'Zugang'}
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">
              {session
                ? 'Der Arbeitsbereich enthält alle bisherigen Analysen, Projekte und Berichte.'
                : 'Diese Instanz wird derzeit intern betrieben. Neue Arbeitsbereiche werden auf Anfrage eingerichtet.'}
            </p>
            <Link
              href={session ? '/dashboard' : '/login'}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              {session ? 'Zum Arbeitsbereich' : 'Anmelden'}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6">
          <span className="text-[13px] text-ink-subtle">
            SEO-Master — SEO, AEO, GEO, SERP und Wettbewerb in einem Bericht
          </span>
          <Link href="/login" className="text-[13px] text-ink-muted hover:text-ink">
            Anmelden
          </Link>
        </div>
      </footer>
    </div>
  )
}
