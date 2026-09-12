'use client'

import { useActionState, useState } from 'react'
import { Globe, Search, Bot, Sparkles, Swords, Info, Lock } from 'lucide-react'
import { startAnalysisAction, type StartState } from '@/lib/analysis/actions'
import { Button, Card, CardHeader, Input, Label, Select } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import type { VerwendeterAnbieter } from '@/lib/connectors/credentials'
import {
  MARKTGRUPPEN,
  BERICHTSSPRACHEN,
  STANDARD_MARKT,
  projektMaerkte,
  maerkteInWorten,
} from '@/lib/analysis/maerkte'

type Project = {
  id: string
  name: string
  url: string
  locationCode: number
  locationCodes: number[]
  languageCode: string
}

const MODULES = [
  {
    key: 'SEO',
    label: 'SEO',
    description: 'Technik, Inhalt, Keywords, E-E-A-T',
    icon: Search,
    requires: [] as VerwendeterAnbieter[],
  },
  {
    key: 'AEO',
    label: 'AEO',
    description: 'Antwortboxen, FAQ-Struktur, Sprachsuche',
    icon: Bot,
    requires: [] as VerwendeterAnbieter[],
  },
  {
    key: 'GEO',
    label: 'GEO',
    description: 'Sichtbarkeit in ChatGPT, Perplexity & Co.',
    icon: Sparkles,
    requires: [] as VerwendeterAnbieter[],
  },
  {
    key: 'SERP',
    label: 'SERP',
    description: 'Tatsächliche Platzierungen und SERP-Elemente',
    icon: Globe,
    requires: ['DATAFORSEO'] as VerwendeterAnbieter[],
  },
  {
    key: 'COMPETITORS',
    label: 'Wettbewerb',
    description: 'Vergleich und Keyword-Lücken',
    icon: Swords,
    requires: ['DATAFORSEO'] as VerwendeterAnbieter[],
  },
]

