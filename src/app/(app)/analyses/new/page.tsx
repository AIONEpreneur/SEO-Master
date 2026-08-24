import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { availableProviders } from '@/lib/connectors/credentials'
import { NewAnalysisForm } from './form'

export const dynamic = 'force-dynamic'

export default async function NewAnalysisPage() {
  const session = await requireSession()
  const [projects, providers] = await Promise.all([
    db.project.findMany({
      where: { organizationId: session.organizationId, isArchived: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, url: true, locationCode: true, languageCode: true },
    }),
    availableProviders(session.organizationId),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Neue Analyse</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Website-URL oder Social-Profil eingeben. Der Lauf dauert je nach Umfang ein bis fünf Minuten.
        </p>
      </header>
      <NewAnalysisForm projects={projects} providers={providers} />
    </div>
  )
}
