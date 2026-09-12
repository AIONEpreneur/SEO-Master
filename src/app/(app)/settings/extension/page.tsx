import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { Card, CardHeader, Button } from '@/components/ui'
import { Lock } from 'lucide-react'
import { aussenzugang, zugangsHinweis } from '@/lib/billing/zugang'
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

  // Trägt das Abo den Zugang von aussen gerade? Die Antwort gehört auf diese
  // Seite, denn hier entstehen die Schlüssel — und ein Schlüssel, der nicht
  // funktioniert, ohne dass irgendwo steht warum, kostet eine Support-Mail.
  const organisation = await db.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { plan: true, aboStatus: true, aboLaeuftBis: true },
  })
  const urteil = aussenzugang(organisation)

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
          Die SEO4U-Extension holt zu jeder besuchten Website die echten Google-Rankings und bringt
          deine SEO-Prompts nach Claude und ChatGPT. Ihre Abfragen laufen über diesen Server und
          weisen sich mit einem persönlichen Zugangsschlüssel aus.
        </p>
      </header>

      {/*
        Dieselbe Einteilung wie im Popup und im Prompt-Panel der Extension.
        Wer die Erweiterung nur von einer Seite kennt — hier oder dort —,
        hält sie sonst für das Ganze und sucht die anderen beiden Teile nie.
      */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Ebene
          nummer={1}
          farbe="bg-orange"
          titel="Im Browser"
          text="Klick auf das SEO4U-Symbol: Rankings jeder Website und Keyword-Recherche, ohne die Seite zu verlassen."
        />
        <Ebene
          nummer={2}
          farbe="bg-limette"
          titel="In Claude & ChatGPT"
          text="Unten rechts ein lila SEO-Knopf: deine Prompt-Bibliothek, schon mit deinem Profil gefüllt."
        />
        <Ebene
          nummer={3}
          farbe="bg-rosa"
          titel="Hier in der App"
          text="Jede Abfrage aus Ebene 1 liegt auch hier — mit Verlauf, Projekten und vollständigen Berichten."
        />
      </div>

      {!urteil.erlaubt && (
        <Card className="flex items-start gap-3 border-2 border-border bg-orange p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-tinte bg-creme">
            <Lock size={16} className="text-tinte" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-tinte">
              Extension und KI-Anbindung ruhen gerade
            </p>
            <p className="mt-1 max-w-2xl text-[13px] font-medium leading-relaxed text-tinte">
              {zugangsHinweis(urteil)} Innerhalb der App ändert sich nichts — Analysen, Recherchen
              und Berichte bleiben da, wo sie sind.
            </p>
          </div>
        </Card>
      )}

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
          <li>In Chrome auf das SEO4U-Symbol klicken und den Reiter „Konto“ öffnen.</li>
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
          (verbraucht Kontingent, wird hier gespeichert). Die Verbindung verlangt eine Anmeldung:
          Beim Einrichten öffnet sich die SEO-Master-Anmeldung, und erst nach deiner Zustimmung
          entsteht ein Zugangsschlüssel — er erscheint anschliessend in der Liste oben und lässt
          sich dort jederzeit widerrufen.
        </p>
        <div className="mt-3 rounded-lg bg-surface-muted px-3 py-2">
          <p className="text-[12px] text-ink-subtle">Connector-Adresse</p>
          <code className="text-[13px]">{`${env().APP_URL}/api/mcp`}</code>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-ink-muted">
          <li>
            <span className="font-medium">Claude:</span> Einstellungen → Connectors → „Eigenen
            Connector hinzufügen“ → diese Adresse einfügen. Claude leitet zur Anmeldung hierher —
            anmelden, „Zugriff erlauben“, fertig.
          </li>
          <li>
            <span className="font-medium">ChatGPT:</span> Einstellungen → Apps &amp; Connectors →
            Entwicklermodus aktivieren → Connector mit dieser Adresse und Authentifizierung „OAuth“
            anlegen — der Anmelde-Fluss läuft genauso.
          </li>
        </ul>
        <p className="mt-2 text-[12px] text-ink-subtle">
          Für Werkzeuge ohne OAuth-Unterstützung gibt es weiter den Weg über die Adresse mit
          eingebautem Schlüssel (wird beim Erzeugen eines Schlüssels angezeigt) — auch dort ist der
          Schlüssel die Anmeldung, nur eben ohne eigenen Anmelde-Dialog.
        </p>
      </Card>
    </div>
  )
}

/** Eine der drei Ebenen — Nummer, Titel, ein Satz. Mehr passt nicht, mehr braucht es nicht. */
function Ebene({
  nummer,
  farbe,
  titel,
  text,
}: {
  nummer: number
  farbe: string
  titel: string
  text: string
}) {
  return (
    <div className={`rounded-2xl border-2 border-border p-5 ${farbe}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-tinte bg-creme font-display text-[13px] text-tinte">
          {nummer}
        </span>
        <p className="font-display text-[14px] uppercase leading-tight text-tinte">{titel}</p>
      </div>
      <p className="mt-2.5 text-[13px] font-medium leading-relaxed text-tinte">{text}</p>
    </div>
  )
}
