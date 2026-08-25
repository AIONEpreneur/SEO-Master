'use client'

import { useActionState } from 'react'
import { acceptInvitationAction, type FormState } from '@/lib/auth/actions'
import { Button, Input, Label } from '@/components/ui'

export function EinladungsForm({ code, email }: { code: string; email: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(acceptInvitationAction, {})

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="code" value={code} />

      <div>
        <Label htmlFor="email">E-Mail-Adresse</Label>
        {/* Fest vorgegeben: Die Einladung gilt für genau diese Adresse. */}
        <Input id="email" name="email" type="email" defaultValue={email} readOnly className="opacity-70" />
      </div>

      <div>
        <Label htmlFor="name">Ihr Name</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Vor- und Nachname" />
      </div>

      <div>
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={10}
        />
        <p className="mt-1 text-[12px] text-ink-subtle">Mindestens 10 Zeichen.</p>
      </div>

      {state.error && <p className="text-[13px] text-bad">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Wird eingerichtet …' : 'Zugang einrichten'}
      </Button>
    </form>
  )
}
