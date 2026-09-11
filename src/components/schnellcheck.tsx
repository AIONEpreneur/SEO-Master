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
    <div className="schatten-hart w-full border-[1.5px] border-ink bg-[var(--flaeche)] p-5 text-left">
      <p className="font-display text-[13px] font-bold">
        Wie sichtbar ist deine Seite? Prüf es jetzt — ohne Konto.
      </p>
      <form onSubmit={pruefe} className="mt-3 flex gap-2">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="deine-website.de"
          aria-label="Web-Adresse für den Schnell-Check"
          className="h-11 min-w-0 flex-1 border-[1.5px] border-ink bg-transparent px-3.5 text-[14px] outline-none placeholder:text-[var(--schrift-leise)] focus:border-brand"
        />
        <button
          type="submit"
          disabled={laeuft}
          className="inline-flex h-11 shrink-0 items-center gap-2 border-[1.5px] border-ink bg-ink px-4 font-display text-[13px] font-bold text-[#E8E0D8] transition-all hover:border-brand hover:bg-brand disabled:opacity-60"
        >
          {laeuft ? <Loader2 size={15} className="animate-spin" /> : <ScanSearch size={15} />}
          {laeuft ? 'Prüft …' : 'Prüfen'}
        </button>
      </form>

      {fehler && <p className="mt-3 text-[13px] font-medium text-bad">{fehler}</p>}

      {ergebnis && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ergebnis.scores).map(([modul, wert]) => (
              <div key={modul} className="border-[1.5px] border-ink px-3 py-2.5 text-center">
                <p className="font-display text-lg font-bold tabular-nums">{wert.toFixed(1).replace('.', ',')}</p>
                <p className="font-display text-[10px] font-bold uppercase tracking-wider text-[var(--schrift-matt)]">
                  {modul}
                </p>
              </div>
            ))}
          </div>
          {ergebnis.befunde.length > 0 && (
            <ul className="space-y-1.5">
              {ergebnis.befunde.map((titel) => (
                <li key={titel} className="flex items-start gap-2 text-[13px] text-[var(--schrift-matt)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-pink" />
                  {titel}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] leading-relaxed text-[var(--schrift-matt)]">{ergebnis.hinweis}</p>
          <a
            href="/register"
            className="inline-flex items-center gap-1.5 border-b-2 border-pink font-display text-[13px] font-bold hover:text-brand"
          >
            Zur vollständigen Analyse
            <ArrowRight size={14} />
          </a>
        </div>
      )}
    </div>
  )
}
