'use client'

import { useEffect, useState } from 'react'
import { begruessung } from '@/lib/begruessung'

/**
 * Die Anrede — tageszeitabhängig, aber erst nach dem ersten Rendern.
 *
 * Die Tageszeit kennt nur der Browser. Der Server steht womöglich in einer
 * anderen Zeitzone; "Guten Morgen" um 23 Uhr wäre eine kleine, unnötige
 * Fremdheit.
 *
 * Deshalb zwei Schritte: Zuerst dieselbe Anrede, die auch der Server
 * ausliefert (sonst meldet React eine Abweichung zwischen Server- und
 * Browser-Fassung), nach dem Einhängen dann die mit Tageszeit. Der Wechsel
 * fällt nicht auf, weil der Name an derselben Stelle stehen bleibt.
 */
export function Begruessung({ name }: { name: string | null }) {
  const [stunde, setStunde] = useState<number | undefined>(undefined)

  useEffect(() => {
    setStunde(new Date().getHours())
  }, [])

  return <>{begruessung(name, stunde)}</>
}
