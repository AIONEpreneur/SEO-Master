'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { neuigkeitenGelesen } from '@/lib/neuigkeiten/actions'

/**
 * Den Besuch dieser Seite als "gelesen" vermerken.
 *
 * Bewusst nach dem Rendern und nicht währenddessen: Next verweigert
 * revalidatePath innerhalb eines Renderdurchlaufs — und zwar zu Recht, denn
 * eine Seite, die beim Anzeigen ihren eigenen Zwischenspeicher verwirft,
 * beschreibt einen Kreis. Der erste Versuch tat genau das und warf beim
 * Aufruf der Seite.
 *
 * Das refresh() danach ist kein Beiwerk: Ohne es bliebe die Zahl neben dem
 * Menüpunkt stehen, obwohl gerade alles gelesen wurde.
 */
export function AlsGelesenMerken() {
  const router = useRouter()

  useEffect(() => {
    let abgemeldet = false
    void neuigkeitenGelesen().then(() => {
      if (!abgemeldet) router.refresh()
    })
    return () => {
      abgemeldet = true
    }
  }, [router])

  return null
}
