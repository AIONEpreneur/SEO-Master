import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession, echteSitzung } from '@/lib/auth/session'
import { anzahlUngelesen } from '@/lib/neuigkeiten'
import { getTheme } from '@/lib/theme'
import { Sidebar } from '@/components/sidebar'
import { AnsichtsBalken } from '@/components/ansichts-balken'

export const dynamic = 'force-dynamic'

// Der Arbeitsbereich gehört nicht in den Index – dort stehen ausschliesslich
// Daten der angemeldeten Personen.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const theme = await getTheme()

  // Die Zahl gehört zur angemeldeten Person, nicht zum gezeigten Bereich: In
  // einer Kundensicht wären es sonst deren Neuigkeiten — und weggeklickt
  // würden sie auf dem falschen Konto.
  const konto = await echteSitzung()
  const ungelesen = konto ? await anzahlUngelesen(konto) : 0

  return (
    <div className="flex min-h-dvh">
      <Sidebar session={session} theme={theme} ungeleseneNeuigkeiten={ungelesen} />
      <div className="relative min-w-0 flex-1 lg:pl-60">
        <AnsichtsBalken session={session} />
        <main className="relative mx-auto max-w-6xl px-4 pb-10 pt-20 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
