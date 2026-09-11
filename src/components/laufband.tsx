/**
 * Das schräge Laufband aus der Vorlage.
 *
 * Dunkles Band, leicht gekippt, mit Sternen zwischen den Wörtern. Die Liste
 * steht zweimal im Markup — nur so läuft die Schleife nahtlos: Der zweite
 * Durchlauf schiebt sich um genau die halbe Breite nach links, in dem
 * Moment, in dem der erste durch ist.
 */
const WOERTER = [
  'SEO',
  'AEO',
  'GEO',
  'Platzierungen',
  'Wettbewerb',
  'Keyword-Recherche',
  'Echte Google-Daten',
  'Browser-Extension',
  'Claude & ChatGPT',
]

function Stern() {
  return (
    <svg width="22" height="22" viewBox="0 0 44 44" aria-hidden className="shrink-0">
      <path d="M22 0 L26 18 L44 22 L26 26 L22 44 L18 26 L0 22 L18 18 Z" fill="#F6A44B" />
    </svg>
  )
}

export function Laufband() {
  return (
    <div className="overflow-hidden py-7">
      <div className="-mx-8 -rotate-[1.5deg] overflow-hidden bg-tinte">
        <div className="marquee-track flex w-max">
          {[0, 1].map((durchlauf) => (
            <div key={durchlauf} className="flex items-center gap-10 py-4 pr-10 sm:gap-14 sm:pr-14">
              {WOERTER.map((wort) => (
                <div key={wort} className="flex items-center gap-10 sm:gap-14">
                  <Stern />
                  <span className="whitespace-nowrap font-display text-[17px] uppercase tracking-[0.04em] text-creme sm:text-[24px]">
                    {wort}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
