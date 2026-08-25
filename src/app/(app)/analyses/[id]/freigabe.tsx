'use client'

import { useState } from 'react'
import { Copy, Check, Link2, Link2Off } from 'lucide-react'
import { widerrufeFreigabeAction, erstelleFreigabeAction } from '@/lib/analysis/freigabe-actions'
import { Button } from '@/components/ui'

/**
 * Freigabe-Verwaltung unter dem Bericht.
 *
 * Der Link ersetzt das Hin- und Herschicken von Dateien: Die Kundin gibt
 * ihn weiter, die Empfängerin liest im Browser – ohne Konto, ohne Anhang.
 */
export function Freigabe({
  reportId,
  analysisId,
  link,
  nurAnsicht,
}: {
  reportId: string
  analysisId: string
  /** Vollständige Adresse oder null, wenn keine Freigabe besteht. */
  link: string | null
  nurAnsicht: boolean
}) {
  const [kopiert, setKopiert] = useState(false)

  if (nurAnsicht) return null

  if (!link) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
        <p className="min-w-0 flex-1 text-[13px] text-ink-muted">
          Kein Freigabe-Link aktiv. Neu ausgestellte Links gelten, bis sie widerrufen werden.
        </p>
        <form action={erstelleFreigabeAction}>
          <input type="hidden" name="reportId" value={reportId} />
          <input type="hidden" name="analysisId" value={analysisId} />
          <Button type="submit" variant="secondary" size="sm">
            <Link2 size={14} />
            Freigabe-Link erstellen
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="border-t border-border px-5 py-4">
      <p className="text-[13px] font-medium">Freigabe-Link</p>
      <p className="mt-1 text-[12px] text-ink-muted">
        Wer diesen Link hat, kann den Bericht lesen — ohne Konto. Zum Zurückziehen widerrufen; alle
        verschickten Links sind dann sofort ungültig.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-surface-muted px-2.5 py-2 text-[12px]">{link}</code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(link)
            setKopiert(true)
            setTimeout(() => setKopiert(false), 2000)
          }}
        >
          {kopiert ? <Check size={14} /> : <Copy size={14} />}
          {kopiert ? 'Kopiert' : 'Kopieren'}
        </Button>
        <form action={widerrufeFreigabeAction}>
          <input type="hidden" name="reportId" value={reportId} />
          <input type="hidden" name="analysisId" value={analysisId} />
          <Button type="submit" variant="ghost" size="sm">
            <Link2Off size={14} />
            Widerrufen
          </Button>
        </form>
      </div>
    </div>
  )
}
