import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Lock, MailCheck } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { pruefeEinladung, FEHLERTEXTE } from '@/lib/auth/einladungen'
import { Card } from '@/components/ui'
import { EinladungsForm } from './form'

export const dynamic = 'force-dynamic'

export default async function EinladungsSeite({ params }: { params: Promise<{ code: string }> }) {
  if (await getSession()) redirect('/dashboard')

  const { code } = await params
  const { fehler, einladung } = await pruefeEinladung(code)

  if (fehler || !einladung) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <Card className="p-6">
            <Lock size={20} className="mx-auto mb-3 text-ink-subtle" />
            <p className="text-sm font-medium">Einladung nicht gültig</p>
            <p className="mt-1.5 text-[13px] text-ink-muted">{FEHLERTEXTE[fehler ?? 'unbekannt']}</p>
          </Card>
          <p className="mt-6 text-[13px] text-ink-muted">
            <Link href="/login" className="text-brand hover:underline">
              Zur Anmeldung
            </Link>
          </p>
        </div>
      </main>
    )
  }

  const eigenerBereich = einladung.organizationId === null

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <MailCheck size={22} className="mx-auto mb-3 text-brand" />
          <h1 className="text-lg font-semibold tracking-tight">Willkommen bei SEO-Master</h1>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            {eigenerBereich
              ? 'Sie richten hier Ihren eigenen Arbeitsbereich ein. Nur Sie sehen, was darin entsteht.'
              : `Sie wurden in den Arbeitsbereich „${einladung.organization?.name ?? ''}" eingeladen.`}
          </p>
        </div>

        <Card className="p-6">
          <EinladungsForm code={code} email={einladung.email} />
        </Card>

        <p className="mt-6 text-center text-[13px] text-ink-muted">
          Schon ein Konto?{' '}
          <Link href="/login" className="text-brand hover:underline">
            Anmelden
          </Link>
        </p>
      </div>
    </main>
  )
}
