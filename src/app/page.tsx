import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Search, Bot, Sparkles, Globe, Swords, ArrowRight,
  ShieldCheck, FileText, Gauge, TrendingUp, Lock,
} from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { Produktvorschau } from '@/components/produktvorschau'

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
  {
    kuerzel: 'Keywords',
    icon: TrendingUp,
    frage: 'Wo wird Geld ausgegeben?',
    text: 'Suchvolumen, Klickpreise und Suchabsicht zu jedem Begriff — und damit die Antwort, welche Themen Nachfrage haben und welche nur Arbeit machen.',
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

const HALTUNG = [
  {
    icon: Gauge,
    titel: 'Vergleichbar über die Zeit',
    text: 'Die Bewertungen entstehen aus festen, messbaren Kriterien. Zwei Läufe über dieselbe Seite ergeben dieselbe Note — sonst liesse sich Fortschritt nicht von Rauschen unterscheiden.',
  },
  {
    icon: FileText,
    titel: 'Konkret genug zum Loslegen',
    text: 'Keine Hinweise wie „Meta Description verbessern", sondern der fertige Vorschlagstext. Jeder Befund nennt Aufwand und erwartete Wirkung.',
  },
  {
    icon: ShieldCheck,
    titel: 'Ehrlich über Lücken',
    text: 'Was nicht gemessen werden konnte, steht als solches im Bericht. Eine Bewertung auf Basis fehlender Daten wäre wertlos.',
  },
]

export default async function Startseite() {
  const session = await getSession()

  return (
    <div className="aussenauftritt min-h-dvh">
      {/* Kopfzeile */}
      <header className="sticky top-0 z-30 border-b border-[var(--linie)] bg-[oklch(14%_0.016_295_/_0.72)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(64%_0.24_295)] to-[oklch(54%_0.24_310)] text-[13px] font-bold text-white shadow-[0_4px_16px_-2px_oklch(56%_0.244_295_/_0.6)]">
              S
            </div>
            <span className="text-[15px] font-semibold tracking-tight">SEO-Master</span>
          </div>
          <Link
            href={session ? '/dashboard' : '/login'}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--ton)] px-4 text-[13px] font-medium text-white transition-all hover:bg-[oklch(58%_0.24_295)] hover:shadow-[0_6px_20px_-4px_oklch(56%_0.244_295_/_0.7)]"
          >
            {session ? 'Zum Arbeitsbereich' : 'Anmelden'}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main>
        {/* Aufmacher */}
        <section className="relative overflow-hidden">
          <div className="lichtschein" aria-hidden />
          <div className="raster" aria-hidden />

          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 text-center lg:pb-24 lg:pt-28">
            <span className="steigt inline-flex items-center gap-2 rounded-full border border-[var(--linie-hell)] bg-[oklch(100%_0_0_/_0.04)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--schrift-matt)]">
              <Sparkles size={13} className="text-[var(--ton-hell)]" />
              SEO, AEO, GEO, SERP und Wettbewerb in einem Lauf
            </span>

            <h1 className="steigt mx-auto mt-7 max-w-4xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Sichtbarkeit <span className="tonverlauf">messen</span>,
              <br className="hidden sm:block" /> statt sie zu vermuten.
            </h1>

            <p className="steigt mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-[var(--schrift-matt)] sm:text-lg">
              Eine Adresse eingeben — heraus kommt ein Bericht, der sagt, was funktioniert, was nicht
              und was als Nächstes zu tun ist. Für Google genauso wie für die KI-Systeme, über die
              heute immer mehr Menschen suchen.
            </p>

            <div className="steigt mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={session ? '/analyses/new' : '/login'}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--ton)] px-6 text-sm font-medium text-white transition-all hover:bg-[oklch(58%_0.24_295)] hover:shadow-[0_10px_36px_-8px_oklch(56%_0.244_295_/_0.85)]"
              >
                {session ? 'Neue Analyse starten' : 'Anmelden'}
                <ArrowRight size={16} />
              </Link>
              <span className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--linie-hell)] px-5 text-[13px] text-[var(--schrift-matt)]">
                <Lock size={14} />
                Zugang derzeit auf Einladung
              </span>
            </div>

            <div className="steigt mx-auto mt-16 max-w-4xl text-left">
              <Produktvorschau />
            </div>
          </div>
        </section>

        {/* Disziplinen */}
        <section className="schimmer relative border-t border-[var(--linie)] py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ton-hell)]">
                Was gemessen wird
              </span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight lg:text-4xl">
                Sechs Fragen, eine Analyse
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--schrift-matt)]">
                Sichtbarkeit entscheidet sich längst nicht mehr nur bei Google. Jede Disziplin
                bekommt eine eigene Bewertung — und eigene Massnahmen.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DISZIPLINEN.map((d) => (
                <div
                  key={d.kuerzel}
                  className="kante group rounded-2xl p-6 transition-all duration-300 hover:border-[var(--linie-hell)] hover:shadow-[0_16px_44px_-16px_oklch(56%_0.244_295_/_0.55)]"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[oklch(56%_0.244_295_/_0.3)] bg-[oklch(56%_0.244_295_/_0.14)] text-[var(--ton-hell)] transition-colors group-hover:bg-[oklch(56%_0.244_295_/_0.22)]">
                    <d.icon size={18} />
                  </span>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--schrift-leise)]">
                    {d.kuerzel}
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold">{d.frage}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--schrift-matt)]">{d.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ablauf */}
        <section className="relative border-t border-[var(--linie)] py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ton-hell)]">
                Ablauf
              </span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight lg:text-4xl">
                Drei Schritte bis zum Bericht
              </h2>
            </div>

            <ol className="relative mt-12 grid gap-6 sm:grid-cols-3">
              {/* Verbindungslinie zwischen den Schritten */}
              <span
                aria-hidden
                className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-transparent via-[var(--linie-hell)] to-transparent sm:block"
              />
              {SCHRITTE.map((s, i) => (
                <li key={s.titel} className="relative">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[oklch(56%_0.244_295_/_0.35)] bg-[var(--grund)] text-[13px] font-semibold text-[var(--ton-hell)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="mt-4 text-[15px] font-semibold">{s.titel}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--schrift-matt)]">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Haltung */}
        <section className="schimmer relative border-t border-[var(--linie)] py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ton-hell)]">
                Anspruch
              </span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight lg:text-4xl">
                Wofür der Bericht taugt
              </h2>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {HALTUNG.map((h) => (
                <div key={h.titel} className="kante rounded-2xl p-6">
                  <h.icon size={20} className="text-[var(--ton-hell)]" />
                  <p className="mt-4 text-[15px] font-semibold">{h.titel}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--schrift-matt)]">{h.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Abschluss */}
        <section className="relative border-t border-[var(--linie)] py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="relative overflow-hidden rounded-3xl border border-[var(--linie-hell)] px-6 py-14 text-center sm:px-12">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 130% at 50% 0%, oklch(56% 0.244 295 / 0.3), transparent 65%)',
                }}
              />
              <div className="relative">
                <h2 className="text-2xl font-semibold tracking-tight lg:text-3xl">
                  {session ? 'Bereit für den nächsten Lauf' : 'Zugang'}
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--schrift-matt)]">
                  {session
                    ? 'Der Arbeitsbereich enthält alle bisherigen Analysen, Recherchen, Projekte und Berichte.'
                    : 'Diese Instanz wird derzeit intern betrieben. Neue Arbeitsbereiche werden auf Anfrage eingerichtet.'}
                </p>
                <Link
                  href={session ? '/dashboard' : '/login'}
                  className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[var(--ton)] px-6 text-sm font-medium text-white transition-all hover:bg-[oklch(58%_0.24_295)] hover:shadow-[0_10px_36px_-8px_oklch(56%_0.244_295_/_0.85)]"
                >
                  {session ? 'Zum Arbeitsbereich' : 'Anmelden'}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--linie)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(64%_0.24_295)] to-[oklch(54%_0.24_310)] text-[11px] font-bold text-white">
              S
            </div>
            <span className="text-[13px] text-[var(--schrift-leise)]">
              SEO-Master — Sichtbarkeit messen, statt sie zu vermuten
            </span>
          </div>
          <Link href="/login" className="text-[13px] text-[var(--schrift-matt)] transition-colors hover:text-[var(--schrift)]">
            Anmelden
          </Link>
        </div>
      </footer>
    </div>
  )
}
