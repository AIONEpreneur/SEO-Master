import { redirect } from 'next/navigation'
import { Puzzle, ShieldCheck } from 'lucide-react'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { Button, Card } from '@/components/ui'
import { erteileZugriffAction, lehneAbAction } from './actions'

export const dynamic = 'force-dynamic'

/**
 * Zustimmungsseite des Anmelde-Flusses.
 *
 * Hierher schickt Claude (oder ChatGPT) die Person, die eine Verbindung
 * herstellen will. Ohne Anmeldung geht es zuerst zur Anmeldeseite und
 * danach hierher zurück. Erst der Klick auf "Zugriff erlauben" stellt
 * einen Einmal-Code aus – nichts passiert nebenbei.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const clientId = params.client_id ?? ''
  const redirectUri = params.redirect_uri ?? ''
  const state = params.state ?? ''
  const codeChallenge = params.code_challenge ?? ''

  const session = await getSession()
  if (!session) {
    const eigene = new URLSearchParams()
    for (const [schluessel, wert] of Object.entries(params)) {
      if (wert !== undefined) eigene.set(schluessel, wert)
    }
    redirect(`/login?weiter=${encodeURIComponent(`/oauth/authorize?${eigene.toString()}`)}`)
  }

  const client = clientId ? await db.oAuthClient.findUnique({ where: { id: clientId } }) : null
  const anfrageGueltig =
    client !== null &&
    client.redirectUris.includes(redirectUri) &&
    params.response_type === 'code' &&
    codeChallenge.length > 0 &&
    (params.code_challenge_method ?? 'S256') === 'S256'

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">SEO-Master verbinden</h1>
        </div>

        {!anfrageGueltig ? (
          <Card className="p-6 text-center">
            <p className="text-sm font-medium">Diese Verbindungsanfrage ist ungültig.</p>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              Es fehlt eine Angabe oder die Rücksprungadresse passt nicht zur Registrierung. Bitte die
              Verbindung im KI-Werkzeug neu starten.
            </p>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
                <Puzzle size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">„{client.name}“ möchte auf SEO-Master zugreifen</p>
                <p className="truncate text-[12px] text-ink-subtle">
                  Angemeldet als {session.email} · Arbeitsbereich „{session.organizationName}“
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-muted">
              <li className="flex items-start gap-2">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-good" />
                Gespeicherte Keyword-Recherchen und Ranking-Abfragen lesen
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-good" />
                Neue Recherchen und Ranking-Abfragen starten (verbraucht dein Kontingent)
              </li>
            </ul>
            <p className="mt-3 text-[12px] text-ink-subtle">
              Der Zugriff gilt nur für diesen Arbeitsbereich. Du kannst ihn jederzeit unter
              Einstellungen → Extension widerrufen.
            </p>

            <div className="mt-5 flex gap-2">
              <form action={erteileZugriffAction} className="flex-1">
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="redirect_uri" value={redirectUri} />
                <input type="hidden" name="code_challenge" value={codeChallenge} />
                <input type="hidden" name="state" value={state} />
                <Button type="submit" className="w-full">
                  Zugriff erlauben
                </Button>
              </form>
              <form action={lehneAbAction} className="flex-1">
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="redirect_uri" value={redirectUri} />
                <input type="hidden" name="state" value={state} />
                <Button type="submit" variant="secondary" className="w-full">
                  Ablehnen
                </Button>
              </form>
            </div>
          </Card>
        )}
      </div>
    </main>
  )
}
