import { FolderKanban, ScanSearch } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { ButtonLink, Card, CardHeader, EmptyState, ScoreBadge } from '@/components/ui'
import { ProjectForm } from './form'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const session = await requireSession()
  const projects = await db.project.findMany({
    where: { organizationId: session.organizationId, isArchived: false },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { analyses: true, competitors: true } },
      analyses: {
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { scoreOverall: true, createdAt: true },
      },
    },
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Projekte</h1>
        <p className="mt-0.5 max-w-2xl text-[13px] text-ink-muted">
          Eine Website oder ein Profil, das wiederkehrend geprüft wird. Projekte halten Markt, Sprache und
          Wettbewerber fest, sodass die Werte über die Zeit vergleichbar bleiben.
        </p>
      </header>

      <ProjectForm />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban size={28} />}
            title="Noch kein Projekt"
            description="Analysen laufen auch ohne Projekt – mit Projekt sind die Ergebnisse aber über die Zeit vergleichbar."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold">{project.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-ink-subtle">{project.url}</p>
                </div>
                <ScoreBadge score={project.analyses[0]?.scoreOverall ?? null} size="sm" />
              </div>
              {project.description && (
                <p className="mt-2 text-[13px] text-ink-muted">{project.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <p className="text-[12px] text-ink-subtle">
                  {project._count.analyses} Analysen · {project._count.competitors} Wettbewerber
                  {project.analyses[0] && ` · zuletzt ${project.analyses[0].createdAt.toLocaleDateString('de-DE')}`}
                </p>
                <ButtonLink href="/analyses/new" size="sm" variant="ghost">
                  <ScanSearch size={14} />
                  Analysieren
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
