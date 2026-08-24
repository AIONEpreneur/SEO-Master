'use client'

import { useActionState } from 'react'
import { registerAction, type FormState } from '@/lib/auth/actions'
import { Button, Card, Input, Label } from '@/components/ui'

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {})

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" placeholder="Vorname Nachname" />
        </div>
        <div>
          <Label htmlFor="organization">Arbeitsbereich</Label>
          <Input id="organization" name="organization" required placeholder="z. B. Meine Agentur" />
        </div>
        <div>
          <Label htmlFor="email">E-Mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Passwort</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
          <p className="mt-1 text-[12px] text-ink-subtle">Mindestens 10 Zeichen.</p>
        </div>
        {state.error && (
          <p className="rounded-lg bg-bad-subtle px-3 py-2 text-[13px] text-bad">{state.error}</p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Wird angelegt…' : 'Arbeitsbereich anlegen'}
        </Button>
      </form>
    </Card>
  )
}
