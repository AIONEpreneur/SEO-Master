import type { PageSignals } from './extract'
import type { Severity } from './types'

/**
 * Auswahl der Unterseiten für die Website-Analyse.
 *
 * Firecrawl liefert die Adressliste einer Domain; gelesen wird davon eine
 * begrenzte Zahl. Die Grenze ist kein Geiz, sondern Schutz: Jede Seite kostet
 * einen Abruf und Rechenzeit, und ein Shop mit 4000 Produktseiten würde einen
 * Lauf sonst auf Stunden strecken. Innerhalb der Grenze zählt Inhalt vor
 * Tiefe – Blog- und Themenseiten sind das, worüber eine Website gefunden
 * wird.
 */

/** Höchstzahl gelesener Seiten je Lauf, Startseite eingerechnet. */
export const WEBSITE_UMFANG = 25

/** Anteile der Adresse, die keine Inhaltsseiten sind. */
const AUSGESCHLOSSEN =
  /\/(wp-admin|wp-login|wp-json|feed|cart|checkout|warenkorb|kasse|login|logout|register|impressum|datenschutz|agb|cookie|tag|category\/page|page\/\d+|search|suche)(\/|$)|\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4|mp3|xml|css|js|ico|woff2?)($|\?)/i

/**
 * Adresse zum Abrufen aufbereiten – so wenig wie möglich verändern.
 *
 * Entfernt werden nur Fragmente und Nachverfolgungs-Parameter; beides
 * unterscheidet keine Inhalte. Alles andere bleibt, wie die Website es
 * ausgibt – vor allem der Schrägstrich am Ende: Bei Ordner-Adressen
 * antwortet der Server auf die Fassung ohne Schrägstrich oft mit einer
 * Weiterleitung oder einem 404. Wer hier "aufräumt", erzeugt Phantom-Fehler
 * für Seiten, die es gibt.
 */
function abrufAdresse(url: URL): string {
  url.hash = ''
  for (const schluessel of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|ref$)/i.test(schluessel)) url.searchParams.delete(schluessel)
  }
  return url.toString()
}

/**
 * Vergleichsform für die Dublettenerkennung – NICHT zum Abrufen.
 *
 * www gegen ohne-www und mit gegen ohne Schrägstrich sind dieselbe Seite;
 * ohne diese Zusammenführung würde sie doppelt gelesen und doppelt bezahlt.
 * Der Schlüssel dient nur dem Vergleich, abgerufen wird immer die Adresse,
 * wie sie gefunden wurde.
 */
function vergleichsSchluessel(url: URL): string {
  const kopie = new URL(abrufAdresse(new URL(url)))
  kopie.hostname = kopie.hostname.replace(/^www\./, '').toLowerCase()
  let s = kopie.toString()
  if (s.endsWith('/')) s = s.slice(0, -1)
  return s
}

function gleicherHost(a: string, b: string): boolean {
  return a.replace(/^www\./, '').toLowerCase() === b.replace(/^www\./, '').toLowerCase()
}

export function waehleSeiten(input: {
  startUrl: string
  gefunden: Array<{ url: string }>
  limit?: number
}): string[] {
  const limit = input.limit ?? WEBSITE_UMFANG
  let start: URL
  try {
    start = new URL(input.startUrl)
  } catch {
    return []
  }
  const startSchluessel = vergleichsSchluessel(start)

  const kandidaten = new Map<string, { url: string; tiefe: number; istInhalt: boolean }>()
  for (const eintrag of input.gefunden) {
    let url: URL
    try {
      url = new URL(eintrag.url)
    } catch {
      continue
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue
    if (!gleicherHost(url.hostname, start.hostname)) continue

    const schluessel = vergleichsSchluessel(url)
    if (schluessel === startSchluessel) continue
    if (AUSGESCHLOSSEN.test(url.pathname + url.search)) continue
    if (kandidaten.has(schluessel)) continue

    const pfadTeile = url.pathname.split('/').filter(Boolean)
    kandidaten.set(schluessel, {
      url: abrufAdresse(url),
      tiefe: pfadTeile.length,
      // Blog-, Ratgeber- und Vergleichsseiten zuerst: Darüber wird eine
      // Website gefunden, und genau dort liegen die Inhaltsbefunde.
      istInhalt: /\/(blog|ratgeber|wissen|magazin|artikel|guide|vergleich|news|aktuelles)(\/|$)/i.test(url.pathname),
    })
  }

  return [...kandidaten.values()]
    .sort((a, b) => {
      if (a.istInhalt !== b.istInhalt) return a.istInhalt ? -1 : 1
      if (a.tiefe !== b.tiefe) return a.tiefe - b.tiefe
      return a.url.length - b.url.length
    })
    .slice(0, Math.max(0, limit - 1))
    .map((k) => k.url)
}

export type SeitenErgebnis = {
  url: string
  titel: string | null
  scores: { seo: number; aeo: number; geo: number }
  schnitt: number
  befunde: Array<{ id: string; title: string; severity: Severity }>
}

/** Formt die Kennzahlen einer gelesenen Unterseite. */
export function seitenErgebnis(input: {
  url: string
  signals: PageSignals
  seo: { score: number; findings: Array<{ id: string; title: string; severity: Severity }> }
  aeo: { score: number; findings: Array<{ id: string; title: string; severity: Severity }> }
  geo: { score: number; findings: Array<{ id: string; title: string; severity: Severity }> }
}): SeitenErgebnis {
  const alle = [...input.seo.findings, ...input.aeo.findings, ...input.geo.findings]
  const rang: Record<Severity, number> = { critical: 0, quickwin: 1, longterm: 2 }
  return {
    url: input.url,
    titel: input.signals.title,
    scores: {
      seo: Math.round(input.seo.score * 10) / 10,
      aeo: Math.round(input.aeo.score * 10) / 10,
      geo: Math.round(input.geo.score * 10) / 10,
    },
    schnitt: Math.round(((input.seo.score + input.aeo.score + input.geo.score) / 3) * 10) / 10,
    befunde: alle
      .sort((a, b) => rang[a.severity] - rang[b.severity])
      .slice(0, 5)
      .map(({ id, title, severity }) => ({ id, title, severity })),
  }
}
