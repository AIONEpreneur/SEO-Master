import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Search, Bot, Sparkles, Globe, Swords, ArrowRight,
  ShieldCheck, FileText, Gauge, TrendingUp, Check, Puzzle,
} from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { isRegistrationOpen } from '@/lib/auth/actions'
import { SchnellCheck } from '@/components/schnellcheck'
import { TARIFE } from '@/lib/billing/tarife'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'SEO-Master — Sichtbarkeit messen, statt sie zu vermuten',
  description:
    'Analysiert Websites auf SEO, AEO, GEO, Platzierungen und Wettbewerb — mit echten Daten. Kostenlos umschauen, Abo erst zum Mitnehmen.',
}

const DISZIPLINEN = [
  { kuerzel: 'SEO', icon: Search, frage: 'Rankt die Seite bei Google?', text: 'Technik, Inhalt, Keywords, Verweise.' },
  { kuerzel: 'AEO', icon: Bot, frage: 'Steht sie in der Antwortbox?', text: 'Frage-Antwort-Struktur und FAQ-Auszeichnung.' },
  { kuerzel: 'GEO', icon: Sparkles, frage: 'Kennen ChatGPT & Co. sie?', text: 'Zitierbarkeit und Zugang für KI-Crawler.' },
  { kuerzel: 'SERP', icon: Globe, frage: 'Wo steht sie wirklich?', text: 'Echte Platzierungen statt Schätzungen.' },
  { kuerzel: 'Wettbewerb', icon: Swords, frage: 'Wie gross ist der Abstand?', text: 'Wer dieselben Ergebnisse besetzt — und womit.' },
  { kuerzel: 'Keywords', icon: TrendingUp, frage: 'Wo wird Geld ausgegeben?', text: 'Suchvolumen, Klickpreise, Kaufabsicht.' },
]

const HALTUNG = [
  { icon: Gauge, titel: 'Vergleichbar', text: 'Feste Kriterien. Zwei Läufe, dieselbe Note.' },
  { icon: FileText, titel: 'Konkret', text: 'Fertige Vorschlagstexte statt Hinweise.' },
  { icon: ShieldCheck, titel: 'Ehrlich', text: 'Was fehlt, steht als Lücke im Bericht.' },
]

const LAUFBAND = [
  'Echte Google-Daten', 'SEO', 'AEO', 'GEO', 'Platzierungen', 'Wettbewerb',
  'Keyword-Recherche', 'Browser-Extension', 'Claude & ChatGPT per MCP', 'Berichte zum Mitnehmen',
]

