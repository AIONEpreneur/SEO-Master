/**
 * Auswertung der Search-Console-Daten.
 *
 * Der Unterschied zu allem anderen in dieser Anwendung: Diese Zahlen sind
 * gezählt, nicht geschätzt. Deshalb haben sie Vorrang – wo Search Console
 * spricht, schweigen die Hochrechnungen.
 *
 * Drei Befunde entstehen hier, und alle drei lassen sich mit geschätzten
 * Daten gar nicht bilden:
 *
 *   1. Viele Einblendungen, kaum Klicks. Das Suchergebnis wird gesehen und
 *      nicht angeklickt – ein Title-/Description-Problem, kein Ranking-Problem.
 *   2. Position 11 bis 20. Knapp hinter Seite eins; hier bewegt wenig Arbeit
 *      viel, während dieselbe Arbeit auf Position 60 nichts bewirkt.
 *   3. Suchanfragen, für die die Seite gefunden wird, ohne sie zu behandeln.
 *      Nachfrage, die niemand bedient hat.
 */
import type { SearchAnalyticsRow } from '@/lib/connectors/search-console'
import type { Criterion, Finding, ModuleResult } from './types'
import { weightedScore, scoreLabel, statusFor } from './types'
import { deckungsgrad } from './begriffe'

export type SucheZeile = {
  begriff: string
  klicks: number
  einblendungen: number
  /** Klickrate in Prozent. */
  ctr: number
  position: number
}

export type SucheDaten = {
  property: string
  zeitraum: { von: string; bis: string }
  /** Werte für genau die analysierte Seite. */
  seite: { klicks: number; einblendungen: number; ctr: number; position: number } | null
  /** Suchanfragen, über die diese Seite gefunden wird. */
  begriffe: SucheZeile[]
}

export function normalisiereZeilen(rows: SearchAnalyticsRow[]): SucheZeile[] {
  return rows
    .map((r) => ({
      begriff: r.keys?.[0] ?? '',
      klicks: r.clicks ?? 0,
      einblendungen: r.impressions ?? 0,
      // Google liefert die Klickrate als Anteil, nicht als Prozentwert.
      ctr: Math.round((r.ctr ?? 0) * 1000) / 10,
      position: Math.round((r.position ?? 0) * 10) / 10,
    }))
    .filter((z) => z.begriff && z.einblendungen > 0)
    .sort((a, b) => b.klicks - a.klicks || b.einblendungen - a.einblendungen)
}

/**
 * Suchanfragen, die gesehen und nicht geklickt werden.
 *
 * Die Schwelle richtet sich nach der Position: Auf Platz 3 sind 2 % Klickrate
 * auffällig, auf Platz 25 sind sie normal. Ohne diese Staffelung meldet die
 * Auswertung jede schlecht platzierte Suchanfrage als Snippet-Problem.
 *
 * Erst ab 100 Einblendungen: Darunter ist die Klickrate Zufall.
 */
export function ungenutzteEinblendungen(zeilen: SucheZeile[], anzahl = 5): SucheZeile[] {
  return zeilen
    .filter((z) => z.einblendungen >= 100 && z.position <= 10 && z.ctr < erwarteteCtr(z.position) * 0.5)
    .sort((a, b) => b.einblendungen - a.einblendungen)
    .slice(0, anzahl)
}

/**
 * Ungefähre Klickrate nach Position, aus öffentlich berichteten
 * Durchschnittswerten. Sie dient nur als Vergleichsmass für "auffällig
 * niedrig" – als Prognose taugt sie nicht und wird auch nirgends als solche
 * ausgewiesen.
 */
function erwarteteCtr(position: number): number {
  if (position <= 1.5) return 28
  if (position <= 2.5) return 15
  if (position <= 3.5) return 11
  if (position <= 5) return 7
  if (position <= 7) return 4
  return 2.5
}

/** Knapp hinter Seite eins: Position 11 bis 20, mit spürbarer Nachfrage. */
export function knappVorbei(zeilen: SucheZeile[], anzahl = 5): SucheZeile[] {
  return zeilen
    .filter((z) => z.position > 10 && z.position <= 20 && z.einblendungen >= 50)
    .sort((a, b) => b.einblendungen - a.einblendungen)
    .slice(0, anzahl)
}

