'use client'

import { useActionState, useState } from 'react'
import { Globe, Search, Bot, Sparkles, Swords, Info, BarChart3 } from 'lucide-react'
import { startAnalysisAction, type StartState } from '@/lib/analysis/actions'
import { Button, Card, CardHeader, Input, Label, Select } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import type { Provider } from '@prisma/client'

type Project = { id: string; name: string; url: string; locationCode: number; languageCode: string }

const MODULES = [
  {
    key: 'SEO',
    label: 'SEO',
    description: 'Technik, Inhalt, Keywords, E-E-A-T',
    icon: Search,
    requires: [] as Provider[],
  },
  {
    key: 'AEO',
    label: 'AEO',
    description: 'Antwortboxen, FAQ-Struktur, Sprachsuche',
    icon: Bot,
    requires: [] as Provider[],
  },
  {
    key: 'GEO',
    label: 'GEO',
    description: 'Sichtbarkeit in ChatGPT, Perplexity & Co.',
    icon: Sparkles,
    requires: [] as Provider[],
  },
  {
    key: 'SERP',
    label: 'SERP',
    description: 'Tatsächliche Platzierungen und SERP-Elemente',
    icon: Globe,
    requires: ['DATAFORSEO'] as Provider[],
  },
  {
    key: 'SEARCH_CONSOLE',
    label: 'Search Console',
    description: 'Echte Klicks statt Schätzungen',
    icon: BarChart3,
    requires: ['SEARCH_CONSOLE'] as Provider[],
  },
  {
    key: 'COMPETITORS',
    label: 'Wettbewerb',
    description: 'Vergleich und Keyword-Lücken',
    icon: Swords,
    requires: ['DATAFORSEO'] as Provider[],
  },
]

const MARKETS = [
  { code: 2276, label: 'Deutschland', language: 'de' },
  { code: 2040, label: 'Österreich', language: 'de' },
  { code: 2756, label: 'Schweiz', language: 'de' },
  { code: 2826, label: 'Vereinigtes Königreich', language: 'en' },
  { code: 2840, label: 'USA', language: 'en' },
]

export function NewAnalysisForm({
  projects,
  providers,
}: {
  projects: Project[]
  providers: Record<Provider, boolean>
}) {
  const [state, action, pending] = useActionState<StartState, FormData>(startAnalysisAction, {})
  const [selected, setSelected] = useState<string[]>(
    providers.SEARCH_CONSOLE ? ['SEO', 'AEO', 'GEO', 'SEARCH_CONSOLE'] : ['SEO', 'AEO', 'GEO'],
  )
  const [url, setUrl] = useState('')
  const [market, setMarket] = useState(2276)

  const isSocial = /instagram\.|linkedin\.|tiktok\.|youtube\.|facebook\.|x\.com|twitter\./i.test(url)

  const toggle = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const applyProject = (id: string) => {
    const project = projects.find((p) => p.id === id)
    if (project) {
      setUrl(project.url)
      setMarket(project.locationCode)
    }
  }

  return (
    <form action={action} className="space-y-5">
      <Card>
        <CardHeader title="Was soll analysiert werden?" />
        <div className="space-y-4 p-5">
          {projects.length > 0 && (
            <div>
              <Label htmlFor="projectId">Projekt (optional)</Label>
              <Select id="projectId" name="projectId" onChange={(e) => applyProject(e.target.value)}>
                <option value="">Ohne Projektzuordnung</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.url}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              name="url"
              type="url"
              required
              placeholder="https://beispiel.de/seite"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="mt-1 text-[12px] text-ink-subtle">
              Website-Adresse oder Profil-Link bei Instagram, LinkedIn, TikTok, YouTube, Facebook oder X.
            </p>
          </div>

          {isSocial && (
            <div className="flex gap-2.5 rounded-lg bg-brand-subtle px-3 py-2.5">
              <Info size={16} className="mt-0.5 shrink-0 text-brand" />
              <p className="text-[13px] text-ink-muted">
                Social-Profil erkannt. Es läuft die Profilanalyse (Vollständigkeit, Auffindbarkeit,
                Reichweite, Interaktion) — die Website-Bausteine sind darauf nicht anwendbar.
                {!providers.APIFY && (
                  <strong className="block text-bad"> Dafür fehlen noch Apify-Zugangsdaten im Datentresor.</strong>
                )}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="locationCode">Markt</Label>
              <Select
                id="locationCode"
                name="locationCode"
                value={market}
                onChange={(e) => setMarket(Number(e.target.value))}
              >
                {MARKETS.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="languageCode">Sprache</Label>
              <Select id="languageCode" name="languageCode" defaultValue="de">
                <option value="de">Deutsch</option>
                <option value="en">Englisch</option>
                <option value="fr">Französisch</option>
                <option value="it">Italienisch</option>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {!isSocial && (
        <>
          <Card>
            <CardHeader
              title="Bausteine"
              description="Mehrfachauswahl. Jeder Baustein erhält eine eigene Bewertung im Bericht."
            />
            <div className="grid gap-2 p-5 sm:grid-cols-2">
              {MODULES.map((module) => {
                const missing = module.requires.filter((p) => !providers[p])
                const active = selected.includes(module.key)
                return (
                  <button
                    key={module.key}
                    type="button"
                    onClick={() => toggle(module.key)}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                      active ? 'border-brand bg-brand-subtle' : 'border-border hover:bg-surface-muted',
                    )}
                  >
                    <module.icon size={17} className={cn('mt-0.5 shrink-0', active ? 'text-brand' : 'text-ink-subtle')} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{module.label}</p>
                      <p className="mt-0.5 text-[12px] text-ink-muted">{module.description}</p>
                      {missing.length > 0 && (
                        <p className="mt-1 text-[12px] font-medium text-warn">
                          Braucht {missing.join(', ')}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            {selected.map((key) => (
              <input key={key} type="hidden" name="modules" value={key} />
            ))}
          </Card>

          <Card>
            <CardHeader
              title="Feinabstimmung"
              description="Optional. Ohne Angaben leitet die Analyse das Hauptkeyword aus der Seite ab und findet Wettbewerber automatisch."
            />
            <div className="space-y-4 p-5">
              <div>
                <Label htmlFor="seedKeywords">Keywords</Label>
                <Input
                  id="seedKeywords"
                  name="seedKeywords"
                  placeholder="ki beratung solopreneure, seo für coaches"
                />
                <p className="mt-1 text-[12px] text-ink-subtle">
                  Kommagetrennt, bis zu 5. Für diese Begriffe werden die tatsächlichen Platzierungen geprüft.
                </p>
              </div>
              <div>
                <Label htmlFor="competitorDomains">Wettbewerber</Label>
                <Input id="competitorDomains" name="competitorDomains" placeholder="wettbewerber-a.de, wettbewerber-b.de" />
                <p className="mt-1 text-[12px] text-ink-subtle">
                  Kommagetrennt, bis zu 3. Leer lassen, um sie automatisch aus den Suchergebnissen zu bestimmen.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      {state.error && (
        <p className="rounded-lg bg-bad-subtle px-4 py-3 text-[13px] text-bad">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || (!isSocial && selected.length === 0)}>
          {pending ? 'Wird gestartet…' : 'Analyse starten'}
        </Button>
        <p className="text-[13px] text-ink-muted">
          {isSocial ? 'Profilanalyse' : `${selected.length} Baustein${selected.length === 1 ? '' : 'e'}`}
        </p>
      </div>
    </form>
  )
}
