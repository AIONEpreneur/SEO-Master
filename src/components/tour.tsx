'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, X } from 'lucide-react'
import { tourAbgeschlossen } from '@/lib/onboarding/actions'
import { Funke } from '@/components/ui'

/**
 * Die Einstiegstour beim ersten Anmelden.
 *
 * Bewusst kein Overlay, das auf Elemente zeigt: Solche Touren brechen bei
 * jeder Layoutänderung und sind auf schmalen Bildschirmen kaum lesbar.
 * Stattdessen erklären fünf Karten, was wo passiert — mit einem Verweis zur
 * jeweiligen Stelle. Wer sie wegklickt, sieht sie nie wieder; über die
 * Hilfe-Seite lässt sie sich zurückholen.
 */

const SCHRITTE = [
  {
    farbe: 'bg-orange',
    titel: 'Willkommen bei SEO-Master',
    text: 'In zwei Minuten weisst du, wo was passiert. Du kannst jederzeit abbrechen — unter „Erste Schritte“ in der Hilfe findest du alles wieder.',
    ziel: null,
  },
  {
    farbe: 'bg-limette',
    titel: 'Analyse: Wie sichtbar ist eine Seite?',
    text: 'Adresse eingeben, Lauf starten. Heraus kommt ein Bericht mit Noten für SEO, AEO und GEO, den echten Google-Platzierungen und einer Liste, was zuerst zu tun ist.',
    ziel: { href: '/analyses/new', text: 'Neue Analyse' },
  },
  {
    farbe: 'bg-rosa',
    titel: 'Keyword-Recherche: Wonach wird gesucht?',
    text: 'Einen Begriff eingeben und sehen, welche Suchanfragen es dazu gibt — mit Suchvolumen, Klickpreis und Schwierigkeit. Jede Recherche bleibt gespeichert.',
    ziel: { href: '/keywords', text: 'Zur Recherche' },
  },
  {
    farbe: 'bg-blau',
    titel: 'Projekte: Damit Läufe vergleichbar werden',
    text: 'Ordne Analysen einem Projekt zu. Dann zeigt der Verlauf, ob deine Arbeit gewirkt hat — statt einzelner Momentaufnahmen.',
    ziel: { href: '/projects', text: 'Zu den Projekten' },
  },
  {
    farbe: 'bg-creme',
    titel: 'Mitnehmen: SEO4U in Browser und KI',
    text: 'Die Erweiterung hat drei Ebenen: Rankings jeder Website im Browser, deine Prompt-Bibliothek in Claude und ChatGPT — und hier in der App läuft beides zusammen. Eingerichtet ist das in zwei Minuten.',
    ziel: { href: '/settings/extension', text: 'Zur Extension' },
  },
]

export function Tour() {
  const [nummer, setNummer] = useState(0)
  const [offen, setOffen] = useState(true)
  const schritt = SCHRITTE[nummer]
  const letzter = nummer === SCHRITTE.length - 1

  if (!offen) return null

  function schliessen() {
    setOffen(false)
    void tourAbgeschlossen()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinte/50 p-4 sm:items-center">
      <div
        className={`relative w-full max-w-lg rounded-3xl border-2 border-tinte p-7 shadow-[7px_7px_0_#161616] sm:p-9 ${schritt.farbe}`}
      >
        <Funke size={30} className="twinkle absolute -right-3 -top-3" fill="var(--color-creme)" />

        <button
          type="button"
          onClick={schliessen}
          aria-label="Tour schliessen"
          className="lift absolute right-5 top-5 rounded-full border-2 border-tinte bg-creme p-1.5"
        >
          <X size={15} />
        </button>

        <span className="font-display text-[12px] uppercase tracking-[0.1em]">
          Schritt {nummer + 1} von {SCHRITTE.length}
        </span>

        <h2 className="mt-3 text-[22px] leading-tight sm:text-[26px]">{schritt.titel}</h2>
        <p className="mt-3 text-[15px] font-medium leading-relaxed sm:text-[16px]">{schritt.text}</p>

        {schritt.ziel && (
          <Link
            href={schritt.ziel.href}
            onClick={schliessen}
            className="lift mt-5 inline-flex items-center gap-2 rounded-full border-2 border-tinte bg-creme px-5 py-2.5 text-[14px] font-bold"
          >
            {schritt.ziel.text}
            <ArrowRight size={15} />
          </Link>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {SCHRITTE.map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full border-2 border-tinte ${
                  i === nummer ? 'bg-tinte' : 'bg-transparent'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {nummer > 0 && (
              <button
                type="button"
                onClick={() => setNummer((n) => n - 1)}
                className="lift inline-flex items-center gap-1.5 rounded-full border-2 border-tinte bg-creme px-4 py-2.5 text-[14px] font-bold"
              >
                <ArrowLeft size={15} />
                Zurück
              </button>
            )}
            <button
              type="button"
              onClick={() => (letzter ? schliessen() : setNummer((n) => n + 1))}
              className="lift inline-flex items-center gap-1.5 rounded-full border-2 border-tinte bg-tinte px-5 py-2.5 text-[14px] font-bold text-creme"
            >
              {letzter ? 'Los geht’s' : 'Weiter'}
              {!letzter && <ArrowRight size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
