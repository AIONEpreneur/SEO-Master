import type { Metadata } from 'next'
import { getTheme } from '@/lib/theme'
import './globals.css'

export const metadata: Metadata = {
  title: 'SEO-Master — Sichtbarkeitsanalyse',
  description: 'SEO-, AEO-, GEO-, SERP- und Wettbewerbsanalyse für Websites und Social-Profile.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme()

  return (
    // Bei "system" bleibt das Attribut weg – dann entscheidet die
    // Systemeinstellung über die Media Query.
    <html lang="de" data-theme={theme === 'system' ? undefined : theme}>
      <body>{children}</body>
    </html>
  )
}
