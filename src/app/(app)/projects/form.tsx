'use client'

import { useActionState, useState } from 'react'
import { Plus } from 'lucide-react'
import { createProjectAction, type StartState } from '@/lib/analysis/actions'
import { Button, Card, CardHeader, Input, Label, Select } from '@/components/ui'

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
            <Select id="project-market" name="locationCode" defaultValue={2276}>
              <option value={2276}>Deutschland</option>
              <option value={2040}>Österreich</option>
              <option value={2756}>Schweiz</option>
              <option value={2826}>Vereinigtes Königreich</option>
              <option value={2840}>USA</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="project-language">Sprache</Label>
            <Select id="project-language" name="languageCode" defaultValue="de">
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="description">Notiz (optional)</Label>
          <Input id="description" name="description" placeholder="Worum geht es bei diesem Projekt?" />
        </div>
        {state.error && <p className="rounded-lg bg-bad-subtle px-3 py-2 text-[13px] text-bad">{state.error}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Wird angelegt…' : 'Projekt anlegen'}
        </Button>
      </form>
    </Card>
  )
}
