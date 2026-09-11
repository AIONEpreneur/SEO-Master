import Link from 'next/link'
import { ArrowLeft, Lightbulb } from 'lucide-react'
import { requireSuperAdmin } from '@/lib/admin/wache'
import { db } from '@/lib/db'
import { Card, CardHeader, EmptyState } from '@/components/ui'
import { STATUS_LABEL, STATUS_FARBE, STATUS_WERTE } from '@/lib/wuensche'
import { beantworteWunsch } from '@/lib/wuensche/actions'

export const dynamic = 'force-dynamic'

/**
 * Alle Wünsche über alle Arbeitsbereiche.
 *
 * Der einzige Ort, an dem sie zusammenkommen — und der einzige, an dem sich
 * erkennen lässt, was mehrfach gewünscht wird. Anders als in der übrigen
 * Betriebsübersicht steht hier der Name des Bereichs: Eine Antwort ohne zu
 * wissen, wem man antwortet, wäre nicht zu formulieren.
 */
export default async function AdminWuenscheSeite() {
  await requireSuperAdmin()

  const wuensche = await db.wunsch.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      titel: true,
      text: true,
      status: true,
      antwort: true,
      createdAt: true,
      organization: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  })

  const offen = wuensche.filter((w) => w.status === 'OFFEN').length

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={14} />
          Betrieb
        </Link>
        <h1 className="mt-2 text-xl">Wünsche</h1>
        <p className="mt-1 text-[13px] font-medium text-ink-muted">
          {offen === 0
            ? 'Nichts Unbeantwortetes.'
            : `${offen} ${offen === 1 ? 'Wunsch wartet' : 'Wünsche warten'} auf eine Antwort.`}
        </p>
      </header>

      {wuensche.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Lightbulb size={28} />}
            title="Noch kein Wunsch eingegangen"
            description="Sobald jemand etwas einträgt, steht es hier — mit Bereich und Person, damit sich antworten lässt."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title={`${wuensche.length} insgesamt`} />
          <ul className="divide-y-2 divide-border">
            {wuensche.map((w) => (
              <li key={w.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold">{w.titel}</p>
                    <p className="mt-1 text-[13px] font-medium leading-relaxed text-ink-muted">
                      {w.text}
                    </p>
                    <p className="mt-2 text-[12px] font-medium text-ink-subtle">
                      {w.organization.name} · {w.user?.name ?? w.user?.email ?? 'Gelöschtes Konto'} ·{' '}
                      {w.createdAt.toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border-2 border-tinte px-3 py-0.5 text-[11px] font-bold text-tinte ${STATUS_FARBE[w.status]}`}
                  >
                    {STATUS_LABEL[w.status]}
                  </span>
                </div>

                <form action={beantworteWunsch} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={w.id} />
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
                      Antwort
                    </span>
                    <input
                      name="antwort"
                      defaultValue={w.antwort ?? ''}
                      placeholder="Steht beim Wunsch, nicht in einer Mail."
                      className="w-full rounded-xl border-2 border-border bg-surface px-3 py-2 text-[13px] font-medium outline-none focus:outline-2 focus:outline-brand"
                    />
                  </label>
                  <select
                    name="status"
                    defaultValue={w.status}
                    className="rounded-xl border-2 border-border bg-surface px-3 py-2 text-[13px] font-medium"
                  >
                    {STATUS_WERTE.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="lift rounded-full border-2 border-border bg-tinte px-4 py-2 text-[13px] font-bold text-creme"
                  >
                    Speichern
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
