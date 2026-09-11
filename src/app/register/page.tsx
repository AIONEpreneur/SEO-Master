import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Lock } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { isRegistrationOpen } from '@/lib/auth/actions'
import { db } from '@/lib/db'
import { Card, Funke } from '@/components/ui'
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
    <main className="aussenauftritt relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <Funke size={40} className="twinkle absolute left-[12%] top-[16%]" fill="var(--color-limette)" />
      <Funke size={28} className="twinkle twinkle-2 absolute bottom-[18%] right-[14%]" fill="var(--color-creme)" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border-2 border-tinte bg-orange px-4 py-1.5 text-[13px] font-bold">
            {isFirstUser ? 'Einrichtung' : 'Kostenlos & ohne Zahldaten'}
          </span>
          <h1 className="mt-4 text-[28px]">
            {isFirstUser ? 'SEO-Master einrichten' : 'Arbeitsbereich anlegen'}
          </h1>
          <p className="mt-3 text-[14px] font-medium">
            {isFirstUser
              ? 'Erstes Konto anlegen – es erhält die Verwaltungsrechte dieser Instanz.'
              : 'Eigener Arbeitsbereich mit getrennten Daten. In Ruhe umschauen, nichts wird fällig.'}
          </p>
        </div>
        <RegisterForm />
        {!isFirstUser && (
          <p className="mt-6 text-center text-[14px] font-medium">
            Bereits registriert?{' '}
            <Link href="/login" className="font-bold underline decoration-2 underline-offset-2">
              Anmelden
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
