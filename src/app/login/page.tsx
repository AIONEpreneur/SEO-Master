import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { isRegistrationOpen } from '@/lib/auth/actions'
import { db } from '@/lib/db'
import { LoginForm } from './form'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>
}) {
  const { weiter } = await searchParams
  // Nur eigene, relative Pfade – sonst wäre die Anmeldung ein offener
  // Umleiter auf fremde Seiten.
  const ziel = weiter?.startsWith('/') && !weiter.startsWith('//') ? weiter : undefined
  if (await getSession()) redirect(ziel ?? '/dashboard')

  // Bei einer frisch aufgesetzten Instanz gibt es noch kein Konto – dann
  // direkt zur Einrichtung führen, statt eine leere Anmeldung zu zeigen.
  const hasUsers = (await db.user.count()) > 0
  if (!hasUsers) redirect('/register')

  const registrierungOffen = await isRegistrationOpen()

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">SEO-Master</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Sichtbarkeitsanalyse für Websites und Social-Profile
          </p>
        </div>
        <LoginForm weiter={ziel} />
        {registrierungOffen && (
          <p className="mt-6 text-center text-[13px] text-ink-muted">
            Noch kein Zugang?{' '}
            <Link href="/register" className="text-brand hover:underline">
              Arbeitsbereich anlegen
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
