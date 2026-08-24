import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getTheme } from '@/lib/theme'
import { Sidebar } from '@/components/sidebar'

export const dynamic = 'force-dynamic'

// Der Arbeitsbereich gehört nicht in den Index – dort stehen ausschliesslich
// Daten der angemeldeten Personen.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const theme = await getTheme()

  return (
    <div className="flex min-h-dvh">
      <Sidebar session={session} theme={theme} />
      <div className="min-w-0 flex-1 lg:pl-60">
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
