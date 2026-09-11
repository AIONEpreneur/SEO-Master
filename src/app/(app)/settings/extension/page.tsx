import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Card, CardHeader, Button } from '@/components/ui'
import { TokenVerwaltung } from './token-verwaltung'
import { widerrufeTokenAction } from './actions'

export const dynamic = 'force-dynamic'

/**
 * Anbindung der Browser-Extension (SEO4U).
 *
 * Die Extension spricht mit /api/ext/* und weist sich mit einem persönlichen
 * Zugangsschlüssel aus. Hier wird er erzeugt und widerrufen – zu sehen sind
 * nur die eigenen Schlüssel, denn der Schlüssel gehört zur Person, nicht zum
 * Arbeitsbereich.
 */
export default async function ExtensionPage() {
  const session = await requireSession()

  const tokens = await db.apiToken.findMany({
    where: { userId: session.id, organizationId: session.organizationId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Browser-Extension</h1>
        <p className="mt-0.5 max-w-2xl text-[13px] text-ink-muted">
          Die SEO4U-Extension zeigt zu jeder besuchten Website die echten Google-Rankings, macht
          Keyword-Recherchen direkt im Browser und bringt die SEO-Prompts nach Claude und ChatGPT.
          Ihre Abfragen laufen über diesen Server und weisen sich mit einem persönlichen
          Zugangsschlüssel aus.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Aktive Zugangsschlüssel"
          description={
            tokens.length === 0
              ? 'Noch keiner erzeugt. Der Schlüssel selbst wird nur einmal, direkt nach dem Erzeugen, angezeigt.'
              : `${tokens.length} ${tokens.length === 1 ? 'Schlüssel' : 'Schlüssel'} für dieses Konto`
          }
        />
        {tokens.length > 0 && (
          <ul className="divide-y divide-border">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{token.name}</p>
                  <p className="truncate text-[12px] text-ink-subtle">
                    Erzeugt am {token.createdAt.toLocaleDateString('de-DE')}
                    {token.lastUsedAt
                      ? ` · zuletzt benutzt ${token.lastUsedAt.toLocaleDateString('de-DE')}`
                      : ' · noch nie benutzt'}
                  </p>
                </div>
                <form action={widerrufeTokenAction}>
                  <input type="hidden" name="id" value={token.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Widerrufen
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <TokenVerwaltung />

      <Card className="p-5">
        <p className="text-[13px] font-medium">So wird die Extension verbunden</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-ink-muted">
          <li>Oben einen Zugangsschlüssel erzeugen und kopieren.</li>
          <li>In Chrome auf das SEO4U-Icon klicken und den Reiter Einstellungen öffnen.</li>
          <li>
            Als Daten-Zugang „SEO-Master-Konto“ wählen, den Schlüssel einfügen und speichern — der
            Knopf „Zugang testen“ bestätigt die Verbindung sofort.
          </li>
        </ol>
      </Card>

      <Card className="p-5">
        <p className="text-[13px] font-medium">Claude und ChatGPT direkt verbinden (MCP)</p>
        <p className="mt-2 text-[13px] text-ink-muted">
          Über das Model Context Protocol greifen die KI-Werkzeuge selbst auf SEO-Master zu:
          gespeicherte Recherchen und Ranking-Abfragen abrufen (kostenlos) oder neue starten
          (verbraucht Kontingent, wird hier gespeichert). Die MCP-Adresse erscheint zusammen mit
          jedem neu erzeugten Schlüssel — sie enthält den Schlüssel und ist deshalb genauso
          vertraulich zu behandeln.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-muted">
          <li>
            <span className="font-medium">Claude:</span> Einstellungen → Connectors → „Eigenen
            Connector hinzufügen“ → die MCP-Adresse einfügen. Danach stehen die SEO-Master-Werkzeuge
            in jedem Chat zur Verfügung.
          </li>
          <li>
            <span className="font-medium">ChatGPT:</span> Einstellungen → Apps &amp; Connectors →
            Entwicklermodus aktivieren → Connector mit der MCP-Adresse anlegen (ohne Authentifizierung —
            der Schlüssel steckt in der Adresse).
          </li>
        </ul>
        <p className="mt-2 text-[12px] text-ink-subtle">
          Ein Widerruf des Schlüssels oben trennt auch diese Verbindung sofort.
        </p>
      </Card>
    </div>
  )
}
