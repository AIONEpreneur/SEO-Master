'use client'

import { useState } from 'react'
import { ArrowRight, Loader2, ScanSearch } from 'lucide-react'

type Ergebnis = {
  url: string
  scores: Record<string, number>
  befunde: string[]
  hinweis: string
}

/**
 * Schnell-Check auf der Landingpage.
 *
 * Der erste Haken der Seite: Adresse eingeben, drei echte Werte sehen. Die
 * Messung ist dieselbe wie in der Anwendung – nur auf die Seitenhälfte
 * beschränkt. Was fehlt (Platzierungen, Wettbewerb, Bericht), sagt das
 * Ergebnis offen dazu.
 */
export function SchnellCheck() {
  const [url, setUrl] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)

  async function pruefe(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || laeuft) return
    setLaeuft(true)
    setFehler(null)
    setErgebnis(null)
    try {
      const antwort = await fetch('/api/schnellcheck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const daten = await antwort.json()
      if (!antwort.ok) {
        setFehler(String(daten.error ?? 'Die Prüfung ist fehlgeschlagen.'))
      } else {
        setErgebnis(daten as Ergebnis)
      }
    } catch {
      setFehler('Die Prüfung ist fehlgeschlagen. Bitte später erneut versuchen.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="schatten-gross rounded-3xl border-2 border-tinte bg-creme p-7 text-left sm:p-10">
      <div className="flex flex-col gap-2">
        <span className="self-start rounded-full border-2 border-tinte bg-rosa px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em]">
          Sofort und ohne Konto
        </span>
        <h2 className="mt-2 text-[24px] sm:text-[32px]">Wie sichtbar ist deine Seite?</h2>
        <p className="text-[15px] font-medium sm:text-[17px]">
          Adresse eingeben, drei echte Werte bekommen. Dauert ein paar Sekunden.
        </p>
      </div>

      <form onSubmit={pruefe} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="deine-website.de"
          aria-label="Web-Adresse für den Schnell-Check"
          className="h-14 min-w-0 flex-1 rounded-full border-2 border-tinte bg-sand px-6 text-[16px] font-medium outline-none placeholder:text-ink-subtle focus:border-rot"
        />
        <button
          type="submit"
          disabled={laeuft}
          className="lift inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-tinte bg-tinte px-8 text-[16px] font-bold text-creme disabled:opacity-60"
        >
          {laeuft ? <Loader2 size={17} className="animate-spin" /> : <ScanSearch size={17} />}
          {laeuft ? 'Prüft …' : 'Prüfen'}
        </button>
      </form>

      {fehler && (
        <p className="mt-4 rounded-md border-2 border-tinte bg-rosa px-4 py-2.5 text-[14px] font-bold text-rot">
          {fehler}
        </p>
      )}

      {ergebnis && (
        <div className="mt-6 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(ergebnis.scores).map(([modul, wert], i) => (
              <div
                key={modul}
                className={`rounded-xl border-2 border-tinte px-3 py-4 text-center ${
                  ['bg-orange', 'bg-limette', 'bg-rosa'][i % 3]
                }`}
              >
                <p className="font-display text-[26px] leading-none tabular-nums sm:text-[34px]">
                  {wert.toFixed(1).replace('.', ',')}
                </p>
                <p className="mt-2 font-display text-[11px] uppercase tracking-[0.1em]">{modul}</p>
              </div>
            ))}
          </div>

          {ergebnis.befunde.length > 0 && (
            <ul className="flex flex-col gap-2">
              {ergebnis.befunde.map((titel) => (
                <li key={titel} className="flex items-start gap-3 text-[15px] font-medium">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-tinte bg-orange" />
                  {titel}
                </li>
              ))}
            </ul>
          )}

          <p className="text-[14px] font-medium leading-relaxed text-ink-muted">{ergebnis.hinweis}</p>

          <a
            href="/register"
            className="lift inline-flex self-start items-center gap-2 rounded-full border-2 border-tinte bg-limette px-6 py-3.5 text-[15px] font-bold"
          >
            Zur vollständigen Analyse
            <ArrowRight size={16} />
          </a>
        </div>
      )}
    </div>
  )
}
