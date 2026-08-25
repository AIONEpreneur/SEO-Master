import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
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

  return (
    <div className="flex min-h-dvh">
      <Sidebar session={session} theme={theme} />
      <div className="relative min-w-0 flex-1 lg:pl-60">
        <AnsichtsBalken session={session} />
        {/*
          Ein sehr schwacher Schein am oberen Rand. Ohne ihn beginnt jede
          Seite mit einer harten Kante zwischen Leiste und Inhalt; mit ihm
          bekommt der Arbeitsbereich denselben Ton wie der Aussenauftritt,
          ohne dass er sich in den Vordergrund drängt.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56"
          style={{
            background:
              'radial-gradient(ellipse 60% 100% at 50% 0%, oklch(56% 0.244 295 / 0.07), transparent 70%)',
          }}
        />
        <main className="relative mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
