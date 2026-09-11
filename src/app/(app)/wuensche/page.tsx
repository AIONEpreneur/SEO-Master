import { Lightbulb } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Card, CardHeader, EmptyState } from '@/components/ui'
import { STATUS_LABEL, STATUS_FARBE, STATUS_ERKLAERUNG } from '@/lib/wuensche'
import { ziehWunschZurueck } from '@/lib/wuensche/actions'
import { WunschForm } from './form'

export const dynamic = 'force-dynamic'

/**
 * Wünsche für künftige Funktionen.
 *
 * Sichtbar sind die des eigenen Arbeitsbereichs, nicht die anderer Kundinnen:
 * Ein Wunsch verrät, woran jemand arbeitet und was ihm fehlt.
 */
export default async function WuenscheSeite() {
  const session = await requireSession()

  const wuensche = await db.wunsch.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      titel: true,
      text: true,
      status: true,
      antwort: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true, email: true } },
    },
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl">Wünsche</h1>
        <p className="mt-1 max-w-2xl text-[13px] font-medium text-ink-muted">
          Was fehlt dir? Trag es hier ein. Jeder Wunsch bekommt einen Stand — du siehst also, ob
          daran gearbeitet wird, und wenn nicht, warum nicht.
        </p>
      </header>

      {!session.nurAnsicht && <WunschForm />}

      {wuensche.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Lightbulb size={28} />}
            title="Noch kein Wunsch"
            description="Auch Kleinigkeiten zählen — eine Spalte, die fehlt, ein Wort, das verwirrt, ein Weg, der zu lang ist."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title={`${wuensche.length} ${wuensche.length === 1 ? 'Wunsch' : 'Wünsche'}`} />
          <ul className="divide-y-2 divide-border">
            {wuensche.map((w) => (
              <li key={w.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold">{w.titel}</p>
                    <p className="mt-1 text-[13px] font-medium leading-relaxed text-ink-muted">
                      {w.text}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border-2 border-tinte px-3 py-0.5 text-[11px] font-bold text-tinte ${STATUS_FARBE[w.status]}`}
                    title={STATUS_ERKLAERUNG[w.status]}
                  >
                    {STATUS_LABEL[w.status]}
                  </span>
                </div>

                {w.antwort && (
                  <p className="mt-3 rounded-xl border-2 border-border bg-surface-muted px-3.5 py-2.5 text-[13px] font-medium">
                    <span className="font-bold">Antwort: </span>
                    {w.antwort}
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12px] font-medium text-ink-subtle">
                  <span>
                    {w.user?.name ?? w.user?.email ?? 'Gelöschtes Konto'} ·{' '}
                    {w.createdAt.toLocaleDateString('de-DE')}
                  </span>
                  {/* Zurückziehen nur, solange nichts entschieden ist — und nur
                      den eigenen. Was geplant oder umgesetzt ist, gehört zur
                      Geschichte dieser Anwendung. */}
                  {w.status === 'OFFEN' && w.userId === session.id && !session.nurAnsicht && (
                    <form action={ziehWunschZurueck}>
                      <input type="hidden" name="id" value={w.id} />
                      <button type="submit" className="underline hover:text-brand">
                        Zurückziehen
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