export default async function Startseite() {
  const session = await getSession()
  const registrierungOffen = await isRegistrationOpen()
  const startHref = session ? '/dashboard' : registrierungOffen ? '/register' : '/login'
  const startLabel = session ? 'Zum Arbeitsbereich' : registrierungOffen ? 'Kostenlos starten' : 'Anmelden'

  return (
    <div className="aussenauftritt min-h-dvh">
      {/* Kopfzeile */}
      <header className="sticky top-0 z-30 border-b-[1.5px] border-ink bg-[#E8E0D8]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <span className="font-display text-[1.05rem] font-bold tracking-tight">SEO—Master</span>
          <div className="flex items-center gap-3">
            {/* Nur wenn der Hauptknopf etwas anderes sagt – sonst stünde
                zweimal "Anmelden" nebeneinander. */}
            {!session && registrierungOffen && (
              <Link href="/login" className="hidden font-display text-[13px] font-bold hover:text-brand sm:block">
                Anmelden
              </Link>
            )}
            <Link
              href={startHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 font-display text-[12px] font-bold text-[#E8E0D8] transition-all hover:bg-brand hover:-translate-y-px"
            >
              {startLabel}
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Aufmacher */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="blob koralle -top-40 left-[8%] h-[26rem] w-[26rem]" />
          <div aria-hidden className="blob rosa -top-24 right-[4%] h-[22rem] w-[22rem]" />

          <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-16 lg:pb-20 lg:pt-24">
            <span className="kicker steigt">SEO · AEO · GEO · SERP · Wettbewerb — in einem Lauf</span>

            <h1 className="steigt max-w-3xl text-balance font-display text-[clamp(2rem,6vw,3.3rem)] font-bold leading-[1.08] tracking-tight">
              Sichtbarkeit <span className="mark">messen</span>,<br />
              statt sie zu <span className="mark mark-pink">vermuten</span>.
            </h1>

            <p className="steigt mt-5 max-w-xl text-pretty text-base leading-relaxed text-[var(--schrift-matt)] sm:text-lg">
              Eine Adresse eingeben. Heraus kommt, was zu tun ist — für Google und für
              die KI-Systeme. Mit echten Zahlen, nicht mit Bauchgefühl.
            </p>

            <div className="steigt mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={startHref}
                className="inline-flex items-center gap-2 border-[1.5px] border-ink bg-ink px-7 py-4 font-display text-base font-bold text-[#E8E0D8] transition-all hover:border-brand hover:bg-brand hover:-translate-y-px"
              >
                {startLabel}
                <ArrowRight size={16} />
              </Link>
              <p className="text-[14px] text-[var(--schrift-matt)]">
                Kostenlos umschauen.<br />Abo erst, wenn du etwas mitnehmen willst.
              </p>
            </div>

            <div className="steigt mt-12 max-w-xl">
              <SchnellCheck />
            </div>
          </div>
        </section>

        {/* Laufband */}
        <div className="ticker" aria-hidden>
          <div className="ticker-track">
            {[0, 1].map((durchlauf) => (
              <span key={durchlauf}>
                {LAUFBAND.map((wort) => (
                  <span key={`${durchlauf}-${wort}`}>
                    {wort} <span className="dot">◆</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* Disziplinen */}
        <section className="border-t-[1.5px] border-ink py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <span className="kicker">Was gemessen wird</span>
            <h2 className="mt-3 font-display text-[clamp(1.4rem,3.4vw,2rem)] font-bold tracking-tight">
              Sechs Fragen, <span className="mark">eine Analyse</span>
            </h2>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {DISZIPLINEN.map((d, i) => (
                <div
                  key={d.kuerzel}
                  className={
                    i === 2
                      ? 'schatten-hart border-[1.5px] border-ink bg-gradient-to-br from-coral via-pink to-[#C45080] p-6 text-white'
                      : i === 5
                        ? 'schatten-hart border-[1.5px] border-ink bg-ink p-6 text-[#E8E0D8]'
                        : 'schatten-hart border-[1.5px] border-ink bg-[var(--flaeche)] p-6'
                  }
                >
                  <d.icon size={20} className={i === 5 ? 'text-coral' : i === 2 ? 'text-white' : 'text-brand'} />
                  <p className={`mt-3 font-display text-[0.7rem] font-bold uppercase tracking-[0.14em] ${i === 2 ? 'text-white/80' : i === 5 ? 'text-coral' : 'text-[var(--schrift-leise)]'}`}>
                    {d.kuerzel}
                  </p>
                  <p className="mt-1.5 font-display text-[0.98rem] font-bold">{d.frage}</p>
                  <p className={`mt-1.5 text-[0.95rem] ${i === 2 ? 'text-white/90' : i === 5 ? 'text-[#C9C2B7]' : 'text-[var(--schrift-matt)]'}`}>
                    {d.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* So läuft es */}
        <section className="border-t-[1.5px] border-ink py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <span className="kicker">So läuft es</span>
            <h2 className="mt-3 font-display text-[clamp(1.4rem,3.4vw,2rem)] font-bold tracking-tight">
              Erst schauen, dann <span className="mark">mitnehmen</span>
            </h2>

            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {[
                { nr: '01', titel: 'Kostenlos anmelden', text: 'Eigener Arbeitsbereich, ohne Zahldaten. Startguthaben für die ersten echten Läufe inklusive.' },
                { nr: '02', titel: 'Messen und lesen', text: 'Recherchen starten, Rankings prüfen, Berichte in der App lesen — alles sichtbar, nichts versteckt.' },
                { nr: '03', titel: 'Abo zum Mitnehmen', text: 'Exporte, Extension und die KI-Anbindung gibt es im Abo — erst dann, wenn du sie brauchst.' },
              ].map((s) => (
                <div key={s.nr} className="schatten-hart border-[1.5px] border-ink bg-[var(--flaeche)] p-6">
                  <span className="font-display text-[2rem] font-bold leading-none text-coral">{s.nr}</span>
                  <p className="mt-3 font-display text-[0.98rem] font-bold">{s.titel}</p>
                  <p className="mt-1.5 text-[0.95rem] text-[var(--schrift-matt)]">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preise */}
        <section id="preise" className="border-t-[1.5px] border-ink py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <span className="kicker">Preise</span>
            <h2 className="mt-3 font-display text-[clamp(1.4rem,3.4vw,2rem)] font-bold tracking-tight">
              Fair bleibt <span className="mark mark-pink">fair</span>
            </h2>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {TARIFE.map((tarif) => (
                <div
                  key={tarif.kennung}
                  className={
                    tarif.hervorgehoben
                      ? 'schatten-pink relative border-[1.5px] border-ink bg-[var(--flaeche)] p-7'
                      : 'schatten-hart border-[1.5px] border-ink bg-[var(--flaeche)] p-7'
                  }
                >
                  {tarif.hervorgehoben && <span className="chip hot absolute -top-3.5 left-6">Beliebt</span>}
                  <p className="font-display text-[0.98rem] font-bold">{tarif.name}</p>
                  <p className="mt-3 font-display text-[2.4rem] font-bold leading-none">
                    {tarif.preis}
                    <small className="ml-2 text-[0.85rem] font-normal text-[var(--schrift-matt)]">{tarif.preisHinweis}</small>
                  </p>
                  <p className="mt-3 text-[0.95rem] text-[var(--schrift-matt)]">{tarif.beschreibung}</p>
                  <ul className="mt-5 space-y-2">
                    {tarif.leistungen.map((l) => (
                      <li key={l} className="flex items-start gap-2 text-[0.93rem]">
                        <Check size={15} className="mt-0.5 shrink-0 text-brand" />
                        {l}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={tarif.kaufUrl || (registrierungOffen ? '/register' : '/login')}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 border-[1.5px] px-5 py-3.5 font-display text-[0.95rem] font-bold transition-all hover:-translate-y-px ${
                      tarif.hervorgehoben
                        ? 'border-ink bg-ink text-[#E8E0D8] hover:border-brand hover:bg-brand'
                        : 'border-ink bg-transparent hover:bg-surface-muted'
                    }`}
                  >
                    {tarif.kennung === 'FREE' ? 'Kostenlos starten' : tarif.kaufUrl ? `${tarif.name} holen` : 'Kostenlos beginnen'}
                    <ArrowRight size={15} />
                  </Link>
                  {tarif.kennung !== 'FREE' && !tarif.kaufUrl && (
                    <p className="mt-2 text-[0.8rem] text-[var(--schrift-leise)]">
                      Der Kauf-Weg wird gerade angeschlossen — starte kostenlos, das Upgrade folgt.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Werkzeuge drumherum */}
        <section className="border-t-[1.5px] border-ink bg-ink py-14 text-[#E8E0D8] lg:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <span className="kicker kicker-hell">Mehr als eine Website-App</span>
            <h2 className="mt-3 font-display text-[clamp(1.4rem,3.4vw,2rem)] font-bold tracking-tight text-[#E8E0D8]">
              Deine Daten arbeiten, wo du arbeitest
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <div>
                <Puzzle size={20} className="text-coral" />
                <p className="mt-3 font-display text-[0.98rem] font-bold">SEO4U-Extension für Chrome</p>
                <p className="mt-1.5 text-[0.95rem] text-[#C9C2B7]">
                  Auf jeder Website ein Klick: Wofür rankt diese Seite wirklich? Plus Keyword-Recherche
                  direkt im Browser — alles landet in deinem Arbeitsbereich.
                </p>
              </div>
              <div>
                <Bot size={20} className="text-coral" />
                <p className="mt-3 font-display text-[0.98rem] font-bold">Claude &amp; ChatGPT angebunden</p>
                <p className="mt-1.5 text-[0.95rem] text-[#C9C2B7]">
                  Per MCP holt sich deine KI die echten Zahlen selbst — Recherchen, Rankings, Verläufe.
                  Mit Anmeldung und Zustimmung, versteht sich.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Haltung */}
        <section className="border-t-[1.5px] border-ink py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <span className="kicker">Anspruch</span>
            <h2 className="mt-3 font-display text-[clamp(1.4rem,3.4vw,2rem)] font-bold tracking-tight">
              Wofür der Bericht <span className="mark">taugt</span>
            </h2>

            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {HALTUNG.map((h) => (
                <div key={h.titel} className="flex items-start gap-4 border-l-[5px] border-ink pl-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-display text-[0.98rem] font-bold">
                      <h.icon size={17} className="text-brand" />
                      {h.titel}
                    </p>
                    <p className="mt-1 text-[0.95rem] text-[var(--schrift-matt)]">{h.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-4 border-[1.5px] border-ink bg-[var(--flaeche)] p-7 schatten-hart">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[1.1rem] font-bold">
                  {session ? 'Bereit für den nächsten Lauf?' : 'Schau es dir einfach an.'}
                </p>
                <p className="mt-1 text-[0.95rem] text-[var(--schrift-matt)]">
                  {session
                    ? 'Alle Analysen, Recherchen und Berichte an einem Ort.'
                    : 'Kostenlos, ohne Zahldaten — und mit echten Zahlen ab der ersten Minute.'}
                </p>
              </div>
              <Link
                href={startHref}
                className="inline-flex items-center gap-2 border-[1.5px] border-ink bg-ink px-6 py-3.5 font-display text-[0.95rem] font-bold text-[#E8E0D8] transition-all hover:border-brand hover:bg-brand hover:-translate-y-px"
              >
                {startLabel}
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-[1.5px] border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <span className="font-display text-[13px] font-bold">
            SEO—Master <span className="font-normal text-[var(--schrift-leise)]">· Sichtbarkeit messen, statt sie zu vermuten</span>
          </span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/impressum" className="text-[13px] text-[var(--schrift-matt)] hover:text-brand">
              Impressum
            </Link>
            <Link href="/datenschutz" className="text-[13px] text-[var(--schrift-matt)] hover:text-brand">
              Datenschutz
            </Link>
            <Link href="/login" className="text-[13px] text-[var(--schrift-matt)] hover:text-brand">
              Anmelden
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
