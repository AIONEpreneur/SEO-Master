import type { Finding } from './types'

/**
 * Prüfung des Canonical-Tags gegen die tatsächlich geladene Adresse.
 *
 * Das Canonical sagt Google, welche Adresse die maßgebliche ist. Zeigt es
 * woandershin als die Seite, die gerade ausgeliefert wurde, laufen die
 * Signale auseinander – gemessen wird eine Seite, gewertet eine andere.
 *
 * Der häufigste Fall ist www gegen ohne-www: beide Adressen antworten mit
 * 200, das Canonical benennt aber nur eine davon.
 */
export type KanonischUrteil =
  | { art: 'fehlt' }
  | { art: 'ungueltig'; wert: string }
  | { art: 'anderer-host'; wert: string; ziel: string; eigener: string; nurWww: boolean }
  | { art: 'anderes-protokoll'; wert: string; ziel: string }
  | { art: 'andere-seite'; wert: string; ziel: string }
  | { art: 'stimmig'; wert: string }

/** Endender Schrägstrich ist für Google bedeutungslos – hier auch. */
function pfadform(pfad: string): string {
  const ohne = pfad.replace(/\/+$/, '')
  return ohne === '' ? '/' : ohne
}

function ohneWww(host: string): string {
  return host.toLowerCase().replace(/^www\./, '')
}

export function beurteileKanonisch(input: {
  canonical: string | null | undefined
  url: string
  finalUrl?: string | null
}): KanonischUrteil {
  const roh = input.canonical?.trim()
  if (!roh) return { art: 'fehlt' }

  const basis = input.finalUrl?.trim() || input.url
  let eigen: URL
  let ziel: URL
  try {
    eigen = new URL(basis)
    // Relative Angaben sind erlaubt und werden gegen die Seite aufgelöst.
    ziel = new URL(roh, basis)
  } catch {
    return { art: 'ungueltig', wert: roh }
  }

  if (eigen.host.toLowerCase() !== ziel.host.toLowerCase()) {
    return {
      art: 'anderer-host',
      wert: roh,
      ziel: ziel.host,
      eigener: eigen.host,
      nurWww: ohneWww(eigen.host) === ohneWww(ziel.host),
    }
  }

  if (eigen.protocol !== ziel.protocol) {
    return { art: 'anderes-protokoll', wert: roh, ziel: ziel.protocol.replace(':', '') }
  }

  if (pfadform(eigen.pathname) !== pfadform(ziel.pathname)) {
    return { art: 'andere-seite', wert: roh, ziel: ziel.pathname }
  }

  return { art: 'stimmig', wert: roh }
}

/** Note für das technische Kriterium – 10 heißt: das Canonical passt. */
export function kanonischeNote(urteil: KanonischUrteil): number {
  switch (urteil.art) {
    case 'stimmig':
      return 10
    case 'andere-seite':
      return 6
    case 'fehlt':
      return 5
    case 'anderer-host':
    case 'anderes-protokoll':
      return 3
    case 'ungueltig':
      return 2
  }
}

export function kanonischerHinweis(urteil: KanonischUrteil): string {
  switch (urteil.art) {
    case 'stimmig':
      return `Canonical zeigt auf die geprüfte Seite selbst (${urteil.wert}).`
    case 'andere-seite':
      return `Canonical zeigt auf eine andere Seite derselben Domain (${urteil.ziel}).`
    case 'fehlt':
      return 'Kein Canonical-Tag vorhanden.'
    case 'anderer-host':
      return `Canonical zeigt auf ${urteil.ziel}, ausgeliefert wurde ${urteil.eigener}.`
    case 'anderes-protokoll':
      return `Canonical zeigt auf ${urteil.ziel}, die Seite läuft über ein anderes Protokoll.`
    case 'ungueltig':
      return `Canonical ist keine gültige Adresse ("${urteil.wert}").`
  }
}

export function kanonischerBefund(urteil: KanonischUrteil): Finding | null {
  switch (urteil.art) {
    case 'stimmig':
      return null

    case 'fehlt':
      return {
        id: 'seo-canonical-missing',
        severity: 'quickwin',
        title: 'Kein Canonical-Tag auf dieser Seite',
        why: 'Ohne Canonical entscheidet Google selbst, welche Adresse die maßgebliche ist – bei Varianten mit und ohne www, mit Parametern oder mit Schrägstrich am Ende kann das die falsche sein.',
        action: 'Im <head> ein `<link rel="canonical" href="…">` mit der vollständigen Adresse dieser Seite ergänzen.',
        effort: 'gering',
        impact: 'mittel',
      }

    case 'anderer-host':
      return {
        id: 'seo-canonical-host',
        severity: 'quickwin',
        title: urteil.nurWww
          ? 'Canonical zeigt auf die andere www-Variante'
          : 'Canonical zeigt auf eine andere Domain',
        why: `Ausgeliefert wurde ${urteil.eigener}, das Canonical benennt aber ${urteil.ziel}. Beide Adressen antworten – Google sieht dieselbe Seite zweimal und verteilt die Signale auf beide.`,
        action: urteil.nurWww
          ? `Eine Variante festlegen und die andere per 301 dorthin umleiten: entweder alles auf ${urteil.ziel} oder alles auf ${urteil.eigener}. Das Canonical muss danach auf die Adresse zeigen, die auch wirklich ausgeliefert wird.`
          : `Prüfen, ob der Verweis auf ${urteil.ziel} gewollt ist. Wenn nicht, das Canonical auf die eigene Adresse ${urteil.eigener} setzen – sonst gibt diese Seite ihre Rankings an eine fremde Domain ab.`,
        effort: 'gering',
        impact: 'hoch',
        evidence: urteil.wert,
      }

    case 'anderes-protokoll':
      return {
        id: 'seo-canonical-protocol',
        severity: 'quickwin',
        title: 'Canonical zeigt auf ein anderes Protokoll',
        why: 'http und https gelten für Google als zwei getrennte Adressen. Ein Canonical, das auf die andere Fassung zeigt, führt die Bewertung von der ausgelieferten Seite weg.',
        action: 'Das Canonical auf die https-Adresse dieser Seite setzen und alle http-Aufrufe per 301 auf https umleiten.',
        effort: 'gering',
        impact: 'hoch',
        evidence: urteil.wert,
      }

    case 'andere-seite':
      return {
        id: 'seo-canonical-elsewhere',
        severity: 'quickwin',
        title: 'Diese Seite verweist per Canonical auf eine andere Seite',
        why: `Das Canonical zeigt auf ${urteil.ziel}. Damit erklärt die Seite sich selbst zur Zweitfassung – Google wertet sie nicht eigenständig. Falls das gewollt ist, ist alles in Ordnung; falls nicht, arbeitet jede Optimierung hier ins Leere.`,
        action: `Prüfen, ob ${urteil.ziel} tatsächlich die maßgebliche Fassung ist. Wenn diese Seite eigenständig ranken soll, das Canonical auf sie selbst setzen.`,
        effort: 'gering',
        impact: 'mittel',
        evidence: urteil.wert,
      }

    case 'ungueltig':
      return {
        id: 'seo-canonical-invalid',
        severity: 'quickwin',
        title: 'Canonical-Tag ist keine gültige Adresse',
        why: 'Ein fehlerhaftes Canonical wird von Google ignoriert – die Seite steht damit so da, als hätte sie keines.',
        action: 'Das Canonical durch die vollständige Adresse dieser Seite ersetzen, inklusive https:// und Domain.',
        effort: 'gering',
        impact: 'mittel',
        evidence: urteil.wert,
      }
  }
}
