import Link from 'next/link'
import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { isRegistrationOpen } from '@/lib/auth/actions'
import { SchnellCheck } from '@/components/schnellcheck'
import { VideoBereich } from '@/components/video-bereich'
import { HeroVisual } from '@/components/hero-visual'
import { Laufband } from '@/components/laufband'
import { Funke } from '@/components/ui'
import { TARIFE } from '@/lib/billing/tarife'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'SEO-Master — Sichtbarkeit messen, statt sie zu vermuten',
  description:
    'Analysiert Websites auf SEO, AEO, GEO, Platzierungen und Wettbewerb — mit echten Daten. Kostenlos umschauen, Abo erst zum Mitnehmen.',
}

/**
 * Die öffentliche Seite.
 *
 * Aufbau, Farben und Bewegung folgen der Design-Vorlage: lila Grundfläche,
 * Karten in Orange, Limette und Rosa mit 2-px-Kontur und hartem Schatten,
 * Archivo Black in Versalien für die Schlagzeilen, Pillen als Knöpfe,
 * Sterne als Deko.
 */

/** Die sechs Fragen, jede auf einer eigenen Karte. */
const DISZIPLINEN = [
  {
    kuerzel: 'SEO',
    frage: 'Rankt die Seite bei Google?',
    text: 'Technik, Inhalt, Keywords, Verweise — geprüft an der echten Seite.',
    farbe: 'bg-orange',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" stroke="#161616" strokeWidth="2.4" />
        <path d="M19 19 L26 26" stroke="#161616" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    kuerzel: 'AEO',
    frage: 'Steht sie in der Antwortbox?',
    text: 'Frage-Antwort-Struktur und FAQ-Auszeichnung — das, was Google direkt vorliest.',
    farbe: 'bg-limette',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <rect x="2" y="4" width="24" height="17" rx="2.5" fill="none" stroke="#161616" strokeWidth="2.4" />
        <path d="M2 10 H26" stroke="#161616" strokeWidth="2.4" />
        <path d="M10 25 H18" stroke="#161616" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    kuerzel: 'GEO',
    frage: 'Kennen ChatGPT & Co. sie?',
    text: 'Zitierbarkeit und Zugang für KI-Crawler — die Suche von morgen.',
    farbe: 'bg-rosa',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <path d="M16 2 L6 16 H13 L11 26 L22 11 H15 Z" fill="none" stroke="#161616" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    kuerzel: 'SERP',
    frage: 'Wo steht sie wirklich?',
    text: 'Echte Platzierungen aus Google Deutschland statt Schätzungen.',
    farbe: 'bg-blau',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <path d="M4 24 V14 M12 24 V6 M20 24 V11 M26 24 H2" fill="none" stroke="#161616" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    kuerzel: 'Wettbewerb',
    frage: 'Wie gross ist der Abstand?',
    text: 'Wer dieselben Ergebnisse besetzt — und mit welchen Themen.',
    farbe: 'bg-creme',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <path d="M5 3 L23 23 M23 3 L5 23" stroke="#161616" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="6" cy="24" r="2.5" fill="none" stroke="#161616" strokeWidth="2.4" />
        <circle cx="22" cy="24" r="2.5" fill="none" stroke="#161616" strokeWidth="2.4" />
      </svg>
    ),
  },
  {
    kuerzel: 'Keywords',
    frage: 'Wo wird Geld ausgegeben?',
    text: 'Suchvolumen, Klickpreise und Kaufabsicht — je Begriff, mit Verlauf.',
    farbe: 'bg-sand',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <path d="M3 20 L10 12 L15 17 L25 6" fill="none" stroke="#161616" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 6 H25 V13" fill="none" stroke="#161616" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const SCHRITTE = [
  {
    nr: '01',
    titel: 'Kostenlos anmelden',
    text: 'Eigener Arbeitsbereich, ohne Zahldaten. Startguthaben für die ersten echten Läufe ist dabei.',
  },
  {
    nr: '02',
    titel: 'Messen und lesen',
    text: 'Recherchen starten, Rankings prüfen, Berichte lesen — alles sichtbar, nichts hinter einer Schranke.',
  },
  {
    nr: '03',
    titel: 'Abo zum Mitnehmen',
    text: 'Exporte, Extension und die KI-Anbindung gibt es im Abo — erst dann, wenn du sie wirklich brauchst.',
  },
]

