import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Lock } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { isRegistrationOpen } from '@/lib/auth/actions'
import { db } from '@/lib/db'
import { Card } from '@/components/ui'
import { RegisterForm } from './form'

export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  if (await getSession()) redirect('/dashboard')
  const isFirstUser = (await db.user.count()) === 0

  // Ist die Registrierung geschlossen, wird gar kein Formular gezeigt – ein
  // Formular, das jede Eingabe abweist, ist nur irreführend.
  if (!(await isRegistrationOpen())) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <Card className="p-6">
            <Lock size={20} className="mx-auto mb-3 text-ink-subtle" />
            <p className="text-sm font-medium">Registrierung geschlossen</p>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              Auf dieser Instanz können keine neuen Arbeitsbereiche angelegt werden.
            </p>
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

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            {isFirstUser ? 'SEO-Master einrichten' : 'Arbeitsbereich anlegen'}
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            {isFirstUser
              ? 'Erstes Konto anlegen – es erhält die Verwaltungsrechte dieser Instanz.'
              : 'Eigener Arbeitsbereich mit getrennten Daten und eigenem Datentresor.'}
          </p>
        </div>
        <RegisterForm />
        {!isFirstUser && (
          <p className="mt-6 text-center text-[13px] text-ink-muted">
            Bereits registriert?{' '}
            <Link href="/login" className="text-brand hover:underline">
              Anmelden
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
