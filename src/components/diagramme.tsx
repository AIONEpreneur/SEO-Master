import type { Messpunkt, Stufe, Tempowerte } from '@/lib/analysis/uebersicht'
import { stufeVonHundert } from '@/lib/analysis/uebersicht'
import { HelpCircle } from 'lucide-react'

/*
  Diagramme im Stil des Hauses.

  Gezeichnet wird als SVG direkt auf dem Server — keine Diagramm-Bibliothek.
  Zwei Gründe: Die Vorlage lebt von harten Konturen und flächigen Farben,
  und genau das liefert keine Bibliothek von sich aus; und eine Übersicht,
  die bei jedem Anmelden aufgeht, soll dafür kein zusätzliches Javascript
  laden.

  Zur Farbwahl: Die Akzentfarben des Hauses sind Flächenfarben. Als dünne
  Linien auf Creme fallen sie durch jede Kontrastprüfung — ausprobiert, und
  sie sind durchgefallen. Deshalb trägt hier nirgends die Farbe allein eine
  Aussage: Linien und Konturen sind Tinte, Flächen sind die Akzentfarben,
  und wo eine Farbe etwas bedeutet (gut/mittel/schwach), steht das Wort
  daneben. Damit bleibt jedes Bild auch in Graustufen und für farbenblinde
  Augen lesbar.
*/

/**
 * „Was bedeutet das?" — aufklappbar, nicht aufgedrängt.
 *
 * Eine Zahl ohne Einheit ist keine Auskunft. Aber ein Absatz Erklärung unter
 * jeder Zahl macht aus der Übersicht eine Textseite, die niemand liest.
 * Deshalb steht das Nötigste immer da (Skala, ein Satz), und der Rest sitzt
 * hinter einem Klick — als natives <details>, damit es ohne Javascript
 * funktioniert und die Suche im Browser den Text trotzdem findet.
 */
function Erklaerung({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border-2 border-border px-2.5 py-0.5 text-[12px] font-bold text-ink">
        <HelpCircle size={12} />
        Was bedeutet das?
      </summary>
      <p className="mt-2 max-w-prose text-[13px] font-medium leading-relaxed text-ink-muted">
        {children}
      </p>
    </details>
  )
}

/** Flächenfarbe je Stufe. Die Kontur ist immer Tinte, die Schrift ebenso. */
const STUFEN_FLAECHE: Record<Stufe, string> = {
  gut: 'var(--color-limette)',
  mittel: 'var(--color-orange)',
  schwach: 'var(--color-rosa)',
}

// ---------------------------------------------------------------------------
// Tacho
// ---------------------------------------------------------------------------

/** Punkt auf dem Halbkreis; 0 = links, 1 = rechts. */
function aufBogen(anteil: number, radius: number) {
  const winkel = Math.PI * (1 - Math.min(1, Math.max(0, anteil)))
  return { x: 90 + radius * Math.cos(winkel), y: 86 - radius * Math.sin(winkel) }
}

