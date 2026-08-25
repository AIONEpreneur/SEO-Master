'use client'

import { useActionState, useState } from 'react'
import { Copy, Check, ShieldOff, ShieldCheck, KeyRound } from 'lucide-react'
import { setzePasswortZurueckAction, schalteSperreAction, type AdminState } from '@/lib/admin/actions'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils/cn'

type Konto = {
  id: string
  email: string
  name: string | null
  isSuperAdmin: boolean
  suspendedAt: Date | null
  lastLoginAt: Date | null
  memberships: Array<{ role: string; organization: { name: string; plan: string } }>
}

export function KontoZeile({ konto, istIchSelbst }: { konto: Konto; istIchSelbst: boolean }) {
  const [state, formAction, pending] = useActionState<AdminState, FormData>(setzePasswortZurueckAction, {})
  const [kopiert, setKopiert] = useState(false)
  const bereich = konto.memberships[0]
  const gesperrt = konto.suspendedAt !== null

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-[13px] font-medium">
            {konto.name ?? konto.email}
            {konto.isSuperAdmin && (
              <span className="rounded bg-brand-subtle px-1.5 py-0.5 text-[11px] font-normal text-brand">
                Betrieb
              </span>
            )}
            {gesperrt && (
              <span className="rounded bg-bad/15 px-1.5 py-0.5 text-[11px] font-normal text-bad">Gesperrt</span>
            )}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-ink-subtle">
            {konto.email}
            {bereich && ` · ${bereich.organization.name} (${bereich.organization.plan})`}
            {konto.lastLoginAt
              ? ` · zuletzt ${konto.lastLoginAt.toLocaleDateString('de-DE')}`
              : ' · noch nie angemeldet'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <form action={formAction}>
            <input type="hidden" name="userId" value={konto.id} />
            <Button type="submit" variant="secondary" size="sm" disabled={pending}>
              <KeyRound size={13} />
              {pending ? 'Setzt …' : 'Passwort'}
            </Button>
          </form>

          {!istIchSelbst && (
            <form action={schalteSperreAction}>
              <input type="hidden" name="userId" value={konto.id} />
              <Button type="submit" variant={gesperrt ? 'secondary' : 'ghost'} size="sm">
                {gesperrt ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
                {gesperrt ? 'Freigeben' : 'Sperren'}
              </Button>
            </form>
          )}
        </div>
      </div>

      {state.error && <p className="mt-2 text-[13px] text-bad">{state.error}</p>}

      {state.passwort && (
        <div className="mt-3 rounded-lg border border-brand/30 bg-brand-subtle p-3">
          <p className="text-[12px] text-ink-muted">
            {state.hinweis}. Alle Sitzungen wurden beendet.
            <strong className="font-medium"> Wird nur jetzt angezeigt.</strong>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className={cn('min-w-0 flex-1 rounded bg-surface px-2.5 py-1.5 text-[13px] tracking-wide')}>
              {state.passwort}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(state.passwort ?? '')
                setKopiert(true)
                setTimeout(() => setKopiert(false), 2000)
              }}
            >
              {kopiert ? <Check size={13} /> : <Copy size={13} />}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
