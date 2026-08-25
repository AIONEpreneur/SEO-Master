'use client'

import { useActionState, useState } from 'react'
import { CheckCircle2, XCircle, Trash2, ShieldCheck, Server, AlertTriangle } from 'lucide-react'
import { saveCredentialAction, deleteCredentialAction, testCredentialAction, type VaultState } from '@/lib/connectors/vault-actions'
import { Button, Card, CardHeader, Input, Label } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import type { Provider } from '@prisma/client'

type Credential = {
  id: string
  provider: Provider
  label: string
  hint: string | null
  isActive: boolean
  lastCheckedAt: Date | null
  lastCheckOk: boolean | null
  lastCheckError: string | null
  lastCheckDetail: string | null
  updatedAt: Date
}

const PROVIDERS: Array<{
  key: Provider
  name: string
  role: string
  purpose: string
  required: boolean
  fields: 'login' | 'apiKey' | 'serviceAccount'
  docs: string
  hint: string
}> = [
  {
    key: 'DATAFORSEO',
    name: 'DataForSEO',
    role: 'Suchmaschinendaten',
    purpose:
      'Platzierungen, SERP-Elemente, Keyword-Daten, Backlinks, Wettbewerbervergleich und LLM-Sichtbarkeit. Ohne diesen Anbieter entfallen SERP- und Wettbewerbsanalyse vollständig.',
    required: true,
    fields: 'login',
    docs: 'https://app.dataforseo.com/api-access',
    hint: 'Login ist die E-Mail-Adresse des Kontos. Als Passwort das API-Passwort aus dem Dashboard eintragen – nicht das Anmeldepasswort. Im Dashboard stehen zwei Zeichenfolgen: die kürzere ist das API-Passwort, die längere darunter enthält beides in kodierter Form (funktioniert hier ebenfalls).',
  },
  {
    key: 'FIRECRAWL',
    name: 'Firecrawl',
    role: 'Seiteninhalt',
    purpose:
      'Lädt Seiten mit ausgeführtem JavaScript. Nötig, um zu messen, wie viel Inhalt ein einfacher Crawler sieht – und damit auch KI-Systeme.',
    required: true,
    fields: 'apiKey',
    docs: 'https://www.firecrawl.dev/app/api-keys',
    hint: 'Schlüssel beginnt mit fc-.',
  },
  {
    key: 'ANTHROPIC',
    name: 'Anthropic',
    role: 'Berichtstext',
    purpose:
      'Formuliert aus den Messwerten den ausgearbeiteten Bericht. Ohne diesen Schlüssel entsteht der Bericht rein aus den Daten – vollständig, aber ohne einordnende Passagen.',
    required: true,
    fields: 'apiKey',
    docs: 'https://console.anthropic.com/settings/keys',
    hint: 'Schlüssel beginnt mit sk-ant-.',
  },
  {
    key: 'SEARCH_CONSOLE',
    name: 'Google Search Console',
    role: 'Nur für eigene Seiten',
    purpose:
      'Ersetzt Hochrechnungen durch gezählte Klicks — aber nur für Seiten, für die man selbst freigeschaltet ist. Ohne diese Verbindung läuft jede Analyse vollständig durch, mit geschätzten Werten statt gezählten.',
    required: false,
    fields: 'serviceAccount',
    docs: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
    hint: 'Nur für den technischen Weg über ein Dienstkonto: den vollständigen Inhalt der JSON-Datei einfügen. Danach muss die E-Mail-Adresse des Dienstkontos in der Search Console unter Einstellungen › Nutzer und Berechtigungen eingetragen werden. Der Knopf oben ist der einfachere Weg.',
  },
  {
    key: 'APIFY',
    name: 'Apify',
    role: 'Social-Profile',
    purpose:
      'Profildaten von Instagram, LinkedIn, TikTok, YouTube, Facebook und X. Nur für die Analyse von Social-Profilen nötig.',
    required: false,
    fields: 'apiKey',
    docs: 'https://console.apify.com/settings/integrations',
    hint: 'Persönliches API-Token aus den Kontoeinstellungen.',
  },
  {
    key: 'PAGESPEED',
    name: 'PageSpeed Insights',
    role: 'Ladegeschwindigkeit',
    purpose:
      'Core Web Vitals aus Labor- und Felddaten. Funktioniert auch ohne Schlüssel, dann aber mit engem Kontingent.',
    required: false,
    fields: 'apiKey',
    docs: 'https://developers.google.com/speed/docs/insights/v5/get-started',
    hint: 'Kostenloser Google-API-Schlüssel. Optional, hebt nur das Anfragelimit.',
  },
]

