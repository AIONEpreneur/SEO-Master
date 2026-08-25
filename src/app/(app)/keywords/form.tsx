'use client'

import { useActionState } from 'react'
import { TrendingUp } from 'lucide-react'
import { startKeywordResearchAction, type ResearchState } from '@/lib/keywords/actions'
import { Button, Card, CardHeader, Input, Label, Select } from '@/components/ui'

const MAERKTE = [
  { code: 2276, label: 'Deutschland', sprache: 'de' },
  { code: 2040, label: 'Österreich', sprache: 'de' },
  { code: 2756, label: 'Schweiz', sprache: 'de' },
  { code: 2826, label: 'Vereinigtes Königreich', sprache: 'en' },
  { code: 2840, label: 'USA', sprache: 'en' },
]

export function KeywordForm({
  hatDataForSeo,
  eigeneZugaenge,
}: {
  hatDataForSeo: boolean
  /** Nur für den Wortlaut: Eine Kundin kann fehlende Zugänge nicht ergänzen. */
  eigeneZugaenge: boolean
}) {
  const [state, action, pending] = useActionState<ResearchState, FormData>(startKeywordResearchAction, {})

  return (
    <form action={action}>
      <Card>
        <CardHeader
          title="Wonach wird gesucht?"
          description="Einen Begriff aus dem eigenen Themenfeld eingeben. Gesucht werden alle Suchanfragen, die ihn enthalten, dazu die verwandten Formulierungen."
        />
        <div className="space-y-4 p-5">
          <div>
            <Label htmlFor="seed">Begriff</Label>
            <Input id="seed" name="seed" required placeholder="ki beratung" maxLength={80} />
            <p className="mt-1 text-[12px] text-ink-subtle">
              Lieber allgemein als eng: Aus „ki beratung" entstehen Hunderte Varianten, aus einem
              ganzen Satz meist keine.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="locationCode">Markt</Label>
              <Select id="locationCode" name="locationCode" defaultValue={2276}>
                {MAERKTE.map((m) => (
                  <option key={m.code} value={m.code}>{m.label}</option>
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

          {!hatDataForSeo && (
            <p className="rounded-lg bg-warn-subtle px-4 py-3 text-[13px] text-warn">
              {eigeneZugaenge
                ? 'Dafür fehlen noch DataForSEO-Zugangsdaten im Datentresor.'
                : 'Die Keyword-Recherche ist derzeit nicht verfügbar.'}
            </p>
          )}

          {state.error && (
            <p className="rounded-lg bg-bad-subtle px-4 py-3 text-[13px] text-bad">{state.error}</p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending || !hatDataForSeo}>
              <TrendingUp size={16} />
              {pending ? 'Wird gesucht…' : 'Begriffe finden'}
            </Button>
            <p className="text-[13px] text-ink-muted">Dauert wenige Sekunden</p>
          </div>
        </div>
      </Card>
    </form>
  )
}