export function NewAnalysisForm({
  projects,
  providers,
  eigeneZugaenge,
  wettbewerbImTarif = true,
}: {
  projects: Project[]
  wettbewerbImTarif?: boolean
  providers: Record<VerwendeterAnbieter, boolean>
  /**
   * Verwaltet dieser Arbeitsbereich eigene Anbieter-Zugänge? Entscheidet nur
   * über den Wortlaut: Eine Kundin kann an fehlenden Zugängen nichts ändern,
   * ein Verweis auf den Datentresor wäre für sie eine Sackgasse.
   */
  eigeneZugaenge: boolean
}) {
  const [state, action, pending] = useActionState<StartState, FormData>(startAnalysisAction, {})
  const [selected, setSelected] = useState<string[]>(['SEO', 'AEO', 'GEO'])
  const [url, setUrl] = useState('')
  const [umfang, setUmfang] = useState<'seite' | 'website'>('seite')
  const [market, setMarket] = useState(STANDARD_MARKT)
  const [projektId, setProjektId] = useState('')
  // Mehrere Märkte auf einmal nur, wenn das Projekt auch mehrere hat.
  const [alleMaerkte, setAlleMaerkte] = useState(false)

  const projektMaerkteListe = projektMaerkte(
    projects.find((p) => p.id === projektId) ?? { locationCode: market, locationCodes: [] },
  )

  const isSocial = /instagram\.|linkedin\.|tiktok\.|youtube\.|facebook\.|x\.com|twitter\./i.test(url)

  const toggle = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const applyProject = (id: string) => {
    setProjektId(id)
    const project = projects.find((p) => p.id === id)
    if (project) {
      setUrl(project.url)
      setMarket(project.locationCode)
      // Trägt das Projekt mehrere Märkte, ist das der Regelfall – sonst wäre
      // die Auswahl im Projekt folgenlos geblieben.
      setAlleMaerkte(projektMaerkte(project).length > 1)
    } else {
      setAlleMaerkte(false)
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

          {!isSocial && (
            <div>
              <Label>Umfang</Label>
              <input type="hidden" name="umfang" value={umfang} />
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      wert: 'seite' as const,
                      titel: 'Nur diese Seite',
                      text: 'Schnell und gezielt — die eingegebene Adresse im Detail.',
                    },
                    {
                      wert: 'website' as const,
                      titel: 'Gesamte Website',
                      text: 'Liest bis zu 25 Seiten der Domain mit — Blog, Unterseiten, Vergleiche. Dauert entsprechend länger.',
                    },
                  ]
                ).map((option) => (
                  <button
                    key={option.wert}
                    type="button"
                    onClick={() => setUmfang(option.wert)}
                    className={cn(
                      'rounded-lg border px-3.5 py-3 text-left transition-colors',
                      umfang === option.wert ? 'border-brand bg-brand-subtle' : 'border-border hover:border-border-strong',
                    )}
                  >
                    <span className="block text-[13px] font-medium">{option.titel}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-ink-subtle">{option.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSocial && (
            <div className="flex gap-2.5 rounded-lg bg-brand-subtle px-3 py-2.5">
              <Info size={16} className="mt-0.5 shrink-0 text-brand" />
              <p className="text-[13px] text-ink-muted">
                Social-Profil erkannt. Es läuft die Profilanalyse (Vollständigkeit, Auffindbarkeit,
                Reichweite, Interaktion) — die Website-Bausteine sind darauf nicht anwendbar.
                {!providers.APIFY && (
                  <strong className="block text-bad">
                    {eigeneZugaenge
                      ? ' Dafür fehlen noch Apify-Zugangsdaten im Datentresor.'
                      : ' Die Profilanalyse ist derzeit nicht verfügbar. Die Website-Analyse läuft davon unabhängig.'}
                  </strong>
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
                {MARKTGRUPPEN.map((gruppe) => (
                  <optgroup
                    key={gruppe.name}
                    label={gruppe.hinweis ? `${gruppe.name} — ${gruppe.hinweis}` : gruppe.name}
                  >
                    {gruppe.laender.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>

              {/*
                Nur zeigen, wenn es etwas zu entscheiden gibt. Ein Kästchen,
                das bei einem Markt "in allen Märkten" anbietet, ist eine
                Frage ohne Inhalt — und die Kosten stehen dabei, bevor
                geklickt wird, nicht danach in der Abrechnung.
              */}
              {projektMaerkteListe.length > 1 && (
                <label className="lift mt-2 flex cursor-pointer items-start gap-2.5 rounded-xl border-2 border-border bg-limette px-3 py-2.5">
                  <input
                    type="checkbox"
                    name="alleMaerkte"
                    value="ja"
                    checked={alleMaerkte}
                    onChange={(e) => setAlleMaerkte(e.target.checked)}
                    className="mt-0.5 accent-rot"
                  />
                  <span className="text-[12px] font-medium text-tinte">
                    <span className="font-bold">
                      In allen {projektMaerkteListe.length} Märkten des Projekts starten
                    </span>
                    <span className="mt-0.5 block">
                      {maerkteInWorten(projektMaerkteListe)} — je Land ein eigener Lauf, also{' '}
                      {projektMaerkteListe.length}× Kontingent.
                    </span>
                  </span>
                </label>
              )}
            </div>
            <div>
              <Label htmlFor="languageCode">Sprache</Label>
              <Select id="languageCode" name="languageCode" defaultValue="de">
                {BERICHTSSPRACHEN.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
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
                /*
                  Gesperrte Bausteine werden gezeigt, nicht versteckt.

                  Das ist der beste Verkaufsmoment, den es gibt: Sie steht im
                  Formular, sie will diesen Baustein, und sie ist einen Klick
                  entfernt. Ihn wegzulassen verschenkt genau diesen Moment —
                  und wer ihn nie sieht, weiss auch nicht, was ihm fehlt.
                */
                const gesperrt = module.key === 'COMPETITORS' && !wettbewerbImTarif
                return (
                  <button
                    key={module.key}
                    type="button"
                    onClick={() => !gesperrt && toggle(module.key)}
                    aria-disabled={gesperrt}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                      gesperrt
                        ? 'cursor-not-allowed border-border bg-surface-muted opacity-70'
                        : active
                          ? 'border-brand bg-brand-subtle'
                          : 'border-border hover:bg-surface-muted',
                    )}
                  >
                    <module.icon
                      size={17}
                      className={cn('mt-0.5 shrink-0', active && !gesperrt ? 'text-brand' : 'text-ink-subtle')}
                    />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium">
                        {module.label}
                        {gesperrt && <Lock size={12} className="shrink-0 text-ink-subtle" />}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-muted">{module.description}</p>
                      {gesperrt ? (
                        <p className="mt-1 text-[12px] font-bold text-brand">
                          Gehört zum grossen Tarif
                        </p>
                      ) : (
                        missing.length > 0 && (
                          <p className="mt-1 text-[12px] font-medium text-warn">
                            {eigeneZugaenge ? `Braucht ${missing.join(', ')}` : 'Derzeit nicht verfügbar'}
                          </p>
                        )
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
        <p className="rounded-md border-2 border-tinte bg-rosa px-4 py-3 text-[13px] font-bold text-rot">{state.error}</p>
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
