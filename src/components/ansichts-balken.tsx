import { Eye, LogOut } from 'lucide-react'
import { beendeAnsichtAction } from '@/lib/auth/ansicht'
import type { SessionUser } from '@/lib/auth/session'

/**
 * Balken über der ganzen App, solange ein anderer Bereich gezeigt wird.
 *
 * Er ist bewusst auffällig und nicht wegklickbar. Die schlimmste Form dieser
 * Funktion ist die, bei der man vergisst, dass sie an ist – und dann glaubt,
 * die eigene Übersicht sei kaputt, weil Datentresor und Verbrauch fehlen.
 */
export function AnsichtsBalken({ session }: { session: SessionUser }) {
  if (!session.wechsel) return null

  return (
    <div className="sticky top-0 z-40 border-b border-warn/40 bg-warn-subtle">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 lg:px-8">
        <Eye size={15} className="shrink-0 text-warn" />
        <p className="min-w-0 flex-1 text-[13px]">
          <span className="font-medium">
            {session.wechsel.nurAnsicht ? 'Fremde Ansicht' : 'Kundensicht'}: {session.wechsel.name}
          </span>
          <span className="text-ink-muted">
            {session.wechsel.nurAnsicht
              ? ' — nur lesend. Es lässt sich nichts starten und nichts ändern.'
              : ' — so erlebt eine Kundin die App. Läufe hier verbrauchen echtes Guthaben.'}
          </span>
        </p>
        <form action={beendeAnsichtAction} className="shrink-0">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-warn/40 px-2.5 py-1 text-[13px] font-medium transition-colors hover:bg-warn/10"
          >
            <LogOut size={13} />
            Zurück zu meinem Bereich
          </button>
        </form>
      </div>
    </div>
  )
}
