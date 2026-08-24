import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Card, CardHeader, EmptyState } from '@/components/ui'
import { Receipt } from 'lucide-react'
import { providerLabel } from '@/lib/connectors/labels'

export const dynamic = 'force-dynamic'

export default async function UsagePage() {
  const session = await requireSession()

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const [records, byProvider, organization, analysisCount] = await Promise.all([
    db.usageRecord.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.usageRecord.groupBy({
      by: ['provider'],
      where: { organizationId: session.organizationId, createdAt: { gte: since } },
      _sum: { costCredits: true, units: true },
    }),
    db.organization.findUniqueOrThrow({ where: { id: session.organizationId } }),
    db.analysis.count({ where: { organizationId: session.organizationId, createdAt: { gte: since } } }),
  ])

  const totalCents = byProvider.reduce((sum, entry) => sum + (entry._sum.costCredits ?? 0), 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Verbrauch</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Was die Analysen bei den Anbietern tatsächlich kosten – Grundlage für die spätere Preisgestaltung.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <p className="text-[12px] text-ink-muted">Analysen (30 Tage)</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{analysisCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-ink-muted">API-Kosten (30 Tage)</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{(totalCents / 100).toFixed(2)} $</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-ink-muted">Kosten je Analyse</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {analysisCount > 0 ? `${(totalCents / 100 / analysisCount).toFixed(2)} $` : '–'}
          </p>
        </Card>
      </div>

      {byProvider.length > 0 && (
        <Card>
          <CardHeader title="Nach Anbieter" description="Letzte 30 Tage" />
          <ul className="divide-y divide-border">
            {byProvider.map((entry) => (
              <li key={entry.provider} className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] font-medium">{providerLabel(entry.provider)}</span>
                <span className="text-[13px] tabular-nums text-ink-muted">
                  {entry._sum.units ?? 0} Aufrufe · {((entry._sum.costCredits ?? 0) / 100).toFixed(2)} $
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title="Einzelposten" />
        {records.length === 0 ? (
          <EmptyState
            icon={<Receipt size={28} />}
            title="Noch kein Verbrauch erfasst"
            description="Sobald die erste Analyse mit DataForSEO läuft, erscheinen hier die tatsächlichen Kosten."
          />
        ) : (
          <div className="scroll-x">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-5 py-2 font-medium">Datum</th>
                  <th className="px-3 py-2 font-medium">Anbieter</th>
                  <th className="px-3 py-2 font-medium">Vorgang</th>
                  <th className="px-5 py-2 font-medium">Kosten</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-5 py-2">
                      {record.createdAt.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2">{providerLabel(record.provider)}</td>
                    <td className="px-3 py-2 text-ink-muted">{record.operation}</td>
                    <td className="px-5 py-2 tabular-nums">{(record.costCredits / 100).toFixed(3)} $</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-[13px] font-medium">Tarif: {organization.plan}</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          Guthaben: {organization.credits >= 100000 ? 'unbegrenzt (interner Betrieb)' : organization.credits.toLocaleString('de-DE')}.
          Die Zahlungsanbindung ist noch nicht eingebaut – die Erfassung hier liefert aber bereits die
          Zahlen, um Preise zu kalkulieren.
        </p>
      </Card>
    </div>
  )
}
