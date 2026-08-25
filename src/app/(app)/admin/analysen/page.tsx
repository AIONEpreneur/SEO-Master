import Link from 'next/link'
import { ArrowLeft, EyeOff } from 'lucide-react'
import { requireSuperAdmin } from '@/lib/admin/wache'
import { db } from '@/lib/db'
import { Card, CardHeader, StatusPill } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Läufe über alle Arbeitsbereiche.
 *
 * Bewusst ohne targetUrl, ohne seedKeywords und ohne Ergebnis: Sichtbar ist,
 * DASS geprüft wurde – nicht WAS. Für den Betrieb reicht das: Man erkennt
 * Auslastung, Fehler und Kosten, ohne in fremde Arbeit zu sehen.
 */
export default async function AdminAnalysenSeite() {
  await requireSuperAdmin()

  const laeufe = await db.analysis.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      modules: true,
      targetKind: true,
      creditsUsed: true,
      error: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      organization: { select: { name: true } },
    },
  })

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft size={14} />
          Betrieb
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Läufe</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">Die letzten 100 Läufe über alle Arbeitsbereiche.</p>
      </header>

      <Card className="flex items-start gap-3 border-border bg-surface-muted p-4">
        <EyeOff size={15} className="mt-0.5 shrink-0 text-ink-subtle" />
        <p className="text-[12px] leading-relaxed text-ink-muted">
          Geprüfte Adressen, Suchbegriffe und Ergebnisse stehen hier nicht. Sichtbar ist, dass ein Lauf
          stattgefunden hat, mit welchen Bausteinen und was er gekostet hat.
        </p>
      </Card>

      <Card>
        <CardHeader title={`${laeufe.length} Läufe`} />
        <ul className="divide-y divide-border">
          {laeufe.map((lauf) => {
            const dauer =
              lauf.startedAt && lauf.finishedAt
                ? Math.round((lauf.finishedAt.getTime() - lauf.startedAt.getTime()) / 1000)
                : null
            return (
              <li key={lauf.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{lauf.organization.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-ink-subtle">
                    {lauf.targetKind === 'WEBSITE' ? 'Website' : 'Social-Profil'} · {lauf.modules.join(', ')} ·{' '}
                    {lauf.createdAt.toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {dauer !== null && ` · ${dauer} s`}
                    {lauf.creditsUsed > 0 && ` · ${lauf.creditsUsed} Credits`}
                  </p>
                  {lauf.status === 'FAILED' && lauf.error && (
                    <p className="mt-1 truncate text-[12px] text-bad">{lauf.error}</p>
                  )}
                </div>
                <StatusPill status={lauf.status} />
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
