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
    // Orange mit Tinten-Kontur: die Warnfarbe der Vorlage. Der Balken muss
    // sich vom Rest abheben, ohne wie ein Fehler auszusehen — es ist ja
    // alles in Ordnung, es ist nur nicht der eigene Bereich.
    <div className="sticky top-0 z-40 border-b-2 border-tinte bg-orange">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 lg:px-8">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-tinte bg-creme">
          <Eye size={14} className="text-tinte" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] text-tinte">
          <span className="font-display text-[12px] uppercase tracking-wide">
            {session.wechsel.nurAnsicht ? 'Fremde Ansicht' : 'Kundensicht'}
          </span>
          <span className="font-bold"> {session.wechsel.name}</span>
          <span className="font-medium">
            {session.wechsel.nurAnsicht
              ? ' — nur lesend. Es lässt sich nichts starten und nichts ändern.'
              : ' — so erlebt eine Kundin die App. Läufe hier verbrauchen echtes Guthaben.'}
          </span>
        </p>
        <form action={beendeAnsichtAction} className="shrink-0">
          <button
            type="submit"
            className="lift inline-flex items-center gap-1.5 rounded-full border-2 border-tinte bg-tinte px-4 py-1.5 text-[13px] font-bold text-creme"
          >
            <LogOut size={13} />
            Zurück zu meinem Bereich
          </button>
        </form>
      </div>
    </div>
  )
}
