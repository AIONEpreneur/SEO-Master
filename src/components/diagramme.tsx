import type { Messpunkt, Stufe, Tempowerte } from '@/lib/analysis/uebersicht'
import { stufeVonHundert } from '@/lib/analysis/uebersicht'

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
            {stufe === 'gut' ? 'Gut aufgestellt' : stufe === 'mittel' ? 'Ausbaufähig' : 'Hier liegt Arbeit'}
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

const TEMPO_ZEILEN: Array<{ schluessel: keyof Tempowerte; label: string }> = [
  { schluessel: 'tempo', label: 'Ladegeschwindigkeit' },
  { schluessel: 'bedienbarkeit', label: 'Bedienbarkeit' },
  { schluessel: 'standards', label: 'Technische Standards' },
  { schluessel: 'seo', label: 'Auffindbarkeit' },
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
      {TEMPO_ZEILEN.map(({ schluessel, label }) => {
        const wert = werte[schluessel] as number | null
        const stufe = stufeVonHundert(wert)
        return (
          <div key={schluessel}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-ink">{label}</span>
              <span className="text-[13px] font-bold tabular-nums text-ink">
                {wert === null ? 'nicht gemessen' : wert}
                {stufe && (
                  <span className="ml-1.5 font-medium text-ink-subtle">
                    · {stufe === 'gut' ? 'gut' : stufe === 'mittel' ? 'mittel' : 'schwach'}
                  </span>
                )}
              </span>
            </div>
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
              Der grösste Inhalt steht nach{' '}
              <strong className="text-ink">
                {werte.lcpSekunden.toLocaleString('de-DE', { minimumFractionDigits: 1 })} s
              </strong>
              .{' '}
            </>
          )}
          {werte.cls !== null && (
            <>
              Das Layout springt beim Laden um{' '}
              <strong className="text-ink">
                {werte.cls.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
              </strong>
              {werte.cls <= 0.1 ? ' — unauffällig.' : ' — spürbar.'}
            </>
          )}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kleine Verlaufslinien je Bereich
// ---------------------------------------------------------------------------

const BEREICHE: Array<{ schluessel: 'seo' | 'aeo' | 'geo' | 'serp'; label: string }> = [
  { schluessel: 'seo', label: 'SEO' },
  { schluessel: 'aeo', label: 'AEO' },
  { schluessel: 'geo', label: 'GEO' },
  { schluessel: 'serp', label: 'SERP' },
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
      {BEREICHE.map(({ schluessel, label }) => {
        const reihe = punkte.map((p) => p[schluessel])
        const vorhanden = reihe.filter((w): w is number => w !== null)
        const erste = vorhanden[0] ?? null
        const letzte = vorhanden[vorhanden.length - 1] ?? null
        const delta =
          erste === null || letzte === null ? null : Math.round((letzte - erste) * 10) / 10

        return (
          <figure key={schluessel} className="m-0 rounded-2xl border-2 border-border bg-surface-muted p-4">
            <figcaption className="flex items-baseline justify-between gap-2">
              <span className="font-display text-[12px] uppercase text-ink">{label}</span>
              <span className="text-[13px] font-bold tabular-nums text-ink">
                {letzte === null ? '–' : letzte.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
              </span>
            </figcaption>
            <MiniLinie werte={reihe} />
            <p className="mt-1.5 text-[12px] font-medium text-ink-subtle">
              {delta === null
                ? 'keine Vergleichswerte'
                : delta === 0
                  ? 'unverändert'
                  : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('de-DE', { maximumFractionDigits: 1 })} seit der ersten Messung`}
            </p>
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
