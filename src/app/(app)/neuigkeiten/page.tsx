import { requireSession } from '@/lib/auth/session'
import { Card, CardHeader, EmptyState } from '@/components/ui'
import { Megaphone } from 'lucide-react'
import { alleNeuigkeiten, ART_LABEL, ART_FARBE } from '@/lib/neuigkeiten'
import { NeuigkeitAnlegen } from './anlegen'
import { AlsGelesenMerken } from './gelesen'
import { loescheNeuigkeit } from '@/lib/neuigkeiten/actions'

export const dynamic = 'force-dynamic'

/**
 * Die Änderungshistorie.
 *
 * Der Aufsteller auf der Übersicht zeigt, was neu ist, und verschwindet dann.
 * Diese Seite ist das Gedächtnis dazu: Wer im März wissen will, wann sich das
 * Verhalten der Wettbewerber-Auswahl geändert hat, findet es hier.
 *
 * Der Besuch gilt als gelesen. Wer hier war, braucht den Aufsteller nicht
 * mehr — er würde ihm dasselbe noch einmal zeigen.
 */
export default async function NeuigkeitenSeite() {
  const session = await requireSession()
  const eintraege = await alleNeuigkeiten()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl">Neuigkeiten</h1>
        <p className="mt-1 text-[13px] font-medium text-ink-muted">
          Was sich in SEO-Master geändert hat — das Neueste zuerst.
        </p>
      </header>

      {/* Nur für die echte Anmeldung: In einer Fremdansicht würde sonst der
          Merker einer Kundin gesetzt, die gar nicht hier war. */}
      {!session.nurAnsicht && <AlsGelesenMerken />}

      {session.isSuperAdmin && <NeuigkeitAnlegen />}

      {eintraege.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone size={28} />}
            title="Noch keine Einträge"
            description="Sobald sich etwas ändert, steht es hier — und beim nächsten Anmelden auch auf der Übersicht."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`${eintraege.length} ${eintraege.length === 1 ? 'Eintrag' : 'Einträge'}`}
            description="Neu heisst: Es gab es vorher nicht. Verbessert: Es gab es, es taugte nur wenig. Behoben: Es war kaputt."
          />
          <ul className="divide-y-2 divide-border">
            {eintraege.map((n) => (
              <li key={n.id} className="flex gap-4 p-5">
                <span
                  className={`h-fit shrink-0 rounded-full border-2 border-tinte px-2.5 py-0.5 text-[11px] font-bold text-tinte ${ART_FARBE[n.art]}`}
                >
                  {ART_LABEL[n.art]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[14px] font-bold">{n.titel}</p>
                    <span className="text-[12px] font-medium text-ink-subtle">
                      {n.veroeffentlichtAm.toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-ink-muted">
                    {n.text}
                  </p>
                  {session.isSuperAdmin && (
                    <form action={loescheNeuigkeit} className="mt-2">
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        className="text-[12px] font-bold text-ink-subtle underline hover:text-brand"
                      >
                        Löschen
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
