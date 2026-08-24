'use client'

import { useActionState } from 'react'
import { loginAction, type FormState } from '@/lib/auth/actions'
import { Button, Card, Input, Label } from '@/components/ui'

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {})

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="email">E-Mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        <div>
          <Label htmlFor="password">Passwort</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state.error && (
          <p className="rounded-lg bg-bad-subtle px-3 py-2 text-[13px] text-bad">{state.error}</p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Wird geprüft…' : 'Anmelden'}
        </Button>
      </form>
    </Card>
  )
}
