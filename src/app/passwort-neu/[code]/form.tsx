'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Check } from 'lucide-react'
import { setzeNeuesPasswort, type NeuState } from '@/lib/auth/passwort-hilfe'
import { Button, Card, Input, Label } from '@/components/ui'

export function NeuesPasswortForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<NeuState, FormData>(setzeNeuesPasswort, {})

  if (state.ok) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-tinte bg-limette">
          <Check size={20} strokeWidth={3} />
        </div>
        <p className="text-[15px] font-bold">Passwort geändert</p>
        <p className="mt-2 text-[13px] font-medium text-ink-muted">
          Alle bisherigen Anmeldungen wurden beendet — auch auf anderen Geräten.
        </p>
        <Link
          href="/login"
          className="lift mt-5 inline-block rounded-full border-2 border-tinte bg-tinte px-6 py-3 text-[14px] font-bold text-creme"
        >
          Jetzt anmelden
        </Link>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="code" value={code} />
        <div>
          <Label htmlFor="password">Neues Passwort</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            autoFocus
          />
          <p className="mt-1.5 text-[12px] font-medium text-ink-muted">Mindestens 10 Zeichen.</p>
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
        {state.error && (
          <p className="rounded-md border-2 border-tinte bg-rosa px-3 py-2 text-[13px] font-bold text-rot">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Wird gespeichert …' : 'Passwort setzen'}
        </Button>
      </form>
    </Card>
  )
}
