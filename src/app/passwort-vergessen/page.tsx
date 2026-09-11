import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { kannMailVersenden } from '@/lib/auth/passwort-hilfe'
import { Card, Funke } from '@/components/ui'
import { VergessenForm } from './form'

export const dynamic = 'force-dynamic'

export default async function PasswortVergessenSeite() {
  if (await getSession()) redirect('/dashboard')
  const mailMoeglich = await kannMailVersenden()

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
          <h1 className="mt-5 text-[26px]">Passwort vergessen</h1>
          <p className="mt-3 text-[14px] font-medium">
            Trag deine E-Mail-Adresse ein. Wir schicken dir einen Link zum Neusetzen.
          </p>
        </div>

        {mailMoeglich ? (
          <VergessenForm />
        ) : (
          // Ein Formular, das nichts auslösen kann, wäre eine Täuschung:
          // Ohne Postfach kommt keine Mail an, und die Person wartete
          // vergeblich.
          <Card className="p-5 text-center">
            <p className="text-[14px] font-bold">Der Mail-Versand ist noch nicht eingerichtet.</p>
            <p className="mt-2 text-[13px] font-medium text-ink-muted">
              Bitte wende dich an die Verwaltung — dort lässt sich dein Passwort von Hand
              zurücksetzen.
            </p>
          </Card>
        )}

        <p className="mt-6 text-center text-[14px] font-medium">
          <Link href="/login" className="font-bold underline decoration-2 underline-offset-2">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </main>
  )
}