export default async function Startseite() {
  const session = await getSession()
  const registrierungOffen = await isRegistrationOpen()
  const startHref = session ? '/dashboard' : registrierungOffen ? '/register' : '/login'
  const startLabel = session ? 'Zum Arbeitsbereich' : registrierungOffen ? 'Kostenlos starten' : 'Anmelden'

  return (
    <div className="aussenauftritt min-h-dvh overflow-x-hidden">
      {/* ================= KOPF ================= */}
      <header className="flex items-center justify-between px-5 pt-6 sm:px-10 lg:px-16 lg:pt-7">
        <Link
          href="/"
          className="rounded-full border-2 border-tinte bg-creme px-5 py-2.5 text-[15px] font-bold shadow-[3px_3px_0_#161616] sm:px-6 sm:text-[18px]"
        >
          seo-master
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden rounded-full border-2 border-tinte bg-orange px-5 py-2.5 text-[15px] font-bold lg:block">
            Kostenlos umschauen
          </span>
          {!session && registrierungOffen && (
            <Link href="/login" className="hidden text-[15px] font-bold sm:block">
              Anmelden
            </Link>
          )}
          <Link
            href={startHref}
            className="lift rounded-full border-2 border-tinte bg-tinte px-5 py-3 text-[14px] font-bold text-creme shadow-[3px_3px_0_rgba(22,22,22,0.35)] sm:px-7 sm:text-[15px]"
          >
            {startLabel}
          </Link>
        </div>
      </header>

      {/* ================= AUFMACHER ================= */}
      <section className="flex flex-col gap-12 px-5 pb-16 pt-12 sm:px-10 lg:flex-row lg:items-center lg:gap-16 lg:px-16 lg:pb-24 lg:pt-16">
        <div className="flex flex-1 flex-col gap-7 lg:flex-[1.2]">
          <span className="rise rise-1 self-start rounded-full border-2 border-tinte bg-creme px-5 py-2.5 text-[14px] font-bold sm:text-[15px]">
            Für Solopreneure — kein SEO-Studium nötig
          </span>

          {/* Der Stern gehört ans letzte Wort — sonst rutscht er beim
              Umbruch allein in die nächste Zeile. */}
          <h1 className="rise rise-2 text-[38px] leading-[1.06] sm:text-[54px] lg:text-[66px]">
            Sichtbarkeit messen, statt sie zu{' '}
            <span className="whitespace-nowrap">
              vermuten<span className="spin text-orange">*</span>
            </span>
          </h1>

          <p className="rise rise-3 max-w-[620px] text-[17px] font-medium leading-relaxed sm:text-[21px]">
            Eine Adresse eingeben. Heraus kommt, was zu tun ist — für Google und für die
            KI-Systeme. Mit echten Zahlen, nicht mit Bauchgefühl.
          </p>

          <div className="rise rise-4 flex flex-wrap gap-3">
            <span className="rounded-full border-2 border-tinte bg-creme px-5 py-3 text-[14px] font-bold sm:text-[16px]">
              SEO · AEO · GEO · SERP
            </span>
            <span className="rounded-full border-2 border-tinte bg-limette px-5 py-3 text-[14px] font-bold sm:text-[16px]">
              echte Google-Daten
            </span>
          </div>

          <div className="rise rise-5 flex flex-wrap items-center gap-5">
            <Link
              href={startHref}
              className="lift rounded-full border-2 border-tinte bg-tinte px-9 py-5 text-[17px] font-bold text-creme shadow-[5px_5px_0_rgba(22,22,22,0.35)] sm:text-[20px]"
            >
              {startLabel}
            </Link>
            <p className="max-w-[210px] text-[14px] font-medium leading-snug sm:text-[15px]">
              Kostenlos umschauen. Abo erst, wenn du etwas mitnehmen willst.
            </p>
          </div>
        </div>

        <div className="flex-1">
          <HeroVisual />
        </div>
      </section>

      {/* ================= SCHNELL-CHECK ================= */}
      <section className="px-5 pb-16 sm:px-10 lg:px-16 lg:pb-20">
        <SchnellCheck />
      </section>

      {/* ================= VIDEO ================= */}
      <VideoBereich />

      {/* ================= WAS GEMESSEN WIRD ================= */}
      <section className="flex flex-col gap-9 px-5 pb-20 sm:px-10 lg:px-16 lg:pb-24">
        <div className="flex max-w-[760px] flex-col gap-4">
          <h2 className="text-[30px] sm:text-[40px] lg:text-[46px]">Sechs Fragen, eine Analyse</h2>
          <p className="text-[16px] font-medium leading-relaxed sm:text-[19px]">
            Keine Ampel-Bildchen. Jede Frage wird an deiner echten Seite gemessen — und jede
            Antwort sagt dir, was daraus folgt.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DISZIPLINEN.map((d) => (
            <div
              key={d.kuerzel}
              className={`karte-hover schatten flex flex-col gap-4 rounded-2xl border-2 border-tinte p-7 ${d.farbe}`}
            >
              <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-tinte bg-creme">
                {d.icon}
              </span>
              <span className="font-display text-[12px] uppercase tracking-[0.1em]">{d.kuerzel}</span>
              <p className="text-[20px] font-bold leading-snug sm:text-[23px]">{d.frage}</p>
              <p className="text-[15px] font-medium leading-relaxed sm:text-[16px]">{d.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= SO LÄUFT ES ================= */}
      <section className="flex flex-col gap-9 px-5 pb-20 sm:px-10 lg:px-16 lg:pb-24">
        <h2 className="text-[30px] sm:text-[40px] lg:text-[46px]">Erst schauen, dann mitnehmen</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {SCHRITTE.map((s) => (
            <div
              key={s.nr}
              className="karte-hover schatten flex flex-col gap-4 rounded-2xl border-2 border-tinte bg-creme p-7"
            >
              <span className="font-display text-[38px] leading-none text-orange">{s.nr}</span>
              <p className="text-[20px] font-bold">{s.titel}</p>
              <p className="text-[15px] font-medium leading-relaxed sm:text-[16px]">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= PREISE ================= */}
      <section id="preise" className="flex flex-col gap-9 px-5 pb-20 sm:px-10 lg:px-16 lg:pb-24">
        <div className="flex flex-wrap items-center gap-5">
          <h2 className="text-[30px] sm:text-[40px] lg:text-[46px]">Fair bleibt fair</h2>
          <span className="rounded-full border-2 border-dashed border-tinte bg-creme px-5 py-2.5 text-[13px] font-bold">
            Preise noch vorläufig
          </span>
        </div>

        <div className="grid gap-7 lg:grid-cols-3">
          {TARIFE.map((tarif) => (
            <div
              key={tarif.kennung}
              className={`relative flex flex-col rounded-2xl border-2 border-tinte p-8 ${
                tarif.farbe === 'orange' ? 'bg-orange' : tarif.farbe === 'limette' ? 'bg-limette' : 'bg-creme'
              } ${tarif.hervorgehoben ? 'shadow-[7px_7px_0_#C93B2B]' : 'schatten'}`}
            >
              {tarif.hervorgehoben && (
                <span className="absolute -top-4 left-7 rounded-full border-2 border-tinte bg-creme px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em]">
                  Beliebt
                </span>
              )}

              <p className="font-display text-[20px] uppercase">{tarif.name}</p>
              <p className="mt-4 font-display text-[42px] leading-none">
                {tarif.preis}
                <span className="ml-2 font-sans text-[14px] font-medium normal-case">{tarif.preisHinweis}</span>
              </p>
              <p className="mt-4 text-[15px] font-medium leading-relaxed">{tarif.beschreibung}</p>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {tarif.leistungen.map((l) => (
                  <li key={l} className="flex items-start gap-2.5 text-[15px] font-medium">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-tinte bg-creme">
                      <Check size={11} strokeWidth={3.5} />
                    </span>
                    {l}
                  </li>
                ))}
              </ul>

              {/* Gebucht wird im Konto, nicht hier: Für ein Abo braucht es
                  einen Arbeitsbereich. Deshalb führt jeder Knopf zuerst zur
                  Anmeldung — auch der für die bezahlten Tarife. */}
              <Link
                href={registrierungOffen ? '/register' : '/login'}
                className="lift mt-7 rounded-full border-2 border-tinte bg-tinte px-6 py-4 text-center text-[16px] font-bold text-creme"
              >
                {tarif.kennung === 'FREE' ? 'Kostenlos starten' : `Mit ${tarif.name} starten`}
              </Link>
              {tarif.kennung !== 'FREE' && (
                <p className="mt-3 text-[13px] font-medium">
                  Erst kostenlos anlegen, dann im Konto buchen — jederzeit kündbar.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ================= MITTEL-AUFRUF ================= */}
      <section className="px-5 sm:px-10 lg:px-16">
        <div className="flex flex-col items-center gap-6 rounded-2xl bg-tinte px-7 py-10 text-center text-creme sm:px-14 lg:flex-row lg:justify-between lg:gap-10 lg:text-left">
          <p className="font-display text-[24px] uppercase leading-tight sm:text-[30px]">
            Klingt nach dir? Dann miss nach.
          </p>
          <Link
            href={startHref}
            className="lift shrink-0 rounded-full border-2 border-limette bg-limette px-9 py-5 text-[17px] font-bold text-tinte"
          >
            {startLabel}
          </Link>
        </div>
      </section>

      {/* ================= LAUFBAND ================= */}
      <div className="mt-16 lg:mt-20">
        <Laufband />
      </div>

      {/* ================= WERKZEUGE ================= */}
      <section className="flex flex-col gap-9 px-5 py-16 sm:px-10 lg:px-16 lg:py-20">
        <div className="flex max-w-[760px] flex-col gap-4">
          <h2 className="text-[30px] sm:text-[40px] lg:text-[46px]">Deine Daten arbeiten, wo du arbeitest</h2>
          <p className="text-[16px] font-medium leading-relaxed sm:text-[19px]">
            Die Zahlen bleiben nicht in der App liegen — sie kommen dorthin, wo du sie brauchst.
          </p>
        </div>

        <div className="grid gap-7 sm:grid-cols-2">
          <div className="karte-hover schatten flex flex-col gap-4 rounded-2xl border-2 border-tinte bg-sand p-8">
            <span className="self-start rounded-full border-2 border-tinte bg-rosa px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em]">
              Im Browser
            </span>
            <p className="text-[22px] font-bold">SEO4U-Extension für Chrome</p>
            <p className="text-[15px] font-medium leading-relaxed sm:text-[16px]">
              Auf jeder Website ein Klick: Wofür rankt diese Seite wirklich? Dazu Keyword-Recherche
              direkt im Browser — und alles landet automatisch in deinem Arbeitsbereich.
            </p>
          </div>

          <div className="karte-hover schatten flex flex-col gap-4 rounded-2xl border-2 border-tinte bg-sand p-8">
            <span className="self-start rounded-full border-2 border-tinte bg-limette px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em]">
              In der KI
            </span>
            <p className="text-[22px] font-bold">Claude &amp; ChatGPT angebunden</p>
            <p className="text-[15px] font-medium leading-relaxed sm:text-[16px]">
              Deine KI holt sich die echten Zahlen selbst — Recherchen, Rankings, Verläufe. Mit
              Anmeldung und ausdrücklicher Zustimmung, jederzeit widerrufbar.
            </p>
          </div>
        </div>
      </section>

      {/* ================= ABSCHLUSS ================= */}
      <section className="px-5 pb-16 sm:px-10 lg:px-16 lg:pb-20">
        <div className="relative flex flex-col items-center gap-7 overflow-hidden rounded-3xl border-2 border-tinte bg-limette px-7 py-16 text-center shadow-[7px_7px_0_#161616] sm:px-16">
          <Funke size={38} className="twinkle absolute left-8 top-8" fill="#FFFDF8" />
          <Funke size={30} className="twinkle twinkle-2 absolute bottom-10 right-10" fill="#F6A44B" />

          <h2 className="max-w-[800px] text-[28px] leading-tight sm:text-[40px] lg:text-[48px]">
            {session ? 'Bereit für den nächsten Lauf' : 'Schau dir deine Sichtbarkeit an'}
          </h2>
          <span className="rounded-full border-2 border-tinte bg-creme px-6 py-3 text-[15px] font-bold">
            {session ? 'Alles an einem Ort' : 'kostenlos · ohne Zahldaten · in zwei Minuten'}
          </span>
          <Link
            href={startHref}
            className="lift rounded-full border-2 border-tinte bg-tinte px-12 py-5 text-[18px] font-bold text-creme shadow-[5px_5px_0_rgba(22,22,22,0.3)] sm:text-[21px]"
          >
            {startLabel}
          </Link>
          <p className="text-[15px] font-medium">
            {session
              ? 'Alle Analysen, Recherchen und Berichte warten auf dich.'
              : 'Du bekommst sofort einen eigenen Arbeitsbereich.'}
          </p>
        </div>
      </section>

      {/* ================= FUSS ================= */}
      <footer className="flex flex-wrap items-center justify-center gap-6 px-5 pb-12 pt-4 text-[14px] font-medium sm:px-10 lg:px-16">
        <span>© {new Date().getFullYear()} SEO-Master</span>
        <Link href="/impressum" className="hover:text-rot">Impressum</Link>
        <Link href="/datenschutz" className="hover:text-rot">Datenschutz</Link>
        <Link href="/login" className="hover:text-rot">Anmelden</Link>
      </footer>
    </div>
  )
}
