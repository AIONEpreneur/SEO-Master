/**
 * Prüft, ob eine Domain auf den gewünschten Server zeigt.
 *
 * Fragt zuerst die autoritativen Nameserver der Domain direkt. Das ist der
 * entscheidende Punkt: Der Resolver des eigenen Rechners liefert nach einer
 * Änderung noch minutenlang den alten Wert und lässt eine korrekte Umstellung
 * wie einen Fehlschlag aussehen.
 *
 *   node deploy/dns-check.mjs seo-master.aionepreneur.com 203.0.113.10
 */
import { Resolver } from 'node:dns/promises'
import { resolve4 as systemResolve4, resolve6 as systemResolve6 } from 'node:dns/promises'

const GRUEN = '\x1b[32m', ROT = '\x1b[31m', GELB = '\x1b[33m', GRAU = '\x1b[90m', AUS = '\x1b[0m'

const [domain, zielIp] = process.argv.slice(2)

if (!domain) {
  console.log('\nAufruf:  node deploy/dns-check.mjs <domain> [erwartete-ip]\n')
  process.exit(1)
}

/** Nameserver der übergeordneten Zone finden (Subdomains haben selbst keine). */
async function autoritativeServer(name) {
  const teile = name.split('.')
  const standard = new Resolver()
  for (let i = 0; i < teile.length - 1; i++) {
    const zone = teile.slice(i).join('.')
    try {
      const server = await standard.resolveNs(zone)
      if (server.length) return { zone, server }
    } catch {
      // Diese Ebene führt keine eigene Zone – eine Ebene höher weitersuchen.
    }
  }
  return { zone: null, server: [] }
}

async function frageServer(hostname, name) {
  const adressen = await systemResolve4(hostname)
  const r = new Resolver()
  r.setServers([adressen[0]])
  const antwort = { a: [], aaaa: [] }
  try {
    antwort.a = await r.resolve4(name)
  } catch { /* kein A-Eintrag */ }
  try {
    antwort.aaaa = await r.resolve6(name)
  } catch { /* kein AAAA-Eintrag */ }
  return antwort
}

console.log(`\n${GRAU}${domain}${AUS}\n`)

let fehler = 0
let autoritativA = null

const { zone, server } = await autoritativeServer(domain)

if (server.length === 0) {
  console.log(`  ${GELB}!${AUS} Keine autoritativen Nameserver gefunden – es gilt die Auskunft des eigenen Resolvers.\n`)
} else {
  console.log(`  ${GRAU}Autoritativ für ${zone}: ${server.join(', ')}${AUS}\n`)
  for (const s of server.slice(0, 2)) {
    try {
      const { a, aaaa } = await frageServer(s, domain)
      autoritativA ??= a
      console.log(`  ${s}`)
      console.log(`    A    ${a.join(', ') || '—'}`)
      console.log(`    AAAA ${aaaa.join(', ') || '—'}`)
      if (aaaa.length) fehler++
    } catch (e) {
      console.log(`  ${s}: ${GELB}nicht erreichbar (${e.code ?? e.message})${AUS}`)
    }
  }
  console.log()
}

// Zum Vergleich, was der eigene Rechner gerade sieht.
let lokalA = []
try { lokalA = await systemResolve4(domain) } catch { /* löst nicht auf */ }
let lokalAAAA = []
try { lokalAAAA = await systemResolve6(domain) } catch { /* kein AAAA */ }

console.log(`  ${GRAU}Eigener Rechner sieht: ${lokalA.join(', ') || '—'}${lokalAAAA.length ? ` / ${lokalAAAA.join(', ')}` : ''}${AUS}\n`)

const massgeblich = autoritativA ?? lokalA

if (massgeblich.length === 0) {
  if (lokalAAAA.length) {
    // Nur IPv6 ist etwas anderes als gar nichts – und für einen VPS ohne
    // IPv6 genau der Zustand, der später Zugriffe ins Leere laufen lässt.
    console.log(`  ${ROT}✗${AUS} Kein A-Record (IPv4) vorhanden, nur AAAA (IPv6).`)
    console.log(`  ${GRAU}Für einen VPS ohne IPv6 gehört hier ein A-Record hin.${AUS}\n`)
  } else {
    console.log(`  ${ROT}✗${AUS} Die Domain löst nicht auf.`)
    console.log(`  ${GRAU}Entweder fehlt der Eintrag noch, oder er ist noch nicht verteilt.${AUS}\n`)
  }
  process.exit(1)
}

if (zielIp) {
  if (massgeblich.includes(zielIp)) {
    console.log(`  ${GRUEN}✓${AUS} Zeigt auf ${zielIp}`)
  } else {
    console.log(`  ${ROT}✗${AUS} Zeigt auf ${massgeblich.join(', ')}, erwartet war ${zielIp}`)
    console.log(`  ${GRAU}A-Record im DNS-Panel auf ${zielIp} ändern.${AUS}`)
    fehler++
  }
}

if (massgeblich.length > 1) {
  console.log(`  ${GELB}!${AUS} Mehrere A-Records. Für einen VPS gehört dort genau einer hin.`)
  fehler++
}

if (lokalAAAA.length) {
  console.log(`  ${GELB}!${AUS} AAAA-Einträge vorhanden – Browser versuchen IPv6 zuerst.`)
  fehler++
}

// Der häufigste Stolperstein: umgestellt, aber der eigene Resolver hängt noch.
if (autoritativA && lokalA.length && !lokalA.every((ip) => autoritativA.includes(ip))) {
  console.log(`\n  ${GELB}!${AUS} Der eigene Rechner sieht noch den alten Wert (Zwischenspeicher).`)
  console.log(`  ${GRAU}Für die Einrichtung zählt die Auskunft der autoritativen Server – die stimmt.${AUS}`)
  console.log(`  ${GRAU}Lokal löst sich das von selbst, meist innerhalb einer Stunde.${AUS}`)
}

console.log()
if (fehler === 0 && zielIp) {
  console.log(`  ${GRUEN}Alles bereit für die Einrichtung.${AUS}\n`)
} else if (!zielIp) {
  console.log(`  ${GRAU}Zum Prüfen die erwartete IP mit angeben.${AUS}\n`)
} else {
  console.log(`  ${GRAU}Nach einer Änderung dauert es meist 5–30 Minuten. Danach erneut prüfen.${AUS}\n`)
}
