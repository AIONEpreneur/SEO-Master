'use client'

import { useActionState, useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { legeWunschAn, type WunschState } from '@/lib/wuensche/actions'
import { Button, Card, CardHeader, Input, Label } from '@/components/ui'

export function WunschForm() {
  const [state, action, pending] = useActionState<WunschState, FormData>(legeWunschAn, {})
  const [offen, setOffen] = useState(false)

  if (!offen) {
    return (
      <Button variant="secondary" onClick={() => setOffen(true)}>
        <Plus size={16} />
        Wunsch eintragen
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Was fehlt dir?"
        description="Je konkreter, desto eher lässt es sich bauen."
        action={
          <Button size="sm" variant="ghost" onClick={() => setOffen(false)}>
            Abbrechen
          </Button>
        }
      />
      <form action={action} className="space-y-4 p-5">
        <div>
          <Label htmlFor="w-titel">In einem Satz</Label>
          <Input id="w-titel" name="titel" required placeholder="z. B. Berichte als PDF herunterladen" />
        </div>
        <div>
          <Label htmlFor="w-text">Wofür brauchst du das?</Label>
          <textarea
            id="w-text"
            name="text"
            rows={4}
            required
            placeholder="Was machst du gerade stattdessen, und woran hakt es dabei? Der Zweck hilft mehr als die Lösung — oft geht es einfacher als gedacht."
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
          {pending ? 'Wird gesendet…' : 'Absenden'}
        </Button>
      </form>
    </Card>
  )
}
