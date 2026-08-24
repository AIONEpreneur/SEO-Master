import { Swords, Trash2 } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Card, CardHeader, Button, Input, EmptyState } from '@/components/ui'
import { addCompetitorAction, removeCompetitorAction } from '@/lib/analysis/actions'

export const dynamic = 'force-dynamic'

export default async function CompetitorsPage() {
  const session = await requireSession()
  const projects = await db.project.findMany({
    where: { organizationId: session.organizationId, isArchived: false, kind: 'WEBSITE' },
    orderBy: { name: 'asc' },
    include: { competitors: { orderBy: { createdAt: 'asc' } } },
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Wettbewerb</h1>
        <p className="mt-0.5 max-w-2xl text-[13px] text-ink-muted">
          Feste Wettbewerber je Projekt. Sind hier welche hinterlegt, vergleicht die Analyse gegen genau
          diese – sonst bestimmt sie sie automatisch aus den Suchergebnissen.
        </p>
      </header>

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Swords size={28} />}
            title="Noch kein Projekt vorhanden"
            description="Wettbewerber werden einem Projekt zugeordnet. Zuerst ein Projekt anlegen."
          />
        </Card>
      ) : (
        projects.map((project) => (
          <Card key={project.id}>
            <CardHeader title={project.name} description={project.url} />
            {project.competitors.length > 0 && (
              <ul className="divide-y divide-border">
                {project.competitors.map((competitor) => (
                  <li key={competitor.id} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium">{competitor.domain}</p>
                      {competitor.isAuto && (
                        <p className="text-[12px] text-ink-subtle">Automatisch gefunden</p>
                      )}
                    </div>
                    <form action={removeCompetitorAction}>
                      <input type="hidden" name="id" value={competitor.id} />
                      <Button size="sm" variant="ghost" type="submit" aria-label="Entfernen">
                        <Trash2 size={14} />
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={addCompetitorAction} className="flex gap-2 border-t border-border p-4">
              <input type="hidden" name="projectId" value={project.id} />
              <Input name="url" placeholder="wettbewerber.de" required className="flex-1" />
              <Button size="sm" variant="secondary" type="submit">
                Hinzufügen
              </Button>
            </form>
          </Card>
        ))
      )}
    </div>
  )
}