/**
 * Suchanfragen, die auf der Seite gar nicht vorkommen.
 *
 * Google ordnet die Seite einem Thema zu, das sie nicht behandelt. Das ist
 * kein Fehler, sondern eine Lücke: Nachfrage ohne passenden Inhalt.
 *
 * Gemessen wird über den Deckungsgrad, nicht über die exakte Wortfolge. Sonst
 * gälte "ki beratung kosten" als Lücke, obwohl auf der Seite "Was kostet
 * KI-Beratung?" steht – und die Empfehlung lautete, Inhalt anzulegen, der
 * bereits da ist.
 *
 * Die Schwelle liegt bei zwei Dritteln: Darunter fehlt mehr als ein
 * tragendes Wort der Anfrage, und das ist ein anderes Thema.
 */
const DECKUNGSSCHWELLE = 0.67

export function unbehandelteBegriffe(
  zeilen: SucheZeile[],
  seitentext: string,
  anzahl = 5,
): SucheZeile[] {
  return zeilen
    .filter((z) => z.einblendungen >= 50 && deckungsgrad(seitentext, z.begriff) < DECKUNGSSCHWELLE)
    .sort((a, b) => b.einblendungen - a.einblendungen)
    .slice(0, anzahl)
}

export function analyzeSearchConsole(input: {
  daten: SucheDaten
  seitentext: string
}): ModuleResult {
  const { daten, seitentext } = input
  const findings: Finding[] = []
  const criteria: Criterion[] = []

  const zeilen = daten.begriffe
  const klicksGesamt = zeilen.reduce((s, z) => s + z.klicks, 0)
  const einblendungenGesamt = zeilen.reduce((s, z) => s + z.einblendungen, 0)
  const ctrGesamt = einblendungenGesamt > 0 ? Math.round((klicksGesamt / einblendungenGesamt) * 1000) / 10 : 0

  // --- Tatsächliche Sichtbarkeit -------------------------------------------
  {
    const score =
      klicksGesamt === 0 ? (einblendungenGesamt > 0 ? 2 : 0)
      : klicksGesamt < 10 ? 3
      : klicksGesamt < 50 ? 5
      : klicksGesamt < 200 ? 7
      : klicksGesamt < 1000 ? 8.5
      : 10

    criteria.push({
      key: 'klicks',
      label: 'Klicks aus der Suche',
      score,
      weight: 3,
      detail: `${klicksGesamt} Klicks bei ${einblendungenGesamt} Einblendungen (${ctrGesamt} % Klickrate), ${daten.zeitraum.von} bis ${daten.zeitraum.bis}.`,
      status: statusFor(score),
    })

    if (einblendungenGesamt >= 200 && klicksGesamt === 0) {
      findings.push({
        id: 'gsc-keine-klicks',
        severity: 'critical',
        title: `${einblendungenGesamt} Einblendungen, kein einziger Klick`,
        why: 'Die Seite erscheint in den Suchergebnissen und wird nicht angeklickt. Das ist kein Sichtbarkeitsproblem, sondern eines des Suchergebnisses selbst – Title und Description überzeugen nicht, oder die Seite erscheint zu Suchanfragen, zu denen sie nicht passt.',
        action: 'Title und Meta Description auf die Suchanfragen ausrichten, über die die Seite tatsächlich erscheint. Die Liste steht in diesem Bericht.',
        effort: 'gering',
        impact: 'hoch',
      })
    }
  }

  // --- Durchschnittliche Position ------------------------------------------
  {
    const position = daten.seite?.position ?? null
    if (position === null) {
      criteria.push({
        key: 'position',
        label: 'Durchschnittliche Position',
        score: 0,
        weight: 2,
        detail: 'Für diese Seite liegen keine Positionsdaten vor.',
        status: 'unknown',
      })
    } else {
      const score = position <= 3 ? 10 : position <= 10 ? 8 : position <= 20 ? 5 : position <= 50 ? 3 : 1
      criteria.push({
        key: 'position',
        label: 'Durchschnittliche Position',
        score,
        weight: 2,
        detail: `Platz ${position} im Mittel über alle Suchanfragen, für die die Seite erscheint.`,
        status: statusFor(score),
      })
    }
  }

  // --- Gesehen, nicht geklickt ---------------------------------------------
  {
    const verschenkt = ungenutzteEinblendungen(zeilen)
    const score = verschenkt.length === 0 ? 9 : verschenkt.length <= 2 ? 6 : 3

    criteria.push({
      key: 'klickrate',
      label: 'Klickrate je Suchanfrage',
      score,
      weight: 3,
      detail: verschenkt.length
        ? `${verschenkt.length} Suchanfragen auf Seite eins mit auffällig niedriger Klickrate.`
        : 'Keine Suchanfrage fällt mit ungewöhnlich niedriger Klickrate auf.',
      status: statusFor(score),
    })

    if (verschenkt.length > 0) {
      const ersteDrei = verschenkt.slice(0, 3)
      findings.push({
        id: 'gsc-ungenutzte-einblendungen',
        severity: 'quickwin',
        title: `${verschenkt.length} Suchanfragen werden gesehen, aber kaum geklickt`,
        why: `Diese Suchanfragen stehen bereits auf Seite eins – die Platzierung stimmt, das Suchergebnis überzeugt nicht. ${ersteDrei
          .map((z) => `„${z.begriff}" (Platz ${z.position}, ${z.einblendungen} Einblendungen, ${z.ctr} % Klickrate)`)
          .join('; ')}. Hier liegt Nachfrage, die bereits da ist.`,
        action: `Title und Meta Description so umschreiben, dass sie genau diese Suchanfragen beantworten. Beginnen mit „${ersteDrei[0].begriff}" – die Suchanfrage mit den meisten Einblendungen.`,
        effort: 'gering',
        impact: 'hoch',
        evidence: ersteDrei.map((z) => `${z.begriff} — Platz ${z.position}, ${z.ctr} %`).join(' · '),
      })
    }
  }

  // --- Knapp hinter Seite eins ---------------------------------------------
  {
    const knapp = knappVorbei(zeilen)
    if (knapp.length > 0) {
      findings.push({
        id: 'gsc-knapp-vorbei',
        severity: 'quickwin',
        title: `${knapp.length} Suchanfragen stehen knapp hinter Seite eins`,
        why: `Auf den Plätzen 11 bis 20 kommt praktisch kein Klick an, obwohl die Seite dort schon als passend gilt. Wenige Plätze entscheiden über den Unterschied zwischen null und spürbarem Besuch: ${knapp
          .slice(0, 3)
          .map((z) => `„${z.begriff}" (Platz ${z.position}, ${z.einblendungen} Einblendungen)`)
          .join('; ')}.`,
        action: `Für diese Suchanfragen den vorhandenen Inhalt vertiefen statt neuen anzulegen: Abschnitt mit der wörtlichen Frage als Überschrift, Antwort direkt darunter, dazu interne Verweise von passenden Seiten. Zuerst „${knapp[0].begriff}".`,
        effort: 'mittel',
        impact: 'hoch',
        evidence: knapp.map((z) => `${z.begriff} — Platz ${z.position}`).join(' · '),
      })
    }
  }

  // --- Nachfrage ohne Inhalt -----------------------------------------------
  {
    const luecken = unbehandelteBegriffe(zeilen, seitentext)
    if (luecken.length > 0) {
      findings.push({
        id: 'gsc-unbehandelte-nachfrage',
        severity: 'longterm',
        title: `${luecken.length} Suchanfragen ohne passenden Inhalt auf der Seite`,
        why: `Google zeigt die Seite zu Suchanfragen, die sie inhaltlich nicht behandelt: ${luecken
          .slice(0, 3)
          .map((z) => `„${z.begriff}" (${z.einblendungen} Einblendungen)`)
          .join('; ')}. Das ist nachgewiesene Nachfrage, für die noch niemand die passende Seite hat.`,
        action: `Je Suchanfrage prüfen, ob ein eigener Abschnitt oder eine eigene Seite sinnvoll ist. „${luecken[0].begriff}" hat die meisten Einblendungen und wäre der Anfang.`,
        effort: 'hoch',
        impact: 'hoch',
        evidence: luecken.map((z) => `${z.begriff} — ${z.einblendungen} Einblendungen`).join(' · '),
      })
    }
  }

  const score = weightedScore(criteria)
  return {
    module: 'SEARCH_CONSOLE',
    label: scoreLabel(score),
    score,
    criteria,
    findings,
    data: {
      property: daten.property,
      zeitraum: daten.zeitraum,
      klicksGesamt,
      einblendungenGesamt,
      ctrGesamt,
      begriffe: zeilen.slice(0, 50),
    },
  }
}
