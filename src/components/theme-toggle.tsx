'use client'

import { useState, useTransition } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { setThemeAction } from '@/lib/theme/actions'
import type { Theme } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'

const OPTIONEN: Array<{ wert: Theme; label: string; icon: typeof Sun }> = [
  { wert: 'light', label: 'Hell', icon: Sun },
  { wert: 'dark', label: 'Dunkel', icon: Moon },
  { wert: 'system', label: 'System', icon: Monitor },
]

/**
 * Umschalter für das Erscheinungsbild.
 *
 * Setzt das Attribut sofort selbst am <html>-Element, damit die Umschaltung
 * ohne Wartezeit sichtbar ist, und schreibt die Wahl parallel ins Cookie,
 * damit sie auch beim nächsten Aufruf gilt.
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [aktiv, setAktiv] = useState<Theme>(initial)
  const [, starteUebergang] = useTransition()

  const waehle = (theme: Theme) => {
    setAktiv(theme)

    const wurzel = document.documentElement
    if (theme === 'system') {
      wurzel.removeAttribute('data-theme')
    } else {
      wurzel.setAttribute('data-theme', theme)
    }

    starteUebergang(() => {
      void setThemeAction(theme)
    })
  }

  return (
    <div
      role="radiogroup"
      aria-label="Erscheinungsbild"
      className="flex gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5"
    >
      {OPTIONEN.map((option) => {
        const gewaehlt = aktiv === option.wert
        return (
          <button
            key={option.wert}
            type="button"
            role="radio"
            aria-checked={gewaehlt}
            title={option.label}
            onClick={() => waehle(option.wert)}
            className={cn(
              'flex h-7 flex-1 items-center justify-center rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              // Im dunklen Erscheinungsbild liegen Fläche und gedämpfte Fläche
              // dicht beieinander; die Markierung braucht deshalb Farbe,
              // nicht nur einen Helligkeitsunterschied.
              gewaehlt
                ? 'bg-brand-subtle text-brand'
                : 'text-ink-subtle hover:bg-surface hover:text-ink-muted',
            )}
          >
            <option.icon size={14} />
            <span className="sr-only">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
