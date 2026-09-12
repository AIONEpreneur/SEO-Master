'use client'

import { useMemo, useRef, useState } from 'react'

export type Kurvenpunkt = { datum: string; wert: number | null }

/*
  Die Gesamtnote über die Zeit.

  Eine einzige Reihe, bewusst. Die Frage, für die jemand jeden Monat
  wiederkommt, lautet "wirkt, was ich tue?" — und die beantwortet eine
  Linie. Die vier Bereiche stehen als eigene kleine Bilder daneben; sie in
  dieselbe Fläche zu legen hiesse, vier Farben zu vergeben, die sich auf
  Creme kaum unterscheiden.

  Weil es nur eine Reihe gibt, braucht es keine Legende: Die Überschrift
  benennt sie. Die Zahlen sind zusätzlich als Tabelle aufklappbar — wer die
  Linie nicht ablesen kann oder will, kommt trotzdem an jeden Wert.
*/

const BREITE = 720
const HOEHE = 220
const RAND = { oben: 16, rechts: 16, unten: 30, links: 30 }

export function Verlaufskurve({ punkte, adresse }: { punkte: Kurvenpunkt[]; adresse: string }) {
  const [aktiv, setAktiv] = useState<number | null>(null)
  const [tabelle, setTabelle] = useState(false)
  const flaeche = useRef<SVGSVGElement>(null)

  const messbar = useMemo(
    () => punkte.map((p, i) => ({ ...p, i })).filter((p): p is Kurvenpunkt & { wert: number; i: number } => p.wert !== null),
    [punkte],
  )

  const innenBreite = BREITE - RAND.links - RAND.rechts
  const innenHoehe = HOEHE - RAND.oben - RAND.unten

  const x = (i: number) =>
    RAND.links + (punkte.length <= 1 ? innenBreite / 2 : (i / (punkte.length - 1)) * innenBreite)
  // Feste Skala 0–10. Eine Achse, die sich an die Daten schmiegt, macht aus
  // einer Verbesserung um 0,3 einen Gipfel — und beim nächsten Lauf sieht
  // dieselbe Seite plötzlich anders aus, ohne dass sich etwas geändert hat.
  const y = (wert: number) => RAND.oben + innenHoehe - (Math.min(10, Math.max(0, wert)) / 10) * innenHoehe

  const linie = messbar.map((p, n) => `${n === 0 ? 'M' : 'L'} ${x(p.i)} ${y(p.wert)}`).join(' ')
  const flaechePfad =
    messbar.length >= 2
      ? `${linie} L ${x(messbar[messbar.length - 1].i)} ${RAND.oben + innenHoehe} L ${x(messbar[0].i)} ${RAND.oben + innenHoehe} Z`
      : ''

  function beiZeiger(event: React.PointerEvent<SVGSVGElement>) {
    const svg = flaeche.current
    if (!svg || messbar.length === 0) return
    const kasten = svg.getBoundingClientRect()
    // Von Bildschirm- auf Diagrammkoordinaten: Das SVG skaliert mit der
    // Kartenbreite, die Mausposition tut das nicht.
    const relativ = ((event.clientX - kasten.left) / kasten.width) * BREITE
    let naechster = messbar[0]
    for (const p of messbar) {
      if (Math.abs(x(p.i) - relativ) < Math.abs(x(naechster.i) - relativ)) naechster = p
    }
    setAktiv(naechster.i)
  }

  const gezeigt = aktiv === null ? null : punkte[aktiv]

  return (
    <div>
      <div className="relative">
        <svg
          ref={flaeche}
          viewBox={`0 0 ${BREITE} ${HOEHE}`}
          className="w-full touch-none"
          role="img"
          aria-label={`Verlauf der Gesamtnote für ${adresse}, ${messbar.length} Messungen`}
          onPointerMove={beiZeiger}
          onPointerLeave={() => setAktiv(null)}
        >
          {/* Hilfslinien: durchgezogen und eine Spur neben der Fläche, damit
              sie im Hintergrund bleiben. Gestrichelt läse sich wie eine
              Prognose. */}
          {[0, 2.5, 5, 7.5, 10].map((wert) => (
            <g key={wert}>
              <line
                x1={RAND.links}
                x2={BREITE - RAND.rechts}
                y1={y(wert)}
                y2={y(wert)}
                stroke="var(--color-ink)"
                strokeOpacity={0.14}
                strokeWidth={1}
              />
              <text
                x={RAND.links - 8}
                y={y(wert) + 4}
                textAnchor="end"
                className="fill-[var(--color-ink-subtle)] text-[11px] tabular-nums"
              >
                {wert}
              </text>
            </g>
          ))}

          {flaechePfad && <path d={flaechePfad} fill="var(--color-lila)" fillOpacity={0.35} />}
          {linie && (
            <path
              d={linie}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {messbar.map((p) => (
            <circle
              key={p.i}
              cx={x(p.i)}
              cy={y(p.wert)}
              r={aktiv === p.i ? 7 : 5}
              fill="var(--color-lila)"
              stroke="var(--color-border)"
              strokeWidth={2}
            />
          ))}

          {aktiv !== null && punkte[aktiv]?.wert !== null && (
            <line
              x1={x(aktiv)}
              x2={x(aktiv)}
              y1={RAND.oben}
              y2={RAND.oben + innenHoehe}
              stroke="var(--color-ink)"
              strokeOpacity={0.35}
              strokeWidth={1.5}
            />
          )}

          {/* Nur erstes und letztes Datum an der Achse. Bei zwölf Messungen
              stünden sonst zwölf Datumsangaben übereinander. */}
          <text x={RAND.links} y={HOEHE - 8} className="fill-[var(--color-ink-subtle)] text-[11px]">
            {punkte[0]?.datum}
          </text>
          <text
            x={BREITE - RAND.rechts}
            y={HOEHE - 8}
            textAnchor="end"
            className="fill-[var(--color-ink-subtle)] text-[11px]"
          >
            {punkte[punkte.length - 1]?.datum}
          </text>
        </svg>

        {gezeigt && gezeigt.wert !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-xl border-2 border-tinte bg-creme px-3 py-1.5 shadow-[3px_3px_0_#161616]"
            style={{
              left: `${(x(aktiv!) / BREITE) * 100}%`,
              transform: `translateX(${x(aktiv!) > BREITE / 2 ? '-100%' : '0'})`,
            }}
          >
            <p className="text-[12px] font-medium text-tinte">{gezeigt.datum}</p>
            <p className="text-[15px] font-bold text-tinte">
              {gezeigt.wert.toLocaleString('de-DE', { maximumFractionDigits: 1 })}{' '}
              <span className="text-[12px] font-medium">von 10</span>
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setTabelle((v) => !v)}
        className="mt-2 rounded-full border-2 border-border px-3 py-1 text-[12px] font-bold text-ink"
        aria-expanded={tabelle}
      >
        {tabelle ? 'Zahlen ausblenden' : 'Zahlen anzeigen'}
      </button>

      {tabelle && (
        <table className="mt-3 w-full text-left text-[13px]">
          <caption className="sr-only">Gesamtnote je Messung für {adresse}</caption>
          <thead>
            <tr className="border-b-2 border-border">
              <th scope="col" className="py-1.5 font-medium">Gemessen am</th>
              <th scope="col" className="py-1.5 text-right font-medium">Gesamtnote</th>
            </tr>
          </thead>
          <tbody>
            {[...punkte].reverse().map((p, i) => (
              <tr key={`${p.datum}-${i}`} className="border-b border-border/30">
                <td className="py-1.5">{p.datum}</td>
                <td className="py-1.5 text-right font-bold tabular-nums">
                  {p.wert === null
                    ? 'nicht bewertbar'
                    : p.wert.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