/**
 * Rückmeldungen vom Umweg über Google.
 *
 * Sie kommen als Parameter in der Adresse zurück, weil der Rückweg von einer
 * fremden Seite ausgeht und dort kein Formularzustand überlebt.
 */
const GOOGLE_MELDUNGEN: Record<string, { text: string; art: 'gut' | 'warn' | 'schlecht' }> = {
  verbunden: { text: 'Google-Konto verbunden. Die verbundenen Properties stehen unten.', art: 'gut' },
  'ohne-property': {
    text: 'Die Verbindung steht, aber dieses Google-Konto ist in der Search Console für keine Website eingetragen. Search Console zeigt nur Seiten, für die man selbst freigeschaltet ist.',
    art: 'warn',
  },
  abgebrochen: { text: 'Die Anmeldung wurde abgebrochen. Es wurde nichts gespeichert.', art: 'warn' },
  'nicht-eingerichtet': {
    text: 'Auf diesem Server ist noch kein Google-Zugang eingerichtet. Bis dahin funktioniert der Weg über ein Dienstkonto.',
    art: 'warn',
  },
  ungueltig: { text: 'Der Rückweg von Google war nicht mehr gültig. Bitte erneut versuchen.', art: 'schlecht' },
  unvollstaendig: { text: 'Google hat unvollständig geantwortet. Bitte erneut versuchen.', art: 'schlecht' },
  fehlgeschlagen: { text: 'Die Verbindung ist fehlgeschlagen. Bitte erneut versuchen.', art: 'schlecht' },
}

export function VaultManager({
  credentials,
  fromEnv,
  canEdit,
  googleBereit,
  googleMeldung,
}: {
  credentials: Credential[]
  fromEnv: Record<string, boolean>
  canEdit: boolean
  /** Ist der Anmelde-Knopf auf diesem Server eingerichtet? */
  googleBereit: boolean
  googleMeldung?: string
}) {
  const [state, action, pending] = useActionState<VaultState, FormData>(saveCredentialAction, {})
  const [open, setOpen] = useState<Provider | null>(null)
  const meldung = googleMeldung ? GOOGLE_MELDUNGEN[googleMeldung] : null

  return (
    <div className="space-y-4">
      {meldung && (
        <p
          className={cn(
            'rounded-lg px-4 py-3 text-[13px]',
            meldung.art === 'gut' && 'bg-good-subtle text-good',
            meldung.art === 'warn' && 'bg-warn-subtle text-warn',
            meldung.art === 'schlecht' && 'bg-bad-subtle text-bad',
          )}
        >
          {meldung.text}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-good-subtle px-4 py-3 text-[13px] text-good">{state.success}</p>
      )}
      {state.error && <p className="rounded-lg bg-bad-subtle px-4 py-3 text-[13px] text-bad">{state.error}</p>}

      {/*
        Die Trennung ist keine Kosmetik. Vorher standen alle sechs Anbieter
        in einer Reihe, und wer den Tresor zum ersten Mal öffnete, sah sechs
        Einrichtungsschritte. Tatsächlich sind es drei; der Rest erweitert die
        Analyse, ohne dass ohne ihn etwas fehlschlägt. Diese Unterscheidung ist
        das Erste, was jemand hier verstehen muss.
      */}
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight">Nötig für jede Analyse</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Drei Zugänge. Ohne sie fehlen der Analyse die Grundlagen.
        </p>
      </div>

      {PROVIDERS.filter((p) => p.required).map((provider) => {
        const stored = credentials.find((c) => c.provider === provider.key)
        const viaEnv = fromEnv[provider.key] && !stored
        const configured = Boolean(stored) || viaEnv
        const isOpen = open === provider.key

        return (
          <ProviderKarte
            key={provider.key}
            provider={provider}
            stored={stored}
            viaEnv={viaEnv}
            configured={configured}
            isOpen={isOpen}
            setOpen={setOpen}
            canEdit={canEdit}
            googleBereit={googleBereit}
            action={action}
            pending={pending}
          />
        )
      })}

      <div className="pt-2">
        <h2 className="text-[13px] font-semibold tracking-tight">Zusätzlich, wenn vorhanden</h2>
        <p className="mt-0.5 max-w-2xl text-[13px] text-ink-muted">
          Erweitern die Analyse um Bereiche, die ohne sie entfallen. Jede Analyse läuft auch
          ohne sie vollständig durch und weist im Bericht aus, was nicht erhoben wurde.
        </p>
      </div>

      {PROVIDERS.filter((p) => !p.required).map((provider) => {
        const stored = credentials.find((c) => c.provider === provider.key)
        const viaEnv = fromEnv[provider.key] && !stored
        const configured = Boolean(stored) || viaEnv
        const isOpen = open === provider.key

        return (
          <ProviderKarte
            key={provider.key}
            provider={provider}
            stored={stored}
            viaEnv={viaEnv}
            configured={configured}
            isOpen={isOpen}
            setOpen={setOpen}
            canEdit={canEdit}
            googleBereit={googleBereit}
            action={action}
            pending={pending}
          />
        )
      })}
    </div>
  )
}


