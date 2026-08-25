import type { Finding } from './types'

/**
 * Auswertung des `checks`-Objekts aus der DataForSEO-OnPage-API.
 *
 * Die API liefert zu einer geprüften Adresse eine Reihe fertiger Flags. Bisher
 * wurde das Feld zwar deklariert, aber nirgends gelesen.
 *
 * Zwei Regeln, die diese Datei zusammenhalten:
 *
 * 1. Aufgenommen wird nur, was `true` = Mangel bedeutet. Die API liefert auch
 *    Flags, bei denen `true` gut ist (`is_https`, `has_html_doctype`,
 *    `seo_friendly_url`) – die stehen hier bewusst nicht drin, sonst würde ein
 *    fehlerfreier Zustand als Fehler gemeldet.
 * 2. Unbekannte Flags werden übergangen. Welche Schlüssel tatsächlich
 *    ankommen, hängt von der Seite und vom Antwortumfang ab; die Liste hier
 *    ist eine Auswahl, kein Abbild der API.
 *
 * Ausgelassen sind außerdem alle Flags, die wir selbst schon messen – Title,
 * H1, Description, Bild-Alt, HTTPS. Sonst stünde jeder Befund doppelt im
 * Bericht, einmal aus unserer Messung und einmal aus der API.
 */

type Mangel = {
  title: string
  why: string
  action: string
  effort: Finding['effort']
  impact: Finding['impact']
  severity: Finding['severity']
}

