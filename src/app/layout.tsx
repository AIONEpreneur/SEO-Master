import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SEO-Master — Sichtbarkeitsanalyse',
  description: 'SEO-, AEO-, GEO-, SERP- und Wettbewerbsanalyse für Websites und Social-Profile.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
