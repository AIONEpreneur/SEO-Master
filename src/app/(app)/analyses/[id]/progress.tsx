'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { XCircle } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { cancelAnalysisAction } from '@/lib/analysis/actions'

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
  // Sekunden ohne Regung. Ab einer gewissen Dauer ist ein Lauf nicht mehr
  // langsam, sondern hängt – und dann braucht es einen Ausweg.
  const [stillSeit, setStillSeit] = useState(0)

  // Drei Minuten: Der längste reguläre Einzelschritt ist der Seitenabruf mit
  // 90 Sekunden Zeitgrenze. Wer deutlich darüber liegt, wartet nicht mehr.
  const haengt = stillSeit > 180

  useEffect(() => {
    let active = true

    const poll = async () => {
      try {
        const response = await fetch(`/api/analyses/${analysisId}/status`, { cache: 'no-store' })
        if (!response.ok || !active) return
        const data = await response.json()

        setProgress(data.progress ?? 0)
        setStep(data.currentStep ?? 'Läuft')
        setStillSeit(data.stillSeit ?? 0)

        if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
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
      {haengt ? (
        <div className="mt-4 rounded-lg bg-warn-subtle px-4 py-3">
          <p className="text-[13px] font-medium text-warn">
            Seit {Math.floor(stillSeit / 60)} Minuten keine Regung
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Ein einzelner Schritt kann ein paar Minuten dauern. Bleibt es dabei, lässt sich der
            Lauf hier beenden – danach kann er neu gestartet werden.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-ink-subtle">
          Der Lauf arbeitet im Hintergrund weiter. Diese Seite kann geschlossen werden.
        </p>
      )}

      <form action={cancelAnalysisAction} className="mt-3">
        <input type="hidden" name="id" value={analysisId} />
        <Button type="submit" variant="secondary" size="sm">
          <XCircle size={15} />
          Lauf abbrechen
        </Button>
      </form>
    </Card>
  )
}
