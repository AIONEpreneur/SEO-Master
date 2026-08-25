'use client'

import { useActionState, useState } from 'react'
import { Copy, Check, UserPlus } from 'lucide-react'
import { ladeEinAction, type EinladungsState } from './actions'
import { Button, Card, Input, Label } from '@/components/ui'
import { cn } from '@/lib/utils/cn'

export function Einladen() {
  const [state, formAction, pending] = useActionState<EinladungsState, FormData>(ladeEinAction, {})
  const [art, setArt] = useState<'kundin' | 'team'>('kundin')
  const [kopiert, setKopiert] = useState(false)

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <UserPlus size={15} className="text-ink-subtle" />
        <p className="text-[13px] font-medium">Person einladen</p>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="art" value={art} />

        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                wert: 'kundin' as const,
                titel: 'Als Kundin',
                text: 'Bekommt einen eigenen Arbeitsbereich und sieht ausschliesslich ihre eigenen Analysen.',
              },
              {
                wert: 'team' as const,
                titel: 'Ins eigene Team',
                text: 'Arbeitet in diesem Arbeitsbereich mit und sieht dieselben Projekte wie Sie.',
              },
            ]
          ).map((option) => (
            <button
              key={option.wert}
              type="button"
              onClick={() => setArt(option.wert)}
              className={cn(
                'rounded-lg border px-3.5 py-3 text-left transition-colors',
                art === option.wert
                  ? 'border-brand bg-brand-subtle'
                  : 'border-border hover:border-border-strong',
              )}
            >
              <span className="block text-[13px] font-medium">{option.titel}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-subtle">{option.text}</span>
            </button>
          ))}
        </div>

        <div>
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input id="email" name="email" type="email" required placeholder="name@beispiel.de" />
        </div>

        {art === 'kundin' && (
          <div>
            <Label htmlFor="arbeitsbereich">Name des Arbeitsbereichs</Label>
            <Input id="arbeitsbereich" name="arbeitsbereich" placeholder="z. B. Praxis Sommer" />
            <p className="mt-1 text-[12px] text-ink-subtle">
              Optional. Bleibt das Feld leer, wird der Name aus der Anmeldung übernommen.
            </p>
          </div>
        )}

        {state.error && <p className="text-[13px] text-bad">{state.error}</p>}

        <Button type="submit" disabled={pending}>
          {pending ? 'Wird erstellt …' : 'Einladung erstellen'}
        </Button>
      </form>

      {state.link && (
        <div className="mt-5 rounded-lg border border-brand/30 bg-brand-subtle p-4">
          <p className="text-[13px] font-medium">Einladung für {state.email}</p>
          <p className="mt-1 text-[12px] text-ink-muted">
            Diesen Link an die Person schicken. Er ist 14 Tage gültig und funktioniert einmal.
            <strong className="font-medium"> Er wird nur jetzt angezeigt</strong> — geht er verloren, einfach
            eine neue Einladung erstellen.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2.5 py-2 text-[12px]">
              {state.link}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(state.link ?? '')
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
