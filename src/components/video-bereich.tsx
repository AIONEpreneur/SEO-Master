'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import { Funke } from '@/components/ui'

/**
 * Das Video auf der Startseite.
 *
 * Hier wird nur eine Zeile geändert, wenn das Video fertig ist: VIDEO auf
 * die Adresse setzen. Alles andere bleibt.
 *
 * Die Einbettung lädt erst auf Klick. Das ist kein Zierrat, sondern
 * notwendig: Ein YouTube-Rahmen setzt Cookies und meldet die Adresse jeder
 * Besucherin nach Kalifornien, bevor irgendjemand auf "Abspielen" gedrückt
 * hat. Bis zum Klick steht hier nur ein Bild aus dem eigenen Haus.
 */

type Video =
  | { art: 'platzhalter' }
  /** youtube-nocookie spielt ohne Werbe-Cookies aus. */
  | { art: 'youtube'; id: string }
  | { art: 'vimeo'; id: string }
  /** Eigene Datei unter public/, etwa '/video/rundgang.mp4'. */
  | { art: 'datei'; pfad: string }

// ▼ HIER eintragen, sobald das Video steht. Beispiele:
//   { art: 'youtube', id: 'dQw4w9WgXcQ' }
//   { art: 'datei', pfad: '/video/rundgang.mp4' }
const VIDEO: Video = { art: 'platzhalter' }

const TITEL = 'In zwei Minuten: So funktioniert SEO-Master'
const UNTERTITEL =
  'Adresse eingeben, messen lassen, Bericht lesen — einmal von vorn bis hinten gezeigt.'

export function VideoBereich() {
  const [laeuft, setLaeuft] = useState(false)

  return (
    <section className="px-5 pb-20 sm:px-10 lg:px-16 lg:pb-24">
      <div className="relative overflow-hidden rounded-3xl border-2 border-tinte bg-sand p-7 shadow-[7px_7px_0_#161616] sm:p-10">
        <Funke size={34} className="twinkle absolute right-8 top-8" fill="var(--color-rosa)" />

        <div className="flex max-w-[640px] flex-col gap-3">
          <span className="self-start rounded-full border-2 border-tinte bg-limette px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em]">
            Rundgang
          </span>
          <h2 className="text-[26px] sm:text-[34px]">{TITEL}</h2>
          <p className="text-[15px] font-medium sm:text-[17px]">{UNTERTITEL}</p>
        </div>

        <div className="mt-7 overflow-hidden rounded-2xl border-2 border-tinte bg-tinte">
          <div className="relative aspect-video w-full">
            {VIDEO.art === 'platzhalter' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-lila text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-tinte bg-creme">
                  <Play size={30} className="ml-1" fill="#161616" />
                </span>
                <p className="px-6 font-display text-[17px] uppercase">Video folgt in Kürze</p>
                <p className="max-w-sm px-6 text-[14px] font-medium">
                  Hier läuft bald der Rundgang durch die App. Bis dahin: Probier den Schnell-Check
                  oben aus — der zeigt dir sofort echte Werte.
                </p>
              </div>
            )}

            {VIDEO.art === 'datei' && (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- Untertitel
              // folgen mit dem fertigen Video als eigene Spur.
              <video controls preload="none" className="h-full w-full" src={VIDEO.pfad} />
            )}

            {(VIDEO.art === 'youtube' || VIDEO.art === 'vimeo') &&
              (laeuft ? (
                <iframe
                  className="h-full w-full"
                  src={
                    VIDEO.art === 'youtube'
                      ? `https://www.youtube-nocookie.com/embed/${VIDEO.id}?autoplay=1&rel=0`
                      : `https://player.vimeo.com/video/${VIDEO.id}?autoplay=1&dnt=1`
                  }
                  title={TITEL}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setLaeuft(true)}
                  className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-lila text-center"
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-tinte bg-creme transition-transform group-hover:-translate-y-1">
                    <Play size={30} className="ml-1" fill="#161616" />
                  </span>
                  <span className="font-display text-[17px] uppercase">Video abspielen</span>
                  <span className="max-w-sm px-6 text-[13px] font-medium">
                    Beim Klick wird das Video von {VIDEO.art === 'youtube' ? 'YouTube' : 'Vimeo'}{' '}
                    geladen. Vorher werden keine Daten dorthin übertragen.
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </section>
  )
}
