import type { KeywordZeile, Zusammenfassung } from './research'

/**
 * Eine Recherche zum Mitnehmen.
 *
 * Zwei Formen für zwei Wege: ein beschrifteter Text für die Zwischenablage,
 * damit Claude oder ChatGPT direkt mit echten Zahlen arbeiten statt mit
 * Vermutungen – und CSV für die Tabellenkalkulation. Beide enthalten auch
 * den Zwölfmonatsverlauf, denn genau der fehlt sonst in jeder Abschrift.
 */

export function rechercheAlsText(input: {
  seed: string
  datum: Date
  zeilen: KeywordZeile[]
  summary: Zusammenfassung
}): string {
  const anteilKauf =
    input.summary.suchenGesamt > 0
      ? Math.round((input.summary.suchenMitKaufabsicht / input.summary.suchenGesamt) * 100)
      : 0

  const kopf = [
    `Keyword-Recherche zu "${input.seed}" (SEO-Master/DataForSEO, Google Deutschland, ${input.datum.toLocaleDateString('de-DE')})`,
    `${input.summary.begriffe} Begriffe mit messbarem Suchvolumen · ${zahl(input.summary.suchenGesamt)} Suchen/Monat · ` +
      `Werbewert ${zahl(input.summary.anzeigenwertGesamt)} €/Monat · ${anteilKauf} % der Nachfrage mit Kauf- oder Vergleichsabsicht`,
    '',
    'Spalten: Begriff | Suchen/Monat | Klickpreis € | Werbewert €/Monat | Wettbewerb | Schwierigkeit (0–100) | Suchabsicht | Trend zum Vorjahr % | Suchvolumen-Verlauf 12 Monate (ältester zuerst)',
    '',
  ]

  const zeilen = input.zeilen.map((z) =>
    [
      z.begriff,
      String(z.suchvolumen),
      z.klickpreis > 0 ? z.klickpreis.toFixed(2).replace('.', ',') : '0',
      String(z.anzeigenwert),
      z.wettbewerb ?? 'k. A.',
      z.schwierigkeit !== null ? String(z.schwierigkeit) : 'k. A.',
      z.absicht,
      z.trendJahr !== null ? `${z.trendJahr > 0 ? '+' : ''}${z.trendJahr}` : 'k. A.',
      z.verlauf.length ? z.verlauf.join(', ') : 'k. A.',
    ].join(' | '),
  )

  return [...kopf, ...zeilen].join('\n')
}

export function rechercheAlsCsv(zeilen: KeywordZeile[]): string {
  const kopf = [
    'Begriff',
    'Suchen/Monat',
    'Klickpreis EUR',
    'Werbewert EUR/Monat',
    'Wettbewerb',
    'Schwierigkeit',
    'Suchabsicht',
    'Trend Jahr %',
    'Verlauf 12 Monate (aeltester zuerst)',
  ]
  const inhalt = zeilen.map((z) =>
    [
      z.begriff,
      String(z.suchvolumen),
      // Deutsches Dezimalkomma, damit die Tabellenkalkulation rechnen kann.
      z.klickpreis.toFixed(2).replace('.', ','),
      String(z.anzeigenwert),
      z.wettbewerb ?? '',
      z.schwierigkeit !== null ? String(z.schwierigkeit) : '',
      z.absicht,
      z.trendJahr !== null ? String(z.trendJahr).replace('.', ',') : '',
      z.verlauf.join(', '),
    ]
      .map(feld)
      .join(';'),
  )
  // Semikolon und BOM, damit Excel im deutschsprachigen Raum die Spalten
  // sofort richtig trennt und Umlaute nicht zerfallen.
  return `﻿${[kopf.map(feld).join(';'), ...inhalt].join('\r\n')}\r\n`
}

function feld(wert: string): string {
  return /[";\r\n]/.test(wert) ? `"${wert.replace(/"/g, '""')}"` : wert
}

function zahl(wert: number): string {
  return wert.toLocaleString('de-DE')
}
