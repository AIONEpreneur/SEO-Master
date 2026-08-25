import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { availableProviders } from '@/lib/connectors/credentials'
import { verwaltetEigeneZugaenge } from '@/lib/billing/zugaenge'
import { Card } from '@/components/ui'
import { Eye } from 'lucide-react'
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
      {session.nurAnsicht ? (
        // Das Formular gar nicht erst zeigen: Ein Knopf, der beim Drücken
        // abgewiesen wird, ist schlechter als kein Knopf.
        <Card className="flex items-start gap-3 p-5">
          <Eye size={16} className="mt-0.5 shrink-0 text-warn" />
          <div>
            <p className="text-[13px] font-medium">In dieser Ansicht lassen sich keine Läufe starten</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Sie sehen den Arbeitsbereich einer Kundin. Ein Lauf von hier aus würde in ihren Daten landen und
              ihr Kontingent verbrauchen. Zum Ausprobieren gibt es den Vorschau-Bereich unter Betrieb →
              Arbeitsbereiche.
            </p>
          </div>
        </Card>
      ) : (
        <NewAnalysisForm projects={projects} providers={providers} eigeneZugaenge={verwaltetEigeneZugaenge(session)} />
      )}
    </div>
  )
}
