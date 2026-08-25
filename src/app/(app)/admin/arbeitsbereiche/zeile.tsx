'use client'

import { useActionState } from 'react'
import { setzeGuthabenAction, setzeTarifAction, type AdminState } from '@/lib/admin/actions'
import { Button, Input, Select } from '@/components/ui'

type Bereich = {
  id: string
  name: string
  plan: string
  credits: number
  _count: { memberships: number; analyses: number; projects: number }
}

const TARIFE = ['INTERNAL', 'FREE', 'STARTER', 'PRO', 'AGENCY']

export function BereichsZeile({ bereich }: { bereich: Bereich }) {
  const [state, formAction, pending] = useActionState<AdminState, FormData>(setzeGuthabenAction, {})

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{bereich.name}</p>
          <p className="mt-0.5 truncate text-[12px] text-ink-subtle">
            {bereich._count.memberships} {bereich._count.memberships === 1 ? 'Person' : 'Personen'} ·{' '}
            {bereich._count.analyses} Analysen · {bereich._count.projects} Projekte
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <form action={setzeTarifAction} className="flex items-center gap-1.5">
            <input type="hidden" name="organizationId" value={bereich.id} />
            <Select name="plan" defaultValue={bereich.plan} className="h-8 w-32 text-[13px]">
              {TARIFE.map((tarif) => (
                <option key={tarif} value={tarif}>
                  {tarif}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="ghost" size="sm">
              Setzen
            </Button>
          </form>

          <form action={formAction} className="flex items-center gap-1.5">
            <input type="hidden" name="organizationId" value={bereich.id} />
            <Input
              name="credits"
              type="number"
              min={0}
              defaultValue={bereich.credits}
              className="h-8 w-28 text-[13px]"
              aria-label={`Guthaben von ${bereich.name}`}
            />
            <Button type="submit" variant="ghost" size="sm" disabled={pending}>
              {pending ? '…' : 'Guthaben'}
            </Button>
          </form>
        </div>
      </div>

      {state.error && <p className="mt-2 text-[13px] text-bad">{state.error}</p>}
      {state.hinweis && <p className="mt-2 text-[13px] text-good">{state.hinweis}</p>}
    </li>
  )
}