const MAENGEL: Record<string, Mangel> = {
  is_4xx_code: {
    title: 'Seite antwortet mit einem 4xx-Fehler',
    why: 'Eine Adresse, die einen Fehlercode zurückgibt, wird aus dem Index entfernt.',
    action: 'Server-Antwort prüfen: Seite wiederherstellen oder per 301 auf die neue Adresse umleiten.',
    effort: 'mittel',
    impact: 'hoch',
    severity: 'critical',
  },
  is_5xx_code: {
    title: 'Server antwortet mit einem 5xx-Fehler',
    why: 'Serverfehler führen dazu, dass Google die Seite nicht mehr abruft und irgendwann aus dem Index nimmt.',
    action: 'Server-Logs zum Zeitpunkt des Abrufs prüfen und die Ursache beheben.',
    effort: 'mittel',
    impact: 'hoch',
    severity: 'critical',
  },
  is_broken: {
    title: 'Seite ist nicht erreichbar',
    why: 'Eine nicht erreichbare Seite kann weder gelesen noch bewertet werden.',
    action: 'Erreichbarkeit im Browser und über die Server-Logs prüfen.',
    effort: 'mittel',
    impact: 'hoch',
    severity: 'critical',
  },
  canonical_to_broken: {
    title: 'Canonical zeigt auf eine kaputte Adresse',
    why: 'Die Seite benennt eine maßgebliche Fassung, die es nicht gibt – Google verwirft den Verweis und entscheidet selbst.',
    action: 'Das Canonical auf eine erreichbare Adresse setzen, im Zweifel auf die Seite selbst.',
    effort: 'gering',
    impact: 'hoch',
    severity: 'critical',
  },
  canonical_to_redirect: {
    title: 'Canonical zeigt auf eine Weiterleitung',
    why: 'Das Canonical soll die Endadresse benennen. Zeigt es auf eine Weiterleitung, kostet das bei jedem Abruf einen zusätzlichen Schritt.',
    action: 'Im Canonical direkt die Zieladresse der Weiterleitung eintragen.',
    effort: 'gering',
    impact: 'mittel',
    severity: 'quickwin',
  },
  has_meta_refresh_redirect: {
    title: 'Weiterleitung per Meta-Refresh',
    why: 'Meta-Refresh gilt als veraltet und gibt die Ranking-Signale der alten Adresse nicht zuverlässig weiter.',
    action: 'Meta-Refresh entfernen und stattdessen eine serverseitige 301-Weiterleitung einrichten.',
    effort: 'mittel',
    impact: 'mittel',
    severity: 'quickwin',
  },
  has_render_blocking_resources: {
    title: 'Skripte und Stylesheets blockieren den Aufbau',
    why: 'Blockierende Dateien verzögern den ersten sichtbaren Inhalt – das schlägt direkt auf die Ladezeit-Kennzahlen durch.',
    action: 'CSS für den sichtbaren Bereich einbetten, übrige Skripte mit `defer` oder `async` laden.',
    effort: 'mittel',
    impact: 'mittel',
    severity: 'quickwin',
  },
  no_content_encoding: {
    title: 'Seite wird unkomprimiert ausgeliefert',
    why: 'Ohne Komprimierung überträgt der Server ein Vielfaches an Daten – die Seite lädt langsamer, besonders mobil.',
    action: 'Beim Hoster gzip oder brotli aktivieren (bei Hostinger im hPanel unter den Website-Einstellungen).',
    effort: 'gering',
    impact: 'mittel',
    severity: 'quickwin',
  },
  high_loading_time: {
    title: 'Ladezeit auffällig hoch',
    why: 'Lange Ladezeiten kosten Besucher, bevor die Seite überhaupt sichtbar wird.',
    action: 'Bilder verkleinern, Komprimierung aktivieren, blockierende Skripte auflösen.',
    effort: 'mittel',
    impact: 'hoch',
    severity: 'quickwin',
  },
  high_waiting_time: {
    title: 'Server antwortet verzögert',
    why: 'Die Wartezeit bis zum ersten Byte entsteht auf dem Server, nicht im Browser – kein Bild und kein Skript ändert daran etwas.',
    action: 'Caching aktivieren oder mit dem Hoster die Antwortzeit prüfen.',
    effort: 'mittel',
    impact: 'mittel',
    severity: 'quickwin',
  },
  size_greater_than_3mb: {
    title: 'Seite ist größer als 3 MB',
    why: 'Über Mobilfunk dauert der Aufbau bei dieser Größe mehrere Sekunden.',
    action: 'Größte Dateien ermitteln – meist Bilder – und in WebP mit passender Auflösung ersetzen.',
    effort: 'mittel',
    impact: 'hoch',
    severity: 'quickwin',
  },
  large_page_size: {
    title: 'Seitengröße auffällig hoch',
    why: 'Je mehr Daten übertragen werden, desto später wird die Seite nutzbar.',
    action: 'Bilder und Schriften prüfen: passende Auflösung, moderne Formate, nicht benutzte Schriftschnitte entfernen.',
    effort: 'mittel',
    impact: 'mittel',
    severity: 'quickwin',
  },
  low_content_rate: {
    title: 'Wenig Text im Verhältnis zum Code',
    why: 'Steht im Quelltext deutlich mehr Technik als Inhalt, findet Google wenig, worauf sich ein Ranking stützen ließe.',
    action: 'Inhalt ausbauen – oder prüfen, ob überflüssige Einbindungen den Quelltext aufblähen.',
    effort: 'mittel',
    impact: 'mittel',
    severity: 'quickwin',
  },
  low_readability_rate: {
    title: 'Text ist schwer lesbar',
    why: 'Lange Sätze und Schachtelsätze kosten Verweildauer – und die Verweildauer ist das, was Google an der Seite abliest.',
    action: 'Sätze kürzen, Nebensätze auflösen, Zwischenüberschriften alle drei bis vier Absätze setzen.',
    effort: 'mittel',
    impact: 'mittel',
    severity: 'longterm',
  },
  duplicate_meta_tags: {
    title: 'Meta-Angaben mehrfach vorhanden',
    why: 'Stehen Title oder Description doppelt im Quelltext, sucht sich Google eine davon aus – nicht unbedingt die gewollte.',
    action: 'Quelltext im <head> prüfen und die doppelten Angaben entfernen. Häufige Ursache: Theme und SEO-Plugin setzen beide etwas.',
    effort: 'gering',
    impact: 'mittel',
    severity: 'quickwin',
  },
  deprecated_html_tags: {
    title: 'Veraltete HTML-Elemente im Quelltext',
    why: 'Veraltete Elemente werden von Browsern zwar noch angezeigt, erschweren aber die maschinelle Auswertung der Seite.',
    action: 'Betroffene Stellen im Theme durch aktuelle HTML-Elemente ersetzen.',
    effort: 'mittel',
    impact: 'gering',
    severity: 'longterm',
  },
  https_to_http_links: {
    title: 'Verweise auf unverschlüsselte Adressen',
    why: 'Eine https-Seite, die auf http verlinkt, gibt das Sicherheitsversprechen an dieser Stelle auf; Browser können den Inhalt blockieren.',
    action: 'Alle Verweise auf https umstellen.',
    effort: 'gering',
    impact: 'mittel',
    severity: 'quickwin',
  },
  lorem_ipsum: {
    title: 'Blindtext auf der Seite',
    why: 'Blindtext heißt: dieser Bereich wurde nie fertig befüllt. Für Besucher wirkt das unfertig, für Google ist es Inhalt ohne Bedeutung.',
    action: 'Blindtext durch echten Inhalt ersetzen oder den Bereich entfernen.',
    effort: 'gering',
    impact: 'mittel',
    severity: 'quickwin',
  },
  flash: {
    title: 'Flash-Inhalt eingebunden',
    why: 'Flash wird von keinem aktuellen Browser mehr ausgeführt – der Bereich ist für alle Besucher leer.',
    action: 'Flash-Einbindung entfernen und den Inhalt als HTML oder Video ersetzen.',
    effort: 'mittel',
    impact: 'hoch',
    severity: 'critical',
  },
  frame: {
    title: 'Inhalt steckt in einem Frame',
    why: 'Inhalt in einem Frame wird der Seite nicht zugerechnet – er zählt für ihr Ranking nicht mit.',
    action: 'Den Inhalt direkt in die Seite einbauen statt über einen Frame einzubinden.',
    effort: 'mittel',
    impact: 'hoch',
    severity: 'quickwin',
  },
  no_favicon: {
    title: 'Kein Favicon hinterlegt',
    why: 'Das Favicon erscheint im Suchergebnis auf dem Handy neben der Adresse – fehlt es, wirkt der Eintrag beliebig.',
    action: 'Favicon als .ico oder .svg im Wurzelverzeichnis ablegen und im <head> verlinken.',
    effort: 'gering',
    impact: 'gering',
    severity: 'quickwin',
  },
}

