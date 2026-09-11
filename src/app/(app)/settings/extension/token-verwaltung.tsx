'use client'

import { useActionState, useState } from 'react'
import { Copy, Check, Puzzle } from 'lucide-react'
import { erzeugeTokenAction, type TokenState } from './actions'
import { Button, Card, Input, Label } from '@/components/ui'

export function TokenVerwaltung() {
  const [state, formAction, pending] = useActionState<TokenState, FormData>(erzeugeTokenAction, {})
  const [kopiert, setKopiert] = useState(false)

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Puzzle size={15} className="text-ink-subtle" />
        <p className="text-[13px] font-medium">Neuen Zugangsschlüssel erzeugen</p>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <Label htmlFor="name">Bezeichnung</Label>
          <Input id="name" name="name" placeholder="z. B. Chrome am Arbeitsrechner" />
          <p className="mt-1 text-[12px] text-ink-subtle">
            Optional. Hilft beim Wiedererkennen, wenn mehrere Schlüssel im Umlauf sind.
          </p>
        </div>

        {state.error && <p className="text-[13px] text-bad">{state.error}</p>}

        <Button type="submit" disabled={pending}>
          {pending ? 'Wird erzeugt …' : 'Schlüssel erzeugen'}
        </Button>
      </form>

      {state.token && (
        <div className="mt-5 rounded-lg border border-brand/30 bg-brand-subtle p-4">
          <p className="text-[13px] font-medium">Schlüssel „{state.name}“</p>
          <p className="mt-1 text-[12px] text-ink-muted">
            Diesen Wert in der Extension unter Einstellungen → SEO-Master-Konto eintragen.
            <strong className="font-medium"> Er wird nur jetzt angezeigt</strong> — geht er verloren,
            einfach einen neuen erzeugen und den alten widerrufen.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2.5 py-2 text-[12px]">
              {state.token}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(state.token ?? '')
                setKopiert(true)
                setTimeout(() => setKopiert(false), 2000)
              }}
            >
              {kopiert ? <Check size={14} /> : <Copy size={14} />}
              {kopiert ? 'Kopiert' : 'Kopieren'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
