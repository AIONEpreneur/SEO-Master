'use client'

import { useActionState, useRef, useState } from 'react'
import { Check, Upload, Trash2 } from 'lucide-react'
import {
  speichereKontaktdaten,
  wechslePasswort,
  speichereBild,
  entferneProfilbild,
  beendeAndereSitzungen,
  type ProfilState,
} from '@/lib/profil/actions'
import { Avatar } from '@/components/avatar'
import { Button, Card, CardHeader, Input, Label } from '@/components/ui'

/** Eine Rückmeldung, die nach einem Vorgang stehen bleibt. */
function Meldung({ state }: { state: ProfilState }) {
  if (state.error) {
    return (
      <p className="rounded-md border-2 border-tinte bg-rosa px-3 py-2 text-[13px] font-bold text-rot">
        {state.error}
      </p>
    )
  }
  if (state.ok) {
    return (
      <p className="flex items-start gap-2 rounded-md border-2 border-tinte bg-limette px-3 py-2 text-[13px] font-bold">
        <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0" />
        {state.ok}
      </p>
    )
  }
  return null
}

export function KontaktdatenForm({ name, email }: { name: string | null; email: string }) {
  const [state, action, pending] = useActionState<ProfilState, FormData>(speichereKontaktdaten, {})

  return (
    <Card>
      <CardHeader
        title="Kontaktdaten"
        description="Die E-Mail-Adresse ist zugleich dein Anmeldename."
      />
      <form action={action} className="space-y-4 p-5">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={name ?? ''} placeholder="Vorname Nachname" />
        </div>
        <div>
          <Label htmlFor="email">E-Mail</Label>
          <Input id="email" name="email" type="email" defaultValue={email} required />
        </div>
        <Meldung state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Wird gespeichert …' : 'Speichern'}
        </Button>
      </form>
    </Card>
  )
}

export function PasswortForm() {
  const [state, action, pending] = useActionState<ProfilState, FormData>(wechslePasswort, {})

  return (
    <Card>
      <CardHeader
        title="Passwort"
        description="Zum Ändern brauchst du dein aktuelles Passwort — ein offener Rechner soll nicht reichen."
      />
      <form action={action} className="space-y-4 p-5">
        <div>
          <Label htmlFor="aktuell">Aktuelles Passwort</Label>
          <Input id="aktuell" name="aktuell" type="password" autoComplete="current-password" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="neu">Neues Passwort</Label>
            <Input id="neu" name="neu" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          <div>
            <Label htmlFor="wiederholung">Wiederholen</Label>
            <Input
              id="wiederholung"
              name="wiederholung"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </div>
        </div>
        <Meldung state={state} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Wird geändert …' : 'Passwort ändern'}
          </Button>
          <span className="text-[12px] font-medium text-ink-muted">Mindestens 10 Zeichen.</span>
        </div>
      </form>

      <div className="border-t-2 border-border p-5">
        <p className="text-[13px] font-bold">Andere Geräte abmelden</p>
        <p className="mt-1 text-[13px] font-medium text-ink-muted">
          Beendet alle Anmeldungen ausser dieser. Sinnvoll nach einem Passwortwechsel oder wenn ein
          Gerät abhandengekommen ist.
        </p>
        <form action={beendeAndereSitzungen} className="mt-3">
          <Button type="submit" variant="secondary" size="sm">
            Überall sonst abmelden
          </Button>
        </form>
      </div>
    </Card>
  )
}

export function BildForm({
  datei,
  name,
  email,
}: {
  datei: string | null
  name: string | null
  email: string
}) {
  const [state, action, pending] = useActionState<ProfilState, FormData>(speichereBild, {})
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  const eingabe = useRef<HTMLInputElement>(null)

  return (
    <Card>
      <CardHeader title="Profilbild" description="JPG, PNG oder WebP, bis 2 MB." />
      <form action={action} className="space-y-4 p-5">
        <div className="flex items-center gap-5">
          <Avatar datei={datei} name={name} email={email} size={72} />
          <div className="min-w-0 space-y-2">
            <input
              ref={eingabe}
              type="file"
              name="bild"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setGewaehlt(e.target.files?.[0]?.name ?? null)}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => eingabe.current?.click()}>
              <Upload size={14} />
              Bild wählen
            </Button>
            {gewaehlt && <p className="truncate text-[12px] font-medium text-ink-muted">{gewaehlt}</p>}
          </div>
        </div>
        <Meldung state={state} />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending || !gewaehlt}>
            {pending ? 'Wird hochgeladen …' : 'Hochladen'}
          </Button>
          {datei && (
            <Button type="submit" variant="ghost" size="md" formAction={entferneProfilbild}>
              <Trash2 size={14} />
              Entfernen
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}
