import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { hilfeGueltig } from '@/lib/auth/passwort-hilfe'
import { Card, Funke } from '@/components/ui'
import { NeuesPasswortForm } from './form'

export const dynamic = 'force-dynamic'

export default async function PasswortNeuSeite({ params }: { params: Promise<{ code: string }> }) {
  if (await getSession()) redirect('/dashboard')
  const { code } = await params
  const gueltig = await hilfeGueltig(code)

  return (
    <main className="aussenauftritt relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <Funke size={40} className="twinkle absolute left-[12%] top-[16%]" fill="var(--color-limette)" />
      <Funke size={28} className="twinkle twinkle-2 absolute bottom-[18%] right-[14%]" fill="var(--color-creme)" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-block rounded-full border-2 border-tinte bg-creme px-5 py-2 text-[15px] font-bold shadow-[3px_3px_0_#161616]"
          >
            seo-master
          </Link>
          <h1 className="mt-5 text-[26px]">Neues Passwort</h1>
        </div>

        {gueltig ? (
          <NeuesPasswortForm code={code} />
        ) : (
          <Card className="p-6 text-center">
            <p className="text-[15px] font-bold">Dieser Link gilt nicht mehr</p>
            <p className="mt-2 text-[13px] font-medium text-ink-muted">
              Er war eine Stunde gültig, wurde bereits benutzt oder durch eine neuere Anforderung
              ersetzt.
            </p>
            <Link
              href="/passwort-vergessen"
              className="lift mt-5 inline-block rounded-full border-2 border-tinte bg-tinte px-6 py-3 text-[14px] font-bold text-creme"
            >
              Neuen Link anfordern
            </Link>
          </Card>
        )}
      </div>
    </main>
  )
}
