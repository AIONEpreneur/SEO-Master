'use client'

import { useActionState, useState } from 'react'
import { Plus } from 'lucide-react'
import { createProjectAction, type StartState } from '@/lib/analysis/actions'
import { Button, Card, CardHeader, Input, Label, Select } from '@/components/ui'
import {
  MARKTGRUPPEN,
  BERICHTSSPRACHEN,
  STANDARD_MARKT,
  marktName,
  maerkteInWorten,
} from '@/lib/analysis/maerkte'

export function ProjectForm() {
  const [state, action, pending] = useActionState<StartState, FormData>(createProjectAction, {})
  const [open, setOpen] = useState(false)
  // Der erste gewählte Markt ist der führende — deshalb eine Liste und keine
  // Menge: Die Reihenfolge trägt Bedeutung.
  const [maerkte, setMaerkte] = useState<number[]>([STANDARD_MARKT])

  const umschalten = (code: number) =>
    setMaerkte((vorher) =>
      vorher.includes(code) ? vorher.filter((c) => c !== code) : [...vorher, code],
    )

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Projekt anlegen
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Neues Projekt"
        action={
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
        }
      />
      <form action={action} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="z. B. Hauptwebsite" />
          </div>
          <div>
            <Label htmlFor="project-url">URL</Label>
            <Input id="project-url" name="url" type="url" required placeholder="https://beispiel.de" />
          </div>
        </div>
        {/*
          Märkte als Mehrfachauswahl statt als Liste mit einem Treffer.

          Wer für den DACH-Raum arbeitet, braucht Deutschland, Österreich und
          die Schweiz — und jedes davon einzeln, weil das Land beim
          Datenanbieter die grösste Einheit ist. Der Kurzweg nimmt ihr das
          dreifache Klicken ab, und die Zeile darunter sagt vorher, was das
          kostet: drei Länder heissen drei Läufe.
        */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label>Märkte</Label>
            <div className="flex gap-2">
              {MARKTGRUPPEN.filter((g) => g.laender.length <= 3).map((gruppe) => (
                <button
                  key={gruppe.name}
                  type="button"
                  onClick={() => setMaerkte(gruppe.laender.map((l) => l.code))}
                  className="lift rounded-full border-2 border-border bg-sand px-3 py-1 text-[12px] font-bold"
                >
                  {gruppe.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMaerkte([])}
                className="rounded-full border-2 border-transparent px-2 py-1 text-[12px] font-medium text-ink-muted hover:border-border"
              >
                Leeren
              </button>
            </div>
          </div>

          <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border-2 border-border bg-surface-muted p-3">
            {MARKTGRUPPEN.map((gruppe) => (
              <div key={gruppe.name} className="mb-3 last:mb-0">
                <p className="mb-1.5 font-display text-[11px] uppercase tracking-wider text-ink-subtle">
                  {gruppe.name}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {gruppe.laender.map((m) => {
                    const an = maerkte.includes(m.code)
                    return (
                      <label
                        key={m.code}
                        className={`cursor-pointer rounded-full border-2 border-border px-3 py-1 text-[12px] font-medium transition-colors ${
                          an ? 'bg-tinte font-bold text-creme' : 'bg-surface hover:bg-limette'
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="locationCodes"
                          value={m.code}
                          checked={an}
                          onChange={() => umschalten(m.code)}
                          className="sr-only"
                        />
                        {m.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-1.5 text-[12px] font-medium text-ink-muted">
            {maerkte.length === 0
              ? 'Noch kein Markt gewählt.'
              : maerkte.length === 1
                ? `Ein Markt: ${marktName(maerkte[0])}. Jede Prüfung ist ein Lauf.`
                : `${maerkte.length} Märkte: ${maerkteInWorten(maerkte)}. Gemessen wird je Land einzeln — eine Prüfung sind also ${maerkte.length} Läufe und ${maerkte.length}× Kontingent.`}
          </p>
        </div>

        <div className="sm:w-1/2">
          <Label htmlFor="project-language">Sprache</Label>
          <Select id="project-language" name="languageCode" defaultValue="de">
            {BERICHTSSPRACHEN.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="description">Notiz (optional)</Label>
          <Input id="description" name="description" placeholder="Worum geht es bei diesem Projekt?" />
        </div>
        {state.error && <p className="rounded-md border-2 border-tinte bg-rosa px-3 py-2 text-[13px] font-bold text-rot">{state.error}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Wird angelegt…' : 'Projekt anlegen'}
        </Button>
      </form>
    </Card>
  )
}
