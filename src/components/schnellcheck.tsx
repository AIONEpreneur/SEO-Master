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
    <div className="kante mx-auto w-full max-w-xl rounded-2xl bg-[var(--flaeche)] p-5 text-left">
      <p className="text-[13px] font-semibold">Wie sichtbar ist deine Seite? Prüf es jetzt — ohne Konto.</p>
      <form onSubmit={pruefe} className="mt-3 flex gap-2">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="deine-website.de"
          aria-label="Web-Adresse für den Schnell-Check"
          className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--linie-hell)] bg-transparent px-3.5 text-[14px] outline-none placeholder:text-[var(--schrift-matt)] focus:border-[var(--akzent)]"
        />
        <button
          type="submit"
          disabled={laeuft}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[var(--akzent)] px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {laeuft ? <Loader2 size={15} className="animate-spin" /> : <ScanSearch size={15} />}
          {laeuft ? 'Prüft …' : 'Prüfen'}
        </button>
      </form>

      {fehler && <p className="mt-3 text-[13px] text-[var(--warnung,#f87171)]">{fehler}</p>}

      {ergebnis && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ergebnis.scores).map(([modul, wert]) => (
              <div key={modul} className="rounded-xl border border-[var(--linie-hell)] px-3 py-2.5 text-center">
                <p className="text-lg font-bold tabular-nums">{wert.toFixed(1).replace('.', ',')}</p>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--schrift-matt)]">
                  {modul}
                </p>
              </div>
            ))}
          </div>
          {ergebnis.befunde.length > 0 && (
            <ul className="space-y-1.5">
              {ergebnis.befunde.map((titel) => (
                <li key={titel} className="flex items-start gap-2 text-[13px] text-[var(--schrift-matt)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--akzent)]" />
                  {titel}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] leading-relaxed text-[var(--schrift-matt)]">{ergebnis.hinweis}</p>
          <a
            href="/login"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--akzent)] hover:underline"
          >
            Zur vollständigen Analyse
            <ArrowRight size={14} />
          </a>
        </div>
      )}
    </div>
  )
}
