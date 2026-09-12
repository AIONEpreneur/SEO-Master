import type { Finding, AnalysisResult } from './types'
import type { PageSignals } from './extract'

/**
 * Kann die Betreiberin tun, was hier empfohlen wird?
 *
 * Aus der Rückmeldung: „Ein Rahmen von fremder Adresse lässt sich nicht
 * direkt einbinden. Eine unmögliche Massnahme darf keine Priorität
 * bekommen." Das ist keine Kleinigkeit — eine Prioritätenliste, deren
 * erster Punkt nicht ausführbar ist, entwertet die ganze Liste. Wer einmal
 * an Punkt eins scheitert, liest Punkt zwei nicht mehr.
 *
 * Eingebetteter Fremdinhalt ist der häufigste Fall: Buchungssysteme,
 * Newsletter-Formulare, Kartendienste, Kursplattformen. Ihr Inhalt steht
 * sichtbar auf der Seite, gehört ihr aber nicht — Google zählt ihn nicht
 * zum Inhalt der Seite, und ändern lässt er sich nur beim Anbieter.
 */

/**
 * Ein Befund, der die Lage erklärt, statt Unmögliches zu fordern.
 *
 * Er kommt bewusst als eigener Punkt und nicht als Fussnote: Ohne ihn liest
 * sich „keine Überschriftenstruktur gefunden" wie ein Messfehler, und die
 * Betreiberin sucht auf ihrer Seite nach etwas, das dort nie stand.
 */
export function rahmenBefund(signals: PageSignals): Finding | null {
  const hosts = signals.fremdeHosts
  if (hosts.length === 0) return null

  // Ohne Überschriften aus dem Rahmen ist das ein normales Widget — ein
  // Newsletter-Feld unten auf der Seite ist kein Befund.
  if (signals.ueberschriftenAusRahmen === 0) return null

  const liste = hosts.slice(0, 3).join(', ')
  return {
    id: 'inhalt-aus-fremdem-rahmen',
    severity: 'longterm',
    title: `Ein Teil des Inhalts kommt aus einem fremden Rahmen (${liste})`,
    why:
      `${signals.ueberschriftenAusRahmen} Überschrift${signals.ueberschriftenAusRahmen === 1 ? '' : 'en'} ` +
      'stehen in eingebettetem Inhalt von einer anderen Adresse. Für Google gehört dieser Text nicht zu ' +
      'dieser Seite: Er wird nicht als ihr Inhalt gewertet und trägt nichts zu ihrer Platzierung bei. ' +
      'Alle Befunde unten beziehen sich deshalb nur auf den eigenen Inhalt der Seite.',
    action:
      'Prüfen, ob der Anbieter eine Einbindung ohne Rahmen anbietet. Wenn nicht: die wichtigsten Aussagen ' +
      'zusätzlich als eigenen Text auf die Seite schreiben — der Rahmen bleibt, wo er ist. ' +
      'Den Inhalt des Rahmens selbst kannst du über deine Seite nicht ändern.',
    effort: 'mittel',
    impact: 'mittel',
    evidence: `Eingebettet von: ${hosts.join(', ')}`,
  }
}

/**
 * Massnahmen, die niemand ausführen kann, verlieren ihre Dringlichkeit.
 *
 * Nicht gelöscht: Der Befund kann stimmen, und die Betreiberin soll ihn
 * kennen. Aber er darf nicht oben stehen und nicht "sofort" heissen, wenn
 * die Umsetzung nicht in ihrer Hand liegt. Der Hinweis darauf wird an die
 * Massnahme angehängt, damit sie nicht ratlos davorsteht.
 */
export function entschaerfeUnmoegliche(findings: Finding[], signals: PageSignals): Finding[] {
  if (signals.fremdeHosts.length === 0) return findings

  return findings.map((befund) => {
    if (!zieltAufFremdinhalt(befund, signals)) return befund
    return {
      ...befund,
      // Kritisch bleibt nur, was auch abstellbar ist.
      severity: befund.severity === 'critical' ? 'longterm' : befund.severity,
      action:
        `${befund.action} Achtung: Ein Teil des Inhalts dieser Seite kommt aus einem Rahmen von ` +
        `${signals.fremdeHosts.slice(0, 2).join(', ')}. Was dort steht, lässt sich über die eigene Seite ` +
        'weder ändern noch direkt übernehmen — umsetzbar ist das hier nur für den eigenen Inhalt.',
    }
  })
}

