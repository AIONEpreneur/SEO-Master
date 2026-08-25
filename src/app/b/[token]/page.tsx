import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { ReportView } from '@/components/report-view'

export const dynamic = 'force-dynamic'

/**
 * Öffentliche Berichtsansicht über den Freigabe-Link.
 *
 * Der Link ist die Berechtigung: Wer ihn hat, darf lesen – wie ein
 * weitergegebenes PDF, nur ohne Anhang. Es gibt hier bewusst keine Anmeldung,
 * keine Navigation und keine Verweise ins Innere der Anwendung; die Seite
 * zeigt genau einen Bericht.
 *
 * Nicht für Suchmaschinen: Ein geteilter Kundenbericht hat im Index nichts
 * verloren.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function GeteilterBericht({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 10) notFound()

  const report = await db.report.findUnique({
    where: { shareToken: token },
    include: { analysis: { select: { targetUrl: true, createdAt: true } } },
  })
  if (!report) notFound()

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <header className="mb-8 border-b border-border pb-6">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-brand">Sichtbarkeitsanalyse</p>
        <h1 className="mt-1.5 break-all text-xl font-semibold tracking-tight">
          {report.analysis.targetUrl}
        </h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Analysiert am{' '}
          {report.analysis.createdAt.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </header>

      <ReportView markdown={report.markdown} />

      <footer className="mt-10 border-t border-border pt-5 text-[12px] text-ink-subtle">
        Erstellt mit SEO-Master. Dieser Bericht wurde über einen Freigabe-Link geteilt.
      </footer>
    </main>
  )
}
