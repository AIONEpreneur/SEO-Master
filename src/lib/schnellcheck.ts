import { redis } from '@/lib/queue'

/**
 * Schutz für den Schnell-Check.
 *
 * Die Schnittstelle ist ohne Anmeldung erreichbar und lädt eine fremde Seite
 * vom eigenen Server aus. Das braucht zwei Mauern:
 *
 * 1. Adressprüfung. Der Server darf nur ins offene Netz greifen – nicht auf
 *    sich selbst, nicht ins eigene Netzsegment, nicht auf Verwaltungsdienste.
 *    Sonst wird aus "prüfe meine Website" ein "lies die Datenbank des
 *    Betreibers" (SSRF).
 * 2. Ratenbegrenzung. Jeder Abruf kostet Rechenzeit und Bandbreite; ohne
 *    Grenze wird die Landingpage zum kostenlosen Abrufdienst für fremde
 *    Massenprüfungen.
 */

const GESPERRTE_HOSTS = /^(localhost|.*\.local|.*\.internal|.*\.lan|metadata\.google\.internal)$/i

/** Private, Loopback-, Link-Local- und Metadaten-Bereiche als Zahlbereiche. */
function istPrivateIpv4(host: string): boolean {
  const teile = host.split('.').map(Number)
  if (teile.length !== 4 || teile.some((t) => Number.isNaN(t) || t < 0 || t > 255)) return false
  const [a, b] = teile
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

export function zulaessigeAdresse(eingabe: string): { ok: true; url: URL } | { ok: false; grund: string } {
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(eingabe) ? eingabe : `https://${eingabe}`)
  } catch {
    return { ok: false, grund: 'Das ist keine gültige Adresse.' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, grund: 'Nur Web-Adressen (http/https) lassen sich prüfen.' }
  }
  // Nur Standard-Ports: Abweichende Ports zeigen fast immer auf Dienste,
  // nicht auf Websites – und genau die sollen unerreichbar bleiben.
  if (url.port && url.port !== '80' && url.port !== '443') {
    return { ok: false, grund: 'Adressen mit eigenem Port lassen sich hier nicht prüfen.' }
  }

  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (GESPERRTE_HOSTS.test(host)) return { ok: false, grund: 'Diese Adresse lässt sich hier nicht prüfen.' }
  if (istPrivateIpv4(host)) return { ok: false, grund: 'Diese Adresse lässt sich hier nicht prüfen.' }
  // IPv6-Literale pauschal ablehnen: Der Nutzen ist null (niemand prüft seine
  // Website über ein IPv6-Literal), die Angriffsfläche erheblich.
  if (host.includes(':')) return { ok: false, grund: 'Diese Adresse lässt sich hier nicht prüfen.' }
  if (!host.includes('.')) return { ok: false, grund: 'Bitte eine vollständige Adresse angeben.' }

  return { ok: true, url }
}

/** Abrufe je Absender und Tag. */
export const JE_ABSENDER = 5
/** Abrufe insgesamt und Tag – die Notbremse gegen verteilte Massenabrufe. */
export const GESAMT = 300

export async function zaehleUndPruefe(ip: string): Promise<{ ok: boolean; grund?: string }> {
  const tag = new Date().toISOString().slice(0, 10)
  const verbindung = redis()

  const [eigene, alle] = await Promise.all([
    verbindung.incr(`schnellcheck:${ip}:${tag}`),
    verbindung.incr(`schnellcheck:gesamt:${tag}`),
  ])
  // Ablauf nach zwei Tagen: die Schlüssel räumen sich selbst weg.
  await Promise.all([
    verbindung.expire(`schnellcheck:${ip}:${tag}`, 2 * 24 * 3600),
    verbindung.expire(`schnellcheck:gesamt:${tag}`, 2 * 24 * 3600),
  ])

  if (eigene > JE_ABSENDER) {
    return { ok: false, grund: 'Genug geprüft für heute – für mehr gibt es den vollständigen Zugang.' }
  }
  if (alle > GESAMT) {
    return { ok: false, grund: 'Der Schnell-Check ist für heute ausgelastet. Bitte morgen wiederkommen.' }
  }
  return { ok: true }
}
