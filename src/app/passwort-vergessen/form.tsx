'use client'

import { useActionState } from 'react'
import { MailCheck } from 'lucide-react'
import { fordereHilfeAn, type HilfeState } from '@/lib/auth/passwort-hilfe'
import { Button, Card, Input, Label } from '@/components/ui'

export function VergessenForm() {
  const [state, action, pending] = useActionState<HilfeState, FormData>(fordereHilfeAn, {})

  // Die Bestätigung nennt bewusst nicht, ob es das Konto gibt: Sonst liesse
  // sich über dieses Formular herausfinden, wer hier registriert ist.
  if (state.fertig) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-tinte bg-limette">
          <MailCheck size={20} />
        </div>
        <p className="text-[15px] font-bold">Schau in dein Postfach</p>
        <p className="mt-2 text-[13px] font-medium text-ink-muted">
          Wenn es zu dieser Adresse ein Konto gibt, ist der Link unterwegs. Er gilt eine Stunde.
          Sieh auch im Werbe- oder Spam-Ordner nach.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="email">E-Mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        {state.error && (
          <p className="rounded-md border-2 border-tinte bg-rosa px-3 py-2 text-[13px] font-bold text-rot">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Wird gesendet …' : 'Link anfordern'}
        </Button>
      </form>
    </Card>
  )
}
