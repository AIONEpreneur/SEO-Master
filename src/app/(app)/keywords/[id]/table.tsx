'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ABSICHT_LABEL, type Absicht, type KeywordZeile } from '@/lib/keywords/research'

type Spalte = 'suchvolumen' | 'klickpreis' | 'anzeigenwert' | 'schwierigkeit'

const SPALTEN: Array<{ key: Spalte; label: string; hinweis: string }> = [
  { key: 'suchvolumen', label: 'Suchen/Monat', hinweis: 'Wie oft der Begriff im Monat gesucht wird' },
  { key: 'klickpreis', label: 'Klickpreis', hinweis: 'Was Werbetreibende im Mittel für einen Klick zahlen' },
  { key: 'anzeigenwert', label: 'Werbewert', hinweis: 'Suchen × Klickpreis: wo tatsächlich Geld im Spiel ist' },
  { key: 'schwierigkeit', label: 'Schwierigkeit', hinweis: '0–100. Wie schwer die erste Seite ohne Werbung zu erreichen ist' },
]

const ABSICHT_FILTER: Array<{ key: Absicht | 'alle'; label: string }> = [
  { key: 'alle', label: 'Alle' },
  { key: 'kauf', label: 'Kauf' },
  { key: 'vergleich', label: 'Vergleich' },
  { key: 'information', label: 'Information' },
  { key: 'marke', label: 'Marke' },
]

export function KeywordTabelle({ zeilen }: { zeilen: KeywordZeile[] }) {
  const [sortiert, setSortiert] = useState<Spalte>('suchvolumen')
  const [absteigend, setAbsteigend] = useState(true)
  const [absicht, setAbsicht] = useState<Absicht | 'alle'>('alle')
  const [suche, setSuche] = useState('')

  const sichtbar = useMemo(() => {
    const begriff = suche.trim().toLowerCase()
    return zeilen
      .filter((z) => absicht === 'alle' || z.absicht === absicht)
      .filter((z) => !begriff || z.begriff.includes(begriff))
      .sort((a, b) => {
        // Fehlende Schwierigkeitswerte sollen nie oben stehen: Eine leere
        // Zelle als "leicht" zu lesen wäre die falsche Schlussfolgerung.
        const wa = a[sortiert] ?? (absteigend ? -Infinity : Infinity)
        const wb = b[sortiert] ?? (absteigend ? -Infinity : Infinity)
        return absteigend ? wb - wa : wa - wb
      })
  }, [zeilen, sortiert, absteigend, absicht, suche])

  const wechsle = (spalte: Spalte) => {
    if (spalte === sortiert) setAbsteigend((v) => !v)
    else { setSortiert(spalte); setAbsteigend(true) }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <div className="flex flex-wrap gap-1">
          {ABSICHT_FILTER.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setAbsicht(f.key)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                absicht === f.key ? 'bg-brand-subtle text-brand' : 'text-ink-muted hover:bg-surface-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Begriff eingrenzen…"
          aria-label="Begriffe eingrenzen"
          className="ml-auto w-44 rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[12px] outline-none focus:border-brand"
        />
      </div>

      <div className="scroll-x">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-ink-muted">
              <th className="px-5 py-2.5 font-medium">Begriff</th>
              <th className="px-3 py-2.5 font-medium">Absicht</th>
              {SPALTEN.map((s) => (
                <th key={s.key} className="px-3 py-2.5 font-medium">
                  <button
                    type="button"
                    onClick={() => wechsle(s.key)}
                    title={s.hinweis}
                    className={cn(
                      'flex items-center gap-1 transition-colors hover:text-ink',
                      sortiert === s.key && 'text-brand',
                    )}
                  >
                    {s.label}
                    {sortiert === s.key &&
                      (absteigend ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                  </button>
                </th>
              ))}
              <th className="px-5 py-2.5 font-medium">Verlauf</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sichtbar.map((z) => (
              <tr key={z.begriff} className="transition-colors hover:bg-surface-muted">
                <td className="px-5 py-2.5 font-medium">{z.begriff}</td>
                <td className="px-3 py-2.5">
                  <span className="text-[12px] text-ink-muted">{ABSICHT_LABEL[z.absicht]}</span>
                </td>
                <td className="px-3 py-2.5 tabular-nums">{z.suchvolumen.toLocaleString('de-DE')}</td>
                <td className="px-3 py-2.5 tabular-nums">
                  {z.klickpreis > 0 ? `${z.klickpreis.toFixed(2).replace('.', ',')} €` : '–'}
                </td>
                <td className="px-3 py-2.5 tabular-nums font-medium">
                  {z.anzeigenwert > 0 ? `${z.anzeigenwert.toLocaleString('de-DE')} €` : '–'}
                </td>
                <td className="px-3 py-2.5">
                  {z.schwierigkeit === null ? (
                    <span className="text-ink-subtle">–</span>
                  ) : (
                    <span className={cn('tabular-nums', z.schwierigkeit <= 30 && 'text-good')}>
                      {z.schwierigkeit}
                    </span>
                  )}
                </td>
                <td className="px-5 py-2.5">
                  <Verlauf werte={z.verlauf} trend={z.trendJahr} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sichtbar.length === 0 && (
        <p className="px-5 py-8 text-center text-[13px] text-ink-muted">
          Kein Begriff passt zu dieser Auswahl.
        </p>
      )}

      <p className="border-t border-border px-5 py-3 text-[12px] text-ink-subtle">
        {sichtbar.length} von {zeilen.length} Begriffen
      </p>
    </div>
  )
}

/**
 * Zwölfmonatsverlauf als kleine Linie.
 *
 * Bewusst ohne Achsen und Zahlen: Gefragt ist an dieser Stelle nur, ob die
 * Nachfrage steigt oder fällt. Die genauen Werte stehen in der Tabelle.
 */
function Verlauf({ werte, trend }: { werte: number[]; trend: number | null }) {
  if (werte.length < 2) {
    return <span className="text-[12px] text-ink-subtle">–</span>
  }

  const hoch = Math.max(...werte)
  const tief = Math.min(...werte)
  const spanne = hoch - tief || 1
  const punkte = werte
    .map((w, i) => `${(i / (werte.length - 1)) * 56},${16 - ((w - tief) / spanne) * 14}`)
    .join(' ')

  return (
    <span className="flex items-center gap-2">
      <svg width="56" height="18" viewBox="0 0 56 18" aria-hidden className="shrink-0 overflow-visible">
        <polyline points={punkte} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand" />
      </svg>
      {trend !== null && (
        <span className={cn('text-[12px] tabular-nums', trend > 0 ? 'text-good' : trend < 0 ? 'text-bad' : 'text-ink-subtle')}>
          {trend > 0 ? '+' : ''}{trend} %
        </span>
      )}
    </span>
  )
}
