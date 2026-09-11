import { ScanSearch, PenLine, Eye, Euro } from 'lucide-react'

/**
 * Die Wirkungskette: Analyse → Content → Sichtbarkeit → Umsatz.
 *
 * Der Grund, warum jemand das Werkzeug überhaupt benutzt, steht sonst
 * nirgends – die Disziplinen erklären, was gemessen wird, nicht wozu. Als
 * Absatz gelesen hätte diese Kette drei Sätze gebraucht; als Bild sind es
 * vier Wörter und ein Verlauf.
 *
 * Die steigende Linie liegt hinter den Stationen und verbindet sie sichtbar.
 */
/* Treppenversatz der Karten, von unten nach oben. Greift erst ab der
   dreispaltigen Anordnung – darunter stehen die Karten untereinander. */
const VERSATZ = ['2.25rem', '1.5rem', '0.75rem', '0']

const STATIONEN = [
  { icon: ScanSearch, titel: 'Analyse', text: 'Was fehlt, schwarz auf weiss' },
  { icon: PenLine, titel: 'Content', text: 'Die Lücken gezielt füllen' },
  { icon: Eye, titel: 'Sichtbarkeit', text: 'Gefunden werden, auch von KI' },
  { icon: Euro, titel: 'Umsatz', text: 'Aus Anfragen werden Kundinnen' },
]

export function Wirkungskette() {
  return (
    <div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATIONEN.map((s, i) => (
          <li
            key={s.titel}
            className="kante rounded-2xl p-5 max-lg:!mt-0"
            /* Jede Station sitzt etwas höher als die vorige. Die Steigung ist
               damit schon in der Anordnung angelegt und nicht nur in der
               Kurve darunter – auf schmalen Bildschirmen, wo die Karten
               untereinander stehen, entfällt der Versatz. */
            style={{ marginTop: VERSATZ[i] }}
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[oklch(56%_0.244_295_/_0.3)] bg-[oklch(56%_0.244_295_/_0.14)] text-[var(--ton-hell)]">
                <s.icon size={17} />
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-[var(--schrift-leise)]">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <p className="mt-3.5 text-[17px] font-semibold tracking-tight">{s.titel}</p>
            <p className="mt-1 text-[13px] text-[var(--schrift-matt)]">{s.text}</p>
          </li>
        ))}
      </ol>

      {/*
        Die steigende Kurve unter den Stationen.

        Sie liegt bewusst unter und nicht hinter den Karten: Dahinter wäre sie
        über weite Strecken verdeckt und die Steigung – die eigentliche
        Aussage – nicht mehr ablesbar. Die vier Punkte sitzen auf den
        Kartenmitten (12,5 %, 37,5 %, 62,5 %, 87,5 % der Breite).
      */}
      <div className="mt-6 hidden lg:block">
        {/* Gleichmässige Skalierung: Mit preserveAspectRatio="none" würde die
            Kurve zwar exakt die Kartenbreite füllen, die Punkte darauf wären
            aber zu Ellipsen verzerrt. */}
        <svg viewBox="0 0 1000 120" aria-hidden className="w-full">
          <defs>
            <linearGradient id="kette-linie" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(62% 0.235 295)" stopOpacity="0.35" />
              <stop offset="55%" stopColor="oklch(68% 0.22 300)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="oklch(78% 0.16 295)" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="kette-flaeche" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(62% 0.235 295)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="oklch(62% 0.235 295)" stopOpacity="0" />
            </linearGradient>

            {/* Blende zum Auslaufen. Ohne sie endet die Fläche mit einer
                senkrechten Kante, die wie ein Balken wirkt und die Kurve
                abrupt abschneidet. */}
            <linearGradient id="kette-auslauf" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="80%" stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id="kette-blende">
              <rect x="0" y="0" width="1000" height="120" fill="url(#kette-auslauf)" />
            </mask>
          </defs>

          <g mask="url(#kette-blende)">
            <path
              d="M125,100 C240,98 280,86 375,74 C480,60 530,46 625,34 C730,20 820,10 1000,4 L1000,120 L125,120 Z"
              fill="url(#kette-flaeche)"
            />
            <path
              d="M125,100 C240,98 280,86 375,74 C480,60 530,46 625,34 C730,20 820,10 1000,4"
              fill="none"
              stroke="url(#kette-linie)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>

          {[
            { x: 125, y: 100 },
            { x: 375, y: 74 },
            { x: 625, y: 34 },
            { x: 875, y: 8 },
          ].map((punkt) => (
            <circle
              key={punkt.x}
              cx={punkt.x}
              cy={punkt.y}
              r="7"
              fill="oklch(14% 0.016 295)"
              stroke="oklch(74% 0.19 295)"
              strokeWidth="3"
            />
          ))}
        </svg>
      </div>
    </div>
  )
}