function bogen(anteil: number, radius: number) {
  const start = aufBogen(0, radius)
  const ende = aufBogen(anteil, radius)
  // Der Bogen ist ein Halbkreis: Von links bis irgendwohin sind es nie mehr
  // als 180°. Das grosse-Bogen-Kennzeichen bleibt deshalb immer 0 — steht
  // es auf 1, nimmt der Zeiger den langen Weg aussen herum.
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${ende.x} ${ende.y}`
}

/**
 * Der Tacho für die Gesamtnote.
 *
 * Die eine Zahl, mit der die Übersicht aufmacht — deshalb gross und in der
 * Fliesstextschrift. Der Zeigerstand allein sagt nichts über gut oder
 * schlecht, dafür steht das Wort darunter.
 */
export function Tacho({
  wert,
  von = 10,
  titel,
  hinweis,
}: {
  wert: number | null
  von?: number
  titel: string
  hinweis?: string
}) {
  const anteil = wert === null ? 0 : Math.min(1, Math.max(0, wert / von))
  const stufe = stufeVonHundert(wert === null ? null : (wert / von) * 100)

  return (
    <figure className="m-0 flex flex-col items-center">
      <div className="relative w-full max-w-[220px]">
        <svg viewBox="0 0 180 100" className="w-full" role="img" aria-label={`${titel}: ${wert === null ? 'noch keine Messung' : `${wert} von ${von}`}`}>
          {/* Kontur: derselbe Bogen, etwas dicker, in Tinte — so bekommt das
              Band seine 2 px Rand, ohne dass ein eigener Pfad nötig wäre. */}
          <path d={bogen(1, 66)} fill="none" stroke="var(--color-border)" strokeWidth={26} />
          <path d={bogen(1, 66)} fill="none" stroke="var(--color-surface-muted)" strokeWidth={22} />
          {wert !== null && stufe && (
            <path d={bogen(anteil, 66)} fill="none" stroke={STUFEN_FLAECHE[stufe]} strokeWidth={22} />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-[46px] font-bold leading-none tracking-tight text-ink">
            {wert === null ? '–' : wert.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
          </span>
          <span className="mt-0.5 text-[12px] font-medium text-ink-subtle">von {von}</span>
        </div>
      </div>
      <figcaption className="mt-3 text-center">
        <p className="font-display text-[13px] uppercase leading-tight text-ink">{titel}</p>
        {stufe && (
          <p className="mt-1 text-[13px] font-bold text-ink">
            {stufe === 'gut'
              ? 'Gut aufgestellt'
              : stufe === 'mittel'
                ? 'Ausbaufähig — da geht noch was'
                : 'Hier liegt Arbeit vor dir'}
          </p>
        )}
        {hinweis && <p className="mt-1 text-[12px] font-medium text-ink-subtle">{hinweis}</p>}
      </figcaption>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Tempo (Lighthouse)
// ---------------------------------------------------------------------------

const TEMPO_ZEILEN: Array<{ schluessel: keyof Tempowerte; label: string; was: string }> = [
  { schluessel: 'tempo', label: 'Wie schnell die Seite lädt', was: 'Wie lange jemand wartet, bis er etwas sieht.' },
  {
    schluessel: 'bedienbarkeit',
    label: 'Barrierefreiheit',
    was: 'Ob auch Menschen mit Seh- oder Bedienhilfen zurechtkommen.',
  },
  {
    schluessel: 'standards',
    label: 'Technische Sauberkeit',
    was: 'Ob die Seite handwerklich ordentlich gebaut ist — sichere Verbindung, keine veralteten Bausteine.',
  },
  {
    schluessel: 'seo',
    label: 'Technische Grundlagen',
    was: 'Ob die Grundausstattung stimmt, die Google erwartet: Titel, Beschreibung, lesbare Adressen.',
  },
]

/**
 * Die vier Lighthouse-Werte als Balken.
 *
 * Vier Tachos nebeneinander wären vier Kreise, die man einzeln ablesen
 * müsste; nebeneinanderliegende Balken beantworten die eigentliche Frage —
 * welcher der vier ist der schlechteste — auf einen Blick. Jeder Balken
 * trägt seine Zahl, die Farbe ist Zugabe.
 */
export function TempoBalken({ werte }: { werte: Tempowerte }) {
  return (
    <div className="space-y-3">
      {TEMPO_ZEILEN.map(({ schluessel, label, was }) => {
        const wert = werte[schluessel] as number | null
        const stufe = stufeVonHundert(wert)
        return (
          <div key={schluessel}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-ink">{label}</span>
              <span className="shrink-0 text-[13px] font-bold tabular-nums text-ink">
                {wert === null ? (
                  'nicht gemessen'
                ) : (
                  <>
                    {wert}
                    <span className="font-medium text-ink-subtle"> von 100</span>
                  </>
                )}
                {stufe && (
                  <span className="ml-1.5 font-medium text-ink-subtle">
                    · {stufe === 'gut' ? 'gut' : stufe === 'mittel' ? 'mittel' : 'schwach'}
                  </span>
                )}
              </span>
            </div>
            <p className="text-[12px] font-medium leading-snug text-ink-subtle">{was}</p>
            <div className="mt-1 h-4 w-full overflow-hidden rounded-full border-2 border-border bg-surface-muted">
              {wert !== null && stufe && (
                <div
                  className="h-full rounded-r-full"
                  style={{ width: `${Math.max(2, wert)}%`, background: STUFEN_FLAECHE[stufe] }}
                />
              )}
            </div>
          </div>
        )
      })}

      {(werte.lcpSekunden !== null || werte.cls !== null) && (
        <p className="pt-1 text-[12px] font-medium leading-relaxed text-ink-subtle">
          {werte.lcpSekunden !== null && (
            <>
              Bis das Wichtigste auf dem Bildschirm steht, dauert es{' '}
              <strong className="text-ink">
                {werte.lcpSekunden.toLocaleString('de-DE', { minimumFractionDigits: 1 })} Sekunden
              </strong>
              .{' '}
            </>
          )}
          {werte.cls !== null && (
            <>
              {werte.cls <= 0.1
                ? 'Beim Laden verrutscht nichts Störendes.'
                : 'Beim Laden verrutscht die Seite spürbar — wer schon klicken will, trifft daneben.'}
            </>
          )}
        </p>
      )}

      <Erklaerung>
        Diese vier Werte misst Google selbst, mit seinem Werkzeug „Lighthouse". Sie laufen von 0 bis
        100 — <strong className="text-ink">das ist Googles Skala, nicht unsere Note von 10</strong>.
        Ab 90 gilt ein Wert als gut, ab 50 als mittel, darunter als schwach. Genau dieselben Zahlen
        siehst du, wenn du deine Adresse bei „PageSpeed Insights" eingibst. Sie sagen etwas über die
        Technik deiner Seite — nicht darüber, ob sie bei Google weit oben steht.
      </Erklaerung>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kleine Verlaufslinien je Bereich
// ---------------------------------------------------------------------------

/*
  Die vier Bereiche in Worten.

  „SEO, AEO, GEO, SERP" sind vier Kürzel, von denen eine Selbstständige mit
  eigener Website höchstens das erste kennt. Vier Kacheln mit vier Kürzeln
  und je einer Kommazahl sind keine Auskunft, sondern ein Rätsel.

  Also steht die Frage vorn, die der Bereich beantwortet, und das Kürzel
  klein darunter — nicht weggelassen, denn im Bericht und in der Hilfe steht
  es weiter so, und wer die beiden nebeneinanderlegt, muss sie zuordnen
  können. Die Formulierungen sind wörtlich die der Hilfe-Seite.
*/
const BEREICHE: Array<{
  schluessel: 'seo' | 'aeo' | 'geo' | 'serp'
  label: string
  kuerzel: string
  was: string
}> = [
  {
    schluessel: 'seo',
    label: 'Bei Google gefunden werden',
    kuerzel: 'SEO',
    was: 'Findet Google deine Seite, und versteht Google, worum es darin geht?',
  },
  {
    schluessel: 'aeo',
    label: 'In der Antwortbox landen',
    kuerzel: 'AEO',
    was: 'Kommt deine Seite in den Kasten mit der direkten Antwort ganz oben?',
  },
  {
    schluessel: 'geo',
    label: 'Von KI zitiert werden',
    kuerzel: 'GEO',
    was: 'Können ChatGPT und Perplexity deine Seite lesen und dich als Quelle nennen?',
  },
  {
    schluessel: 'serp',
    label: 'Deine echten Plätze',
    kuerzel: 'SERP',
    was: 'Auf welchen Plätzen steht deine Seite gerade wirklich bei Google?',
  },
]

/**
 * Vier kleine Linien statt einer bunten.
 *
 * Vier Reihen in ein Diagramm zu legen hiesse, vier Farben zu vergeben, die
 * sich auf Creme kaum unterscheiden lassen — und an den Stellen, wo die
 * Linien sich kreuzen, ist ohnehin nichts mehr abzulesen. Vier eigene
 * Bilder nebeneinander beantworten dieselbe Frage ohne eine einzige Farbe.
 */
export function BereichsLinien({ punkte }: { punkte: Messpunkt[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {BEREICHE.map(({ schluessel, label, kuerzel, was }) => {
        const reihe = punkte.map((p) => p[schluessel])
        const vorhanden = reihe.filter((w): w is number => w !== null)
        const erste = vorhanden[0] ?? null
        const letzte = vorhanden[vorhanden.length - 1] ?? null
        const delta =
          erste === null || letzte === null ? null : Math.round((letzte - erste) * 10) / 10

        return (
          <figure key={schluessel} className="m-0 rounded-2xl border-2 border-border bg-surface-muted p-4">
            <figcaption>
              <div className="flex items-start justify-between gap-2">
                {/*
                  Bewusst nicht die Anzeigeschrift in Versalien wie sonst bei
                  Überschriften: Das hier ist eine Frage über zwei bis drei
                  Zeilen, und Archivo Black in Versalien wird über drei Zeilen
                  zur Mauer. Eine Überschrift, die man buchstabieren muss, ist
                  keine.
                */}
                <span className="text-[13px] font-bold leading-snug text-ink">{label}</span>
                <span className="shrink-0 text-[15px] font-bold leading-none text-ink">
                  {letzte === null ? (
                    '–'
                  ) : (
                    <>
                      {letzte.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
                      <span className="text-[11px] font-medium text-ink-subtle"> /10</span>
                    </>
                  )}
                </span>
              </div>
              <p className="mt-1 text-[12px] font-medium leading-snug text-ink-subtle">{was}</p>
            </figcaption>
            <MiniLinie werte={reihe} />
            <p className="mt-1.5 text-[12px] font-medium text-ink-subtle">
              {/*
                „Keine Vergleichswerte" sagt nicht, warum. Bei diesen vier
                Bereichen gibt es fast immer denselben Grund: Der Baustein
                war beim Start nicht angekreuzt oder brauchte Daten, die
                nicht vorlagen. Das gehört hier hin, sonst sucht jemand den
                Fehler bei sich.
              */}
              {delta === null
                ? letzte === null
                  ? 'Dieser Baustein lief bei deinen Analysen nicht mit.'
                  : 'Erst ab der zweiten Messung vergleichbar.'
                : delta === 0
                  ? 'unverändert seit der ersten Messung'
                  : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('de-DE', { maximumFractionDigits: 1 })} seit der ersten Messung`}
            </p>
            <p className="sr-only">Kürzel im Bericht: {kuerzel}</p>
            <span className="mt-2 inline-block rounded-full border-2 border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
              {kuerzel}
            </span>
          </figure>
        )
      })}
    </div>
  )
}