/**
 * Eine Anbieterkarte.
 *
 * Herausgezogen, weil sie in zwei Gruppen erscheint – nötige und zusätzliche
 * Zugänge. Zweimal derselbe Rumpf im Formular wäre dieselbe Karte mit zwei
 * Schicksalen; jede Änderung müsste man an beiden Stellen machen und würde
 * es irgendwann an einer vergessen.
 */
function ProviderKarte({
  provider,
  stored,
  viaEnv,
  configured,
  isOpen,
  setOpen,
  canEdit,
  googleBereit,
  action,
  pending,
}: {
  provider: (typeof PROVIDERS)[number]
  stored: Credential | undefined
  viaEnv: boolean
  configured: boolean
  isOpen: boolean
  setOpen: (p: Provider | null) => void
  canEdit: boolean
  googleBereit: boolean
  action: (formData: FormData) => void
  pending: boolean
}) {
  return (
          <Card key={provider.key}>
            <CardHeader
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {provider.name}
                  <span className="text-[12px] font-normal text-ink-subtle">{provider.role}</span>
                  {provider.required && !configured && (
                    <span className="rounded-full bg-warn-subtle px-2 py-0.5 text-[11px] font-medium text-warn">
                      Erforderlich
                    </span>
                  )}
                  {configured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-good-subtle px-2 py-0.5 text-[11px] font-medium text-good">
                      {viaEnv ? <Server size={11} /> : <ShieldCheck size={11} />}
                      {viaEnv ? 'Server-Konfiguration' : 'Im Tresor'}
                    </span>
                  )}
                </span>
              }
              description={provider.purpose}
              action={
                canEdit ? (
                  <Button size="sm" variant={configured ? 'ghost' : 'secondary'} onClick={() => setOpen(isOpen ? null : provider.key)}>
                    {isOpen
                      ? 'Abbrechen'
                      : provider.key === 'SEARCH_CONSOLE'
                        ? 'Dienstkonto'
                        : configured
                          ? 'Ersetzen'
                          : 'Eintragen'}
                  </Button>
                ) : null
              }
            />

            {stored && (
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 text-[13px]">
                <code className="rounded bg-surface-muted px-2 py-1 text-[12px]">{stored.hint}</code>
                {stored.lastCheckedAt && (
                  <span className={cn('inline-flex items-center gap-1.5', stored.lastCheckOk ? 'text-good' : 'text-bad')}>
                    {stored.lastCheckOk ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {stored.lastCheckOk
                      ? `Geprüft am ${stored.lastCheckedAt.toLocaleDateString('de-DE')}`
                      : `Prüfung fehlgeschlagen: ${stored.lastCheckError}`}
                  </span>
                )}
                {canEdit && (
                  <div className="ml-auto flex gap-2">
                    <form action={testCredentialAction}>
                      <input type="hidden" name="provider" value={provider.key} />
                      <Button size="sm" variant="secondary" type="submit">
                        Prüfen
                      </Button>
                    </form>
                    <form action={deleteCredentialAction}>
                      <input type="hidden" name="id" value={stored.id} />
                      <Button size="sm" variant="ghost" type="submit" aria-label="Löschen">
                        <Trash2 size={14} />
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/*
              Was die Prüfung ergeben hat – bei Search Console die Liste der
              verbundenen Properties. Ohne sie ist nicht erkennbar, für welche
              Seiten gezählte Daten vorliegen: Search Console kennt
              ausschliesslich eigene Properties, für fremde Seiten gibt es
              diese Zahlen nicht.
            */}
            {stored?.lastCheckOk && stored.lastCheckDetail && (
              <div className="border-b border-border px-5 py-3">
                <p className="text-[12px] text-ink-muted">
                  <span className="font-medium text-ink">Verbunden:</span> {stored.lastCheckDetail}
                </p>
              </div>
            )}

            {/*
              Der einfache Weg zuerst. Ein Knopf, ein Google-Fenster, fertig –
              das kennt jede von anderen Diensten. Der Weg über ein
              Dienstkonto bleibt daneben bestehen, weil er für die eigene
              Installation weniger Voraussetzungen hat.
            */}
            {provider.key === 'SEARCH_CONSOLE' && canEdit && (
              <div className="border-b border-border p-5">
                {googleBereit ? (
                  <>
                    <a
                      href="/api/google/connect"
                      className="inline-flex h-10 items-center gap-2.5 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
                        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"/>
                        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.700-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"/>
                        <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z"/>
                        <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/>
                      </svg>
                      {configured ? 'Anderes Google-Konto verbinden' : 'Mit Google verbinden'}
                    </a>
                    <p className="mt-2.5 text-[12px] text-ink-subtle">
                      Google fragt einmal nach Zustimmung. Gelesen wird ausschliesslich die Search
                      Console, nichts anderes. Der Zugriff lässt sich jederzeit hier oder im
                      Google-Konto zurücknehmen.
                    </p>
                    {/*
                      Solange Google die Anwendung nicht geprüft hat, erscheint ein
                      Warnbildschirm. Er lässt sich nicht abschalten – aber unangekündigt
                      wirkt er wie ein Sicherheitsproblem, angekündigt wie eine Formalie.
                    */}
                    <div className="mt-3 flex gap-2.5 rounded-lg border border-warn/30 bg-warn-subtle px-3 py-2.5">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
                      <p className="text-[12px] leading-relaxed text-ink-muted">
                        <span className="font-medium text-ink">Google zeigt gleich einen Warnhinweis</span>{' '}
                        („Diese App wurde nicht von Google überprüft"). Das ist erwartbar, solange
                        die Prüfung durch Google noch aussteht — nicht Anzeichen eines Problems.
                        Weiter geht es über <span className="font-medium">Erweitert</span> →{' '}
                        <span className="font-medium">Weiter zu SEO-Master</span>.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-[12px] text-ink-subtle">
                    Der Anmelde-Knopf ist auf diesem Server noch nicht eingerichtet. Bis dahin
                    funktioniert der Weg über ein Dienstkonto unten.
                  </p>
                )}
              </div>
            )}

            {isOpen && (
              <form action={action} className="space-y-4 p-5">
                <input type="hidden" name="provider" value={provider.key} />
                <input type="hidden" name="label" value="Standard" />

                {provider.fields === 'login' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`${provider.key}-login`}>Login</Label>
                      <Input id={`${provider.key}-login`} name="login" required autoComplete="off" />
                    </div>
                    <div>
                      <Label htmlFor={`${provider.key}-password`}>API-Passwort</Label>
                      <Input id={`${provider.key}-password`} name="password" type="password" required autoComplete="off" />
                    </div>
                  </div>
                ) : provider.fields === 'serviceAccount' ? (
                  <div>
                    <Label htmlFor={`${provider.key}-json`}>Inhalt der JSON-Datei</Label>
                    {/*
                      Mehrzeiliges Feld statt Passwortfeld: Der Schlüssel ist
                      rund zweitausend Zeichen lang und enthält Zeilenumbrüche.
                      In einem einzeiligen Feld liesse sich nicht erkennen, ob
                      der Inhalt vollständig angekommen ist.
                    */}
                    <textarea
                      id={`${provider.key}-json`}
                      name="serviceAccount"
                      required
                      rows={6}
                      spellCheck={false}
                      autoComplete="off"
                      placeholder={'{\n  "type": "service_account",\n  "project_id": "…",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n…",\n  "client_email": "…@….iam.gserviceaccount.com"\n}'}
                      className="mt-1.5 w-full rounded-lg border border-border bg-canvas px-3 py-2.5 font-mono text-[12px] leading-relaxed outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor={`${provider.key}-key`}>API-Schlüssel</Label>
                    <Input id={`${provider.key}-key`} name="apiKey" type="password" required autoComplete="off" />
                  </div>
                )}

                <p className="text-[12px] text-ink-subtle">
                  {provider.hint}{' '}
                  <a href={provider.docs} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                    Zum Anbieter
                  </a>
                </p>

                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? 'Wird gespeichert…' : 'Verschlüsselt speichern'}
                </Button>
              </form>
            )}
          </Card>
  )
}