/**
 * Bezieht sich dieser Befund auf Inhalt, der im fremden Rahmen steckt?
 *
 * Bewusst eng gefasst. Ein zu weiter Filter entschärfte echte Befunde und
 * machte den Bericht zahnlos — deshalb nur die Fälle, in denen der Rahmen
 * nachweislich Überschriften mitbringt und der Befund genau davon handelt.
 */
function zieltAufFremdinhalt(befund: Finding, signals: PageSignals): boolean {
  if (signals.ueberschriftenAusRahmen === 0) return false
  return /(überschrift|gliederung|h1|h2|struktur)/i.test(`${befund.title} ${befund.why}`)
}

/**
 * Widersprüche im fertigen Bericht finden.
 *
 * Aus der Rückmeldung: „Wenn ein Redirect gemessen wurde, darf zehn Zeilen
 * später nicht stehen, dass beide Varianten antworten."
 *
 * Der eigentliche Schutz dagegen ist, dass es nur eine Quelle für die
 * Weiterleitung gibt (meta.abruf) und der Bericht daraus schreibt. Diese
 * Prüfung ist die Rückversicherung: Sie liest den fertigen Text und meldet,
 * wenn er der Messung widerspricht — das kann bei einem Text passieren, den
 * ein Sprachmodell formuliert hat.
 */
export function widersprueche(markdown: string, result: AnalysisResult): string[] {
  const gefunden: string[] = []
  const abruf = result.meta.abruf

  if (abruf.weitergeleitet) {
    // Formulierungen, die behaupten, es gäbe keine Weiterleitung.
    const behauptungen = [
      /beide\s+(varianten|fassungen|adressen)\s+[^.]{0,40}(antworten|erreichbar|liefern)/i,
      /(keine|kein)\s+weiterleitung/i,
      /ohne\s+weiterleitung\s+erreichbar/i,
    ]
    for (const muster of behauptungen) {
      const treffer = markdown.match(muster)
      if (treffer) {
        gefunden.push(
          `Gemessen wurde eine Weiterleitung von ${abruf.angefragt} nach ${abruf.ausgeliefert}, ` +
            `im Text steht aber: „${treffer[0].trim()}".`,
        )
      }
    }
  }

  // Eine Massnahme, die den Inhalt eines fremden Rahmens übernehmen will.
  if (result.meta.fremdinhalt.hosts.length > 0) {
    const treffer = markdown.match(/rahmen[^.]{0,60}(direkt\s+einbinden|direkt\s+übernehmen)/i)
    if (treffer) {
      gefunden.push(
        `Der Text empfiehlt, einen Rahmen „direkt einzubinden" — der Inhalt kommt aber von ` +
          `${result.meta.fremdinhalt.hosts.join(', ')} und lässt sich über die eigene Seite nicht ändern.`,
      )
    }
  }

  return gefunden
}

/**
 * Nur Gemessenes darf sofort sein.
 *
 * Die härteste Regel aus der Praxis-Rückmeldung, und die einzige, die
 * verhindert, dass eine Vermutung jemandem die Website kaputtmacht. Ein
 * Befund, der nicht selbst gemessen wurde, kann trotzdem richtig und
 * wichtig sein — er darf nur nicht an die Spitze einer Liste, der man
 * ungeprüft folgt.
 *
 * Herabgestuft, nicht gelöscht: Der Hinweis bleibt, er trägt nur die
 * Bitte, vorher nachzusehen.
 */
export function nurGemessenesIstSofort(findings: Finding[]): Finding[] {
  return findings.map((befund) => {
    const konfidenz = befund.konfidenz ?? 'gemessen'
    if (konfidenz === 'gemessen' || befund.severity !== 'critical') return befund
    return {
      ...befund,
      severity: 'longterm',
      action:
        `${befund.action} Dieser Befund ist ${konfidenz}, nicht gemessen — bitte im Browser ` +
        'gegenprüfen, bevor du etwas änderst.',
    }
  })
}
