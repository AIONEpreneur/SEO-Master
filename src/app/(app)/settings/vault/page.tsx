import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import { verwaltetEigeneZugaenge } from '@/lib/billing/zugaenge'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { VaultManager } from './manager'

export const dynamic = 'force-dynamic'

export default async function VaultPage() {
  const session = await requireSession()
  // Die Seite ist fuer Kundinnen nicht nur unnoetig, sondern gefaehrlich:
  // Eigene Schluessel wuerden die Abrechnung ueber Guthaben aushebeln.
  if (!verwaltetEigeneZugaenge(session)) redirect('/dashboard')

  const credentials = await db.credential.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { provider: 'asc' },
    // Chiffrat und Initialisierungsvektor bleiben auf dem Server.
    select: {
      id: true,
      provider: true,
      label: true,
      hint: true,
      isActive: true,
      lastCheckedAt: true,
      lastCheckOk: true,
      lastCheckError: true,
      lastCheckDetail: true,
      updatedAt: true,
    },
  })

  // Anbieter, die über Server-Umgebungsvariablen versorgt sind – dann muss
  // im Tresor nichts hinterlegt werden.
  const e = env()
  const fromEnv = {
    DATAFORSEO: Boolean(e.DATAFORSEO_LOGIN && e.DATAFORSEO_PASSWORD),
    FIRECRAWL: Boolean(e.FIRECRAWL_API_KEY),
    APIFY: Boolean(e.APIFY_TOKEN),
    ANTHROPIC: Boolean(e.ANTHROPIC_API_KEY),
    PAGESPEED: Boolean(e.PAGESPEED_API_KEY),
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Datentresor</h1>
        <p className="mt-0.5 max-w-2xl text-[13px] text-ink-muted">
          Zugangsdaten der Anbieter. Alle Schlüssel liegen AES-256-verschlüsselt in der Datenbank; der
          Klartext verlässt den Server nicht und wird auch hier nie wieder angezeigt.
        </p>
      </header>
      <VaultManager
        credentials={credentials}
        fromEnv={fromEnv}
        canEdit={session.role === 'OWNER' || session.role === 'ADMIN'}
      />
    </div>
  )
}
