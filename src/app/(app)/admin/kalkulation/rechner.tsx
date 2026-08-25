"use client"

import { useState } from 'react'
import { deckung, empfohlenesKontingent } from '@/lib/admin/kalkulation'
import { Card, CardHeader, Input, Label } from '@/components/ui'
import { cn } from '@/lib/utils/cn'

/**
 * Der Rechner steht bewusst neben den gemessenen Zahlen: Der Preis ist eine
 * Entscheidung, die Kosten sind es nicht.
 */
export function Rechner({
  medianCent,
  obereGrenzeCent,
  laeufeJeBereichImMonat,
}: {
  medianCent: number
  obereGrenzeCent: number
  laeufeJeBereichImMonat: number
}) {
  const [preisEuro, setPreisEuro] = useState(29)
  const [laeufe, setLaeufe] = useState(laeufeJeBereichImMonat)

  const preisCent = Math.round(preisEuro * 100)
  const d = deckung({
    preisCent,
    kostenJeLaufCent: medianCent,
    ungunstJeLaufCent: obereGrenzeCent,
    laeufeImMonat: laeufe,
  })
  const kontingent = empfohlenesKontingent({ preisCent, ungunstJeLaufCent: obereGrenzeCent, zielmarge: 0.7 })

  return (
    <Card>
      <CardHeader
        title="Was trägt ein Monatspreis?"
        description="Netto gerechnet. Die Umsatzsteuer ist durchlaufender Posten und gehört nicht in die Marge."
      />

      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="preis">Monatspreis netto (€)</Label>
          <Input
            id="preis"
            type="number"
            min={0}
            step={1}
            value={preisEuro}
            onChange={(e) => setPreisEuro(Math.max(0, Number(e.target.value)))}
          />
        </div>
        <div>
          <Label htmlFor="laeufe">Analysen je Kundin und Monat</Label>
          <Input
            id="laeufe"
            type="number"
            min={0}
            step={1}
            value={laeufe}
            onChange={(e) => setLaeufe(Math.max(0, Number(e.target.value)))}
          />
        </div>
      </div>

      <dl className="divide-y divide-border border-t border-border">
        <Ergebnis
          begriff="Gedeckte Analysen"
          wert={`${d.gedeckteLaeufeUngunst}`}
          erlaeuterung={`Mit teuren Läufen gerechnet. Bei üblichen Läufen wären es ${d.gedeckteLaeufe}.`}
        />
        <Ergebnis
          begriff="Bleibt bei erwarteter Nutzung"
          wert={`${(d.margeCent / 100).toFixed(2).replace('.', ',')} €`}
          erlaeuterung={
            d.traegtSich
              ? `${Math.round(d.margeAnteil * 100)} % vom Preis. Der Rest geht an die Anbieter.`
              : 'Der Preis deckt die Anbieterkosten bei dieser Nutzung nicht.'
          }
          warnung={!d.traegtSich}
        />
        <Ergebnis
          begriff="Empfohlenes Kontingent"
          wert={`${kontingent} Analysen`}
          erlaeuterung="Bei 70 % Zielmarge und teuren Läufen. Ein Kontingent ist ein Versprechen — deshalb der ungünstige Fall."
        />
      </dl>

      <div className="border-t border-border px-5 py-4">
        <p className="text-[12px] leading-relaxed text-ink-muted">
          <strong className="font-medium text-ink">Unbegrenzt ist hier keine Option.</strong> Da über deine
          Zugangsdaten abgerechnet wird, wächst deine Rechnung mit jedem Lauf. Ein Kontingent plus
          Nachkaufmöglichkeit ist die einzige Form, bei der eine Vielnutzerin dich nicht Geld kostet.
        </p>
      </div>
    </Card>
  )
}

function Ergebnis({
  begriff,
  wert,
  erlaeuterung,
  warnung,
}: {
  begriff: string
  wert: string
  erlaeuterung: string
  warnung?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <dt className="text-[13px]">{begriff}</dt>
        <p className="mt-0.5 text-[12px] leading-snug text-ink-subtle">{erlaeuterung}</p>
      </div>
      <dd className={cn('shrink-0 text-[13px] font-semibold tabular-nums', warnung && 'text-bad')}>{wert}</dd>
    </div>
  )
}
