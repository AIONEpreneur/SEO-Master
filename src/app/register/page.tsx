import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { RegisterForm } from './form'

export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  if (await getSession()) redirect('/dashboard')
  const isFirstUser = (await db.user.count()) === 0

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
