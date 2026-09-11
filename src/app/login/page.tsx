import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { isRegistrationOpen } from '@/lib/auth/actions'
import { db } from '@/lib/db'
import { Funke } from '@/components/ui'
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
    <main className="aussenauftritt relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <Funke size={40} className="twinkle absolute left-[12%] top-[16%]" fill="var(--color-creme)" />
      <Funke size={28} className="twinkle twinkle-2 absolute bottom-[18%] right-[14%]" fill="var(--color-orange)" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-block rounded-full border-2 border-tinte bg-creme px-5 py-2 text-[15px] font-bold shadow-[3px_3px_0_#161616]"
          >
            seo-master
          </Link>
          <p className="mt-4 text-[14px] font-medium">Sichtbarkeit messen, statt sie zu vermuten.</p>
        </div>
        <LoginForm weiter={ziel} />

        <p className="mt-5 text-center text-[14px] font-medium">
          <Link href="/passwort-vergessen" className="font-bold underline decoration-2 underline-offset-2">
            Passwort vergessen?
          </Link>
        </p>

        {registrierungOffen && (
          <p className="mt-3 text-center text-[14px] font-medium">
            Noch kein Zugang?{' '}
            <Link href="/register" className="font-bold underline decoration-2 underline-offset-2">
              Kostenlos anlegen
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
