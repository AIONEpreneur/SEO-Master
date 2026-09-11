'use client'

import { useActionState, useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { legeNeuigkeitAn, type NeuigkeitState } from '@/lib/neuigkeiten/actions'
import { Button, Card, CardHeader, Input, Label, Select } from '@/components/ui'
import { ART_LABEL } from '@/lib/neuigkeiten'

/** Einen Eintrag schreiben — nur der Betrieb sieht dieses Formular. */
export function NeuigkeitAnlegen() {
  const [state, action, pending] = useActionState<NeuigkeitState, FormData>(legeNeuigkeitAn, {})
  const [offen, setOffen] = useState(false)

  if (!offen) {
    return (
      <Button variant="secondary" onClick={() => setOffen(true)}>
        <Plus size={16} />
        Eintrag schreiben
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Neuer Eintrag"
        description="Sichtbar für alle Arbeitsbereiche, sofort nach dem Speichern."
        action={
          <Button size="sm" variant="ghost" onClick={() => setOffen(false)}>
            Abbrechen
          </Button>
        }
      />
      <form action={action} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div>
            <Label htmlFor="n-titel">Titel</Label>
            <Input id="n-titel" name="titel" required placeholder="z. B. Projekte können mehrere Märkte tragen" />
          </div>
          <div>
            <Label htmlFor="n-art">Art</Label>
            <Select id="n-art" name="art" defaultValue="NEU">
              {(Object.keys(ART_LABEL) as Array<keyof typeof ART_LABEL>).map((art) => (
                <option key={art} value={art}>
                  {ART_LABEL[art]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="n-text">Was hat sich geändert?</Label>
          <textarea
            id="n-text"
            name="text"
            rows={3}
            required
            placeholder="Zwei, drei Sätze. Was ist anders — und was hat die Leserin davon?"
            className="w-full rounded-xl border-2 border-border bg-surface px-3 py-2 text-[13px] font-medium text-ink outline-none focus:outline-2 focus:outline-brand"
          />
        </div>

        {state.error && (
          <p className="rounded-md border-2 border-tinte bg-rosa px-3 py-2 text-[13px] font-bold text-rot">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="flex items-center gap-2 rounded-md border-2 border-tinte bg-limette px-3 py-2 text-[13px] font-bold">
            <Check size={15} strokeWidth={3} />
            {state.ok}
          </p>
        )}

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Wird veröffentlicht…' : 'Veröffentlichen'}
        </Button>
      </form>
    </Card>
  )
}
