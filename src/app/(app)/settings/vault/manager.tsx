'use client'

import { useActionState, useState } from 'react'
import { CheckCircle2, XCircle, Trash2, ShieldCheck, Server } from 'lucide-react'
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
    role: 'Gezählte Suchdaten',
    purpose:
      'Die einzige Quelle, die zählt statt zu schätzen: tatsächliche Klicks, Einblendungen und Positionen je Suchanfrage. Alle anderen Anbieter rechnen hoch — auf einer echten Seite standen 35 geschätzten Besuchen 277 gezählte gegenüber.',
    required: false,
    fields: 'serviceAccount',
    docs: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
    hint: 'Den vollständigen Inhalt der JSON-Datei des Dienstkontos einfügen. Danach in der Search Console unter Einstellungen › Nutzer und Berechtigungen die E-Mail-Adresse des Dienstkontos als Nutzerin hinzufügen — sonst ist das Konto gültig, sieht aber nichts. Schritt-für-Schritt-Anleitung: deploy/search-console.md im Projekt.',
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

export function VaultManager({
  credentials,
  fromEnv,
  canEdit,
}: {
  credentials: Credential[]
  fromEnv: Record<string, boolean>
  canEdit: boolean
}) {
  const [state, action, pending] = useActionState<VaultState, FormData>(saveCredentialAction, {})
  const [open, setOpen] = useState<Provider | null>(null)

  return (
    <div className="space-y-4">
      {state.success && (
        <p className="rounded-lg bg-good-subtle px-4 py-3 text-[13px] text-good">{state.success}</p>
      )}
      {state.error && <p className="rounded-lg bg-bad-subtle px-4 py-3 text-[13px] text-bad">{state.error}</p>}

      {PROVIDERS.map((provider) => {
        const stored = credentials.find((c) => c.provider === provider.key)
        const viaEnv = fromEnv[provider.key] && !stored
        const configured = Boolean(stored) || viaEnv
        const isOpen = open === provider.key

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
                    {isOpen ? 'Abbrechen' : configured ? 'Ersetzen' : 'Eintragen'}
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
      })}
    </div>
  )
}