/** Eine Linie ohne Achsen — die Zahl daneben trägt den Wert, die Linie die Richtung. */
function MiniLinie({ werte }: { werte: Array<number | null> }) {
  const punkte = werte
    .map((w, i) => ({ w, i }))
    .filter((p): p is { w: number; i: number } => p.w !== null)

  if (punkte.length < 2) {
    return <div className="mt-2 h-10 rounded-lg border-2 border-dashed border-border/40" aria-hidden />
  }

  const breite = 160
  const hoehe = 40
  const x = (i: number) => (werte.length === 1 ? breite / 2 : (i / (werte.length - 1)) * breite)
  // Feste Skala 0–10: Eine Linie, die sich ihre eigene Skala sucht, macht aus
  // einer Bewegung von 0,2 einen Berg.
  const y = (w: number) => hoehe - (Math.min(10, Math.max(0, w)) / 10) * hoehe

  const d = punkte.map((p, n) => `${n === 0 ? 'M' : 'L'} ${x(p.i)} ${y(p.w)}`).join(' ')
  const letzter = punkte[punkte.length - 1]

  return (
    <svg
      viewBox={`-3 -4 ${breite + 12} ${hoehe + 8}`}
      className="mt-2 w-full"
      aria-hidden
    >
      <path d={d} fill="none" stroke="var(--color-ink)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(letzter.i)} cy={y(letzter.w)} r={4} fill="var(--color-lila)" stroke="var(--color-border)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
