'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, ArrowRight } from 'lucide-react'
import { neuigkeitenGelesen } from '@/lib/neuigkeiten/actions'
import { ART_LABEL, ART_FARBE, type NeuigkeitAnzeige } from '@/lib/neuigkeiten'
import { Funke } from '@/components/ui'

/**
 * Was seit dem letzten Anmelden dazugekommen ist.
 *
 * Erscheint einmal und ist dann weg — der Merker hängt am Konto, nicht am
 * Browser. Wer ihn schliesst, ohne gelesen zu haben, findet alles unter
 * Neuigkeiten wieder; deshalb steht der Verweis dorthin im Fuss und nicht
 * bloss ein Schliessen-Kreuz.
 *
 * Bewusst kein Überlagern der ganzen Seite mit einer Sperre: Wer sich gerade
 * anmeldet, will meist etwas Bestimmtes tun. Eine Meldung, die man
 * wegklicken muss, bevor überhaupt etwas geht, wird nicht gelesen, sondern
 * weggeklickt.
 */
export function NeuigkeitenAufsteller({ neuigkeiten }: { neuigkeiten: NeuigkeitAnzeige[] }) {
  const [offen, setOffen] = useState(true)
  if (!offen || neuigkeiten.length === 0) return null

  function schliessen() {
    setOffen(false)
    void neuigkeitenGelesen()
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:p-0">
      <div className="relative w-full max-w-md rounded-3xl border-2 border-tinte bg-creme p-6 shadow-[7px_7px_0_#161616]">
        <Funke size={26} className="twinkle absolute -right-3 -top-3" fill="var(--color-lila)" />

        <button
          type="button"
          onClick={schliessen}
          aria-label="Neuigkeiten schliessen"
          className="lift absolute right-4 top-4 rounded-full border-2 border-tinte bg-creme p-1.5"
        >
          <X size={14} />
        </button>

        <p className="font-display text-[12px] uppercase tracking-[0.1em] text-tinte">
          {neuigkeiten.length === 1 ? 'Eine Neuigkeit' : `${neuigkeiten.length} Neuigkeiten`}
        </p>
        <h2 className="mt-1 text-[19px] leading-tight">Seit deinem letzten Besuch</h2>

        <ul className="mt-4 max-h-[46vh] space-y-3 overflow-y-auto pr-1">
          {neuigkeiten.map((n) => (
            <li key={n.id} className="rounded-2xl border-2 border-tinte bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border-2 border-tinte px-2.5 py-0.5 text-[11px] font-bold text-tinte ${ART_FARBE[n.art]}`}
                >
                  {ART_LABEL[n.art]}
                </span>
                <span className="text-[11px] font-medium text-ink-subtle">
                  {n.veroeffentlichtAm.toLocaleDateString('de-DE')}
                </span>
              </div>
              <p className="mt-2 text-[14px] font-bold">{n.titel}</p>
              <p className="mt-1 text-[13px] font-medium leading-relaxed text-ink-muted">{n.text}</p>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={schliessen}
            className="lift rounded-full border-2 border-tinte bg-tinte px-5 py-2.5 text-[14px] font-bold text-creme"
          >
            Verstanden
          </button>
          <Link
            href="/neuigkeiten"
            onClick={schliessen}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-tinte underline"
          >
            Alle Änderungen
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
