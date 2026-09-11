import { requireSession, echteSitzung } from '@/lib/auth/session'
import { Card } from '@/components/ui'
import { KontaktdatenForm, PasswortForm, BildForm } from './formulare'
import { AboBereich } from './abo'

export const dynamic = 'force-dynamic'

/**
 * Das eigene Konto.
 *
 * Gezeigt werden die Daten der angemeldeten Person — nicht die der Ansicht:
 * Wer gerade in einen fremden Arbeitsbereich schaut, ändert hier trotzdem
 * sein eigenes Konto. Der Abo-Bereich gehört dagegen zum Arbeitsbereich,
 * denn bezahlt wird für diesen.
 */
export default async function ProfilSeite({
  searchParams,
}: {
  searchParams: Promise<{ abo?: string; fehler?: string }>
}) {
  const session = await requireSession()
  const user = await echteSitzung()
  if (!user) return null

  const { abo, fehler } = await searchParams

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl">Mein Konto</h1>
        <p className="mt-1 text-[13px] font-medium text-ink-muted">
          Kontaktdaten, Passwort, Profilbild und dein Abo.
        </p>
      </header>

      {abo === 'erfolg' && (
        <Card className="bg-limette p-5">
          <p className="text-[14px] font-bold">Danke — dein Abo ist aktiv.</p>
          <p className="mt-1 text-[13px] font-medium">
            Das Guthaben steht bereit. Sollte der Tarif unten noch nicht stimmen, dauert die
            Bestätigung von Stripe einen Moment; lade die Seite dann einfach neu.
          </p>
        </Card>
      )}
      {abo === 'abgebrochen' && (
        <Card className="bg-creme p-5">
          <p className="text-[14px] font-bold">Kauf abgebrochen — es wurde nichts abgebucht.</p>
        </Card>
      )}
      {fehler && (
        <Card className="bg-rosa p-5">
          <p className="text-[14px] font-bold text-rot">
            {fehler === 'kein-abo'
              ? 'Für diesen Arbeitsbereich gibt es noch kein Abo.'
              : 'Das Zahlungssystem ist gerade nicht erreichbar. Bitte später erneut versuchen.'}
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <KontaktdatenForm name={user.name} email={user.email} />
        <BildForm datei={user.avatarDatei} name={user.name} email={user.email} />
      </div>

      <PasswortForm />

      <AboBereich session={session} />
    </div>
  )
}
