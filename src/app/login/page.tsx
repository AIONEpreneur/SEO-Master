import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { LoginForm } from './form'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (await getSession()) redirect('/dashboard')

  // Bei einer frisch aufgesetzten Instanz gibt es noch kein Konto – dann
  // direkt zur Einrichtung führen, statt eine leere Anmeldung zu zeigen.
  const hasUsers = (await db.user.count()) > 0
  if (!hasUsers) redirect('/register')

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">SEO-Master</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Sichtbarkeitsanalyse für Websites und Social-Profile
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-[13px] text-ink-muted">
          Noch kein Zugang?{' '}
          <Link href="/register" className="text-brand hover:underline">
            Arbeitsbereich anlegen
          </Link>
        </p>
      </div>
    </main>
  )
}
