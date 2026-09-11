'use client'

import { useActionState, useState } from 'react'
import { Plus } from 'lucide-react'
import { createProjectAction, type StartState } from '@/lib/analysis/actions'
import { Button, Card, CardHeader, Input, Label, Select } from '@/components/ui'
import { MARKTGRUPPEN, BERICHTSSPRACHEN, STANDARD_MARKT } from '@/lib/analysis/maerkte'

export function ProjectForm() {
  const [state, action, pending] = useActionState<StartState, FormData>(createProjectAction, {})
  const [open, setOpen] = useState(false)

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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="project-market">Markt</Label>
            <Select id="project-market" name="locationCode" defaultValue={STANDARD_MARKT}>
              {MARKTGRUPPEN.map((gruppe) => (
                <optgroup
                  key={gruppe.name}
                  label={gruppe.hinweis ? `${gruppe.name} — ${gruppe.hinweis}` : gruppe.name}
                >
                  {gruppe.laender.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="project-language">Sprache</Label>
            <Select id="project-language" name="languageCode" defaultValue="de">
              {BERICHTSSPRACHEN.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
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