export type OnPageMangel = { schluessel: string } & Mangel

/** Liest die gemeldeten Flags und gibt nur die bekannten Mängel zurück. */
export function leseChecks(checks: Record<string, boolean> | null | undefined): OnPageMangel[] {
  if (!checks) return []
  return Object.entries(checks)
    .filter(([schluessel, gesetzt]) => gesetzt === true && schluessel in MAENGEL)
    .map(([schluessel]) => ({ schluessel, ...MAENGEL[schluessel] }))
}

export function checkBefunde(maengel: OnPageMangel[]): Finding[] {
  return maengel.map((m) => ({
    id: `onpage-${m.schluessel.replace(/_/g, '-')}`,
    severity: m.severity,
    title: m.title,
    why: m.why,
    action: m.action,
    effort: m.effort,
    impact: m.impact,
  }))
}

/**
 * Note für das technische Kriterium. Ein schwerer Mangel wiegt drei Punkte,
 * ein leichter einen – so schlägt ein 5xx-Fehler stärker durch als ein
 * fehlendes Favicon.
 */
export function checkNote(maengel: OnPageMangel[]): number {
  const abzug = maengel.reduce((summe, m) => {
    if (m.severity === 'critical') return summe + 3
    if (m.severity === 'quickwin') return summe + 1.5
    return summe + 0.5
  }, 0)
  return Math.max(0, Math.min(10, 10 - abzug))
}
