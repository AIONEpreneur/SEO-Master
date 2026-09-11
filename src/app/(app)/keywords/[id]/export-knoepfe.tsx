'use client'

import { useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui'

/**
 * Die Recherche zum Mitnehmen: als beschrifteter Text in die Zwischenablage
 * (für Claude und ChatGPT – echte Zahlen statt Vermutungen, inklusive
 * Zwölfmonatsverlauf) oder als CSV für die Tabellenkalkulation.
 */
export function ExportKnoepfe({ text, csvUrl }: { text: string; csvUrl: string }) {
  const [kopiert, setKopiert] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(text)
          setKopiert(true)
          setTimeout(() => setKopiert(false), 2500)
        }}
      >
        {kopiert ? <Check size={14} /> : <Copy size={14} />}
        {kopiert ? 'Kopiert — in Claude/ChatGPT einfügen' : 'Für KI kopieren'}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => { window.location.href = csvUrl }}>
        <Download size={14} />
        CSV
      </Button>
    </div>
  )
}
