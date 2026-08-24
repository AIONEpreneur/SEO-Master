'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui'

/**
 * Fortschrittsanzeige eines laufenden Auftrags.
 *
 * Fragt den Status im Sekundentakt ab und lädt die Seite einmal neu, sobald
 * der Lauf abgeschlossen ist – dann liegt das vollständige Ergebnis vor.
 */
export function ProgressWatcher({
  analysisId,
  initialProgress,
  initialStep,
}: {
  analysisId: string
  initialProgress: number
  initialStep: string | null
}) {
  const router = useRouter()
  const [progress, setProgress] = useState(initialProgress)
  const [step, setStep] = useState(initialStep ?? 'Wird vorbereitet')

  useEffect(() => {
    let active = true

    const poll = async () => {
      try {
        const response = await fetch(`/api/analyses/${analysisId}/status`, { cache: 'no-store' })
        if (!response.ok || !active) return
        const data = await response.json()

        setProgress(data.progress ?? 0)
        setStep(data.currentStep ?? 'Läuft')

        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          active = false
          router.refresh()
        }
      } catch {
        // Netzaussetzer sind unkritisch – der nächste Durchlauf holt es nach.
      }
    }

    const interval = setInterval(poll, 2000)
    void poll()
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [analysisId, router])

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-medium">{step}</p>
        <p className="text-[13px] tabular-nums text-ink-muted">{progress} %</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-3 text-[12px] text-ink-subtle">
        Der Lauf arbeitet im Hintergrund weiter. Diese Seite kann geschlossen werden.
      </p>
    </Card>
  )
}
