/**
 * Funktionstest der Analyse-Kette.
 *
 * Prüft Tresor, Seitenauswertung und die Bewertungsraster gegen zwei
 * Beispielseiten: eine sorgfältig aufgebaute und eine mangelhafte. Der Test
 * belegt nicht nur, dass die Kette durchläuft, sondern auch, dass sie die
 * beiden Fälle deutlich unterscheidet – ein Bewertungsraster, das alles
 * gleich bewertet, wäre wertlos.
 *
 * Aufruf:  npm run smoke
 *          npm run smoke -- https://eigene-seite.de   (gegen eine Live-Seite)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { seal, open, hintOf } from '../src/lib/crypto/vault'
import { extractSignals } from '../src/lib/analysis/extract'
import { analyzeSeo } from '../src/lib/analysis/seo'
import { analyzeAeo } from '../src/lib/analysis/aeo'
import { analyzeGeo, parseRobots } from '../src/lib/analysis/geo'
import { extractPeopleAlsoAsk } from '../src/lib/analysis/serp'
import { analyzeSocial } from '../src/lib/analysis/social'
import {
  fuehreZusammen, fasseZusammen, leseVerlauf, lohnendeBegriffe, vergleichsform,
} from '../src/lib/keywords/research'
import { normalizeProfile } from '../src/lib/connectors/apify'
import { buildDeterministicReport, sortFindings } from '../src/lib/analysis/report'
import type { AnalysisResult, ModuleResult } from '../src/lib/analysis/types'

let failures = 0

function check(label: string, condition: boolean, detail = '') {
  console.log(`  ${condition ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!condition) failures++
}

function section(title: string) {
  console.log(`\n${title}`)
  console.log('─'.repeat(title.length))
}

// --- Tresor -----------------------------------------------------------------

function testVault() {
  section('Datentresor')
  const secret = { login: 'konto@example.com', password: 'streng-geheim-123456' }
  const sealed = seal(secret)

  check('Ver- und Entschlüsselung stimmt überein', JSON.stringify(open(sealed)) === JSON.stringify(secret))
  check('Klartext steckt nicht im Chiffrat', !sealed.ciphertext.includes('geheim'))
  check('Jeder Aufruf erzeugt einen neuen Initialisierungsvektor', seal(secret).iv !== sealed.iv)
  check('Hinweis verbirgt den Schlüssel', hintOf('sk-ant-api03-abcdefghijklmnop') === 'sk-a••••mnop')

  let rejected = false
  try {
    open({ ...sealed, ciphertext: Buffer.from('manipuliert').toString('base64') })
  } catch {
    rejected = true
  }
  check('Manipuliertes Chiffrat wird abgewiesen', rejected)
}

// --- Seitenauswertung -------------------------------------------------------

function analyzePage(name: string, html: string, url: string) {
  const signals = extractSignals({ url, html, statusCode: 200 })
  const robots = parseRobots(null)
  const seo = analyzeSeo({ signals, primaryKeyword: 'ki-beratung' })
  const aeo = analyzeAeo({ signals })
  const geo = analyzeGeo({ signals, robotsTxt: robots })
  return { name, signals, modules: [seo, aeo, geo] as ModuleResult[] }
}

function report(pages: ReturnType<typeof analyzePage>[]) {
  section('Bewertung im Vergleich')
  console.log('  Seite            SEO    AEO    GEO   Befunde  davon kritisch')
  for (const page of pages) {
    const [seo, aeo, geo] = page.modules
    const findings = page.modules.flatMap((m) => m.findings)
    const critical = findings.filter((f) => f.severity === 'critical').length
    console.log(
      `  ${page.name.padEnd(15)} ${seo.score.toFixed(1).padStart(4)}  ${aeo.score
        .toFixed(1)
        .padStart(5)}  ${geo.score.toFixed(1).padStart(5)}   ${String(findings.length).padStart(6)}  ${String(critical).padStart(13)}`,
    )
  }
}

function main() {
  testVault()

  const dir = join(__dirname, 'fixtures')
  const strong = analyzePage('sorgfältig', readFileSync(join(dir, 'gut.html'), 'utf8'), 'https://beispiel.de/ki-beratung')
  const weak = analyzePage('mangelhaft', readFileSync(join(dir, 'schwach.html'), 'utf8'), 'http://beispiel.de/')

  section('Signale der sorgfältigen Seite')
  const s = strong.signals
  console.log(`  Title: ${s.titleLength} Zeichen · Meta: ${s.metaDescriptionLength} Zeichen`)
  console.log(`  H1: ${s.h1.length} · H2: ${s.h2.length} · H3: ${s.h3.length} · Wörter: ${s.wordCount}`)
  console.log(`  Schema: ${s.schemaTypes.join(', ') || '—'}`)
  console.log(`  FAQ: ${s.faqBlocks.length} · Frage-Überschriften: ${s.questionHeadings.length}`)
  console.log(`  Zahlenaussagen: ${s.statistics.length} · Definitionen: ${s.definitions.length}`)
  console.log(`  Autor: ${s.authorNames.join(', ') || '—'} · aktualisiert: ${s.modifiedDate ?? '—'}`)
  console.log(`  Links: ${s.links.internal} intern / ${s.links.external} extern · Autoritätsquellen: ${s.citationsToAuthority}`)
  console.log(`  Bilder mit Alt: ${s.images.withAlt}/${s.images.total} · Tabellen: ${s.tables} · Listenpunkte: ${s.lists.itemsTotal}`)

  section('Auswertung erkennt die Seitenmerkmale')
  check('Title gelesen', s.title?.includes('KI-Beratung') === true)
  check('Meta Description gelesen', s.metaDescriptionLength > 100)
  check('Genau ein H1', s.h1.length === 1)
  check('Alle H2 gefunden', s.h2.length === 4, `${s.h2.length} gefunden`)
  check('JSON-LD ausgewertet', s.schemaTypes.includes('Article') && s.schemaTypes.includes('FAQPage'))
  check('FAQ-Einträge aus dem Schema gezogen', s.faqBlocks.length >= 5, `${s.faqBlocks.length} Einträge`)
  check('Frage-Überschriften erkannt', s.questionHeadings.length >= 3, `${s.questionHeadings.length} erkannt`)
  check('Zahlenaussagen erkannt', s.statistics.length >= 3, `${s.statistics.length} erkannt`)
  check('Definitionssätze erkannt', s.definitions.length >= 2, `${s.definitions.length} erkannt`)
  check('Autorin erkannt', s.hasAuthorInfo)
  check('Änderungsdatum erkannt', s.modifiedDate === '2026-08-01')
  check('Impressum und Datenschutz erkannt', s.hasImprint && s.hasPrivacyPolicy)
  check('Verweis auf Autoritätsquelle erkannt', s.citationsToAuthority >= 1)
  check('Tabelle erkannt', s.tables === 1)
  check('HTTPS erkannt', s.isHttps)

  // --- Kopfbereich ---------------------------------------------------------
  //
  // Der schwerwiegendste Fehler dieser Art: Wird das Dokument ohne <head>
  // ausgewertet, meldet die Analyse Title, Description und strukturierte
  // Daten als fehlend, obwohl sie vorhanden sind. Aus einem Messfehler werden
  // dann falsche Sofortmassnahmen.
  section('Fehlender Kopfbereich wird erkannt')
  const ohneKopf = extractSignals({
    url: 'https://beispiel.de/ki-beratung',
    html: readFileSync(join(dir, 'ohne-kopfbereich.html'), 'utf8'),
    statusCode: 200,
  })
  check('Dokument ohne <head> liefert keinen Title', ohneKopf.title === null)
  check('Body wird trotzdem gelesen', ohneKopf.h1.length === 1 && ohneKopf.h2.length === 4)
  check(
    'Kopfbereich-Prüfung erkennt die unvollständige Fassung',
    !/<head[\s>]/i.test(readFileSync(join(dir, 'ohne-kopfbereich.html'), 'utf8')),
    'der Lauf lädt in diesem Fall direkt nach',
  )

  // Die Ursache lag nicht in der Auswertung, sondern eine Stufe davor: beim
  // Abruf wurde 'rawHtml' nicht angefordert. Markdown kennt keinen Kopfbereich,
  // und 'html' liefert nur den aufbereiteten Inhalt. Diese Prüfung liest den
  // Quelltext des Anschlusses, damit die Anforderung nicht unbemerkt wieder
  // herausfällt – der Fehler war von aussen nicht als Messfehler erkennbar.
  const firecrawlQuelltext = readFileSync(
    join(dir, '..', '..', 'src', 'lib', 'connectors', 'firecrawl.ts'),
    'utf8',
  )
  const abrufFormate = firecrawlQuelltext.match(/formats: \[[^\]]*'rawHtml'[^\]]*\]/)
  check(
    'Der Seitenabruf fordert rawHtml an',
    abrufFormate !== null,
    abrufFormate ? abrufFormate[0] : 'ohne rawHtml bleibt der Kopfbereich leer',
  )

  section('Auswertung erkennt die Mängel der schwachen Seite')
  const w = weak.signals
  check('Fehlende Meta Description erkannt', w.metaDescription === null)
  check('Fehlendes H1 erkannt', w.h1.length === 0)
  check('Fehlendes Schema erkannt', w.schemaTypes.length === 0)
  check('Fehlendes HTTPS erkannt', !w.isHttps)
  check('Fehlende Alt-Texte erkannt', w.images.withAlt === 0 && w.images.total === 2)
  check('Nichtssagende Ankertexte erkannt', w.links.genericAnchors === 2)
  check('Dünner Inhalt erkannt', w.wordCount < 60, `${w.wordCount} Wörter`)
  check('Fehlende Rechtstexte erkannt', !w.hasImprint && !w.hasPrivacyPolicy)

  report([strong, weak])

  section('Bewertung unterscheidet die Fälle')
  for (let i = 0; i < 3; i++) {
    const label = strong.modules[i].module
    const better = strong.modules[i].score
    const worse = weak.modules[i].score
    check(
      `${label}: sorgfältige Seite deutlich besser bewertet`,
      better > worse + 2,
      `${better.toFixed(1)} gegenüber ${worse.toFixed(1)}`,
    )
  }
  check(
    'Sorgfältige Seite erhält keine Bestnote',
    strong.modules.every((m) => m.score < 9.5),
    'Bestnoten bleiben wirklich herausragenden Seiten vorbehalten',
  )
  check(
    'Schwache Seite erhält kritische Befunde',
    weak.modules.flatMap((m) => m.findings).filter((f) => f.severity === 'critical').length >= 4,
  )

  section('Befunde sind umsetzbar')
  const allFindings = [...strong.modules, ...weak.modules].flatMap((m) => m.findings)
  check('Jeder Befund nennt eine konkrete Massnahme', allFindings.every((f) => f.action.length > 25))
  check('Jeder Befund begründet die Dringlichkeit', allFindings.every((f) => f.why.length > 25))
  check('Keine doppelten Befunde je Seite', (() => {
    for (const page of [strong, weak]) {
      const ids = page.modules.flatMap((m) => m.findings.map((f) => f.id))
      if (new Set(ids).size !== ids.length) return false
    }
    return true
  })())

  section('Folgefragen werden gefiltert')
  const paa = extractPeopleAlsoAsk({
    keyword: 'ecamm live deutsch',
    items: [
      {
        type: 'people_also_ask',
        items: [
          { title: 'Was kostet Ecamm Live?' },
          { title: 'Gibt es Ecamm für Windows?' },
          { title: 'Wo kann man Livestreams kostenlos sehen?' },
          { title: 'Welche Streaming-Dienste gibt es?' },
        ],
      },
    ],
  })
  check('Fragen zum Thema bleiben', paa.includes('Was kostet Ecamm Live?') && paa.includes('Gibt es Ecamm für Windows?'))
  check('Fragen mit anderer Absicht fallen weg', !paa.includes('Wo kann man Livestreams kostenlos sehen?'), `übrig: ${paa.length} von 4`)

  section('Social-Profil')
  const profile = normalizeProfile('instagram', {
    username: 'beispiel',
    fullName: 'Maria Beispiel',
    biography: 'KI-Beratung für Solopreneure. Weniger Handarbeit, mehr Wirkung.',
    followersCount: 4200,
    postsCount: 180,
    externalUrl: 'https://beispiel.de',
    latestPosts: [
      { caption: 'Beitrag A', likesCount: 90, commentsCount: 12 },
      { caption: 'Beitrag B', likesCount: 70, commentsCount: 8 },
    ],
  })
  const social = analyzeSocial({ profile })
  check('Followerzahl übernommen', profile.followers === 4200)
  check('Interaktionsrate berechnet', profile.avgEngagement !== null, `${profile.avgEngagement?.toFixed(2)} %`)
  check('Bewertung im gültigen Bereich', social.score > 0 && social.score <= 10, `${social.score.toFixed(1)}/10`)

  // --- Keyword-Recherche ----------------------------------------------------
  //
  // Die Rohdaten enthalten dieselbe Suchanfrage in mehreren Schreibweisen mit
  // identischen Zahlen. Würden sie ungefiltert angezeigt, sähe eine Nachfrage
  // doppelt so gross aus, wie sie ist – und die Summen wären schlicht falsch.
  section('Keyword-Recherche fasst Schreibweisen zusammen')

  const roh = [
    kw('ki beratung', 2400, 18.37, 13, 'informational', 'MEDIUM'),
    kw('ki-beratung', 2400, 18.37, 13, 'informational', 'MEDIUM'),
    kw('beratung ki', 260, 13.08, 8, 'commercial', 'LOW'),
    kw('beratung-ki', 260, 35.27, 8, 'commercial', 'LOW'),
    kw('ki beratung mittelstand', 170, 19.68, null, 'informational', 'MEDIUM'),
    kw('ki beratung ohne nachfrage', 0, 4.0, 5, 'commercial', 'LOW'),
  ]

  const zeilen = fuehreZusammen(roh)
  check('Schreibvarianten werden zusammengefasst', zeilen.length === 3, `${zeilen.length} von 6 Rohdatensätzen`)
  check(
    'Die Form ohne Bindestrich gewinnt',
    zeilen.some((z) => z.begriff === 'ki beratung') && !zeilen.some((z) => z.begriff === 'ki-beratung'),
  )
  check('Bindestrich und Leerzeichen gelten als gleich', vergleichsform('ki-beratung') === vergleichsform('ki beratung'))
  check(
    'Andere Wortstellung bleibt eine eigene Suchanfrage',
    vergleichsform('beratung ki') !== vergleichsform('ki beratung'),
    '2.400 gegen 260 Suchen – zusammengelegt ginge die Unterscheidung verloren',
  )
  check(
    'Begriffe ohne Suchvolumen fallen weg',
    !zeilen.some((z) => z.begriff.includes('ohne nachfrage')),
  )
  check('Nach Suchvolumen sortiert', zeilen[0].suchvolumen >= zeilen[zeilen.length - 1].suchvolumen)

  const werbewert = zeilen.find((z) => z.begriff === 'ki beratung')?.anzeigenwert
  check('Werbewert = Volumen × Klickpreis', werbewert === Math.round(2400 * 18.37), `${werbewert} €`)

  const zusammen = fasseZusammen(zeilen)
  check(
    'Summen zählen jede Suchanfrage einmal',
    zusammen.suchenGesamt === 2400 + 260 + 170,
    `${zusammen.suchenGesamt}`,
  )
  check('Kaufabsicht wird getrennt ausgewiesen', zusammen.suchenMitKaufabsicht === 260)
  check(
    'Teuerster Begriff wird benannt',
    zusammen.teuersterBegriff?.begriff === 'ki beratung mittelstand',
    `${zusammen.teuersterBegriff?.begriff} (${zusammen.teuersterBegriff?.klickpreis} €)`,
  )

  // Ein Begriff ohne Schwierigkeitswert darf nicht als leicht erreichbar
  // gelten – sonst empfiehlt die Anzeige Arbeit auf ungeprüfter Grundlage.
  const lohnend = lohnendeBegriffe(zeilen)
  check(
    'Begriffe ohne Schwierigkeitswert gelten nicht als leicht',
    !lohnend.some((z) => z.schwierigkeit === null),
  )

  section('Zwölfmonatsverlauf wird aus beiden Datenformen gelesen')

  // Die REST-Schnittstelle liefert eine Liste, das MCP-Werkzeug ein Objekt.
  // Beide müssen denselben Verlauf ergeben, sonst bliebe die Kurve leer.
  const alsListe = leseVerlauf([
    { year: 2026, month: 6, search_volume: 200 },
    { year: 2026, month: 7, search_volume: 300 },
    { year: 2026, month: 5, search_volume: 100 },
  ])
  const alsObjekt = leseVerlauf({ '2026-07': 300, '2026-05': 100, '2026-06': 200 })
  check('Liste ergibt aufsteigende Monatswerte', JSON.stringify(alsListe) === '[100,200,300]', JSON.stringify(alsListe))
  check('Objekt ergibt denselben Verlauf', JSON.stringify(alsObjekt) === JSON.stringify(alsListe))
  check('Fehlender Verlauf bleibt leer', leseVerlauf(undefined).length === 0)

  section('Bericht')
  const result: AnalysisResult = {
    target: { url: 'https://beispiel.de/ki-beratung', kind: 'WEBSITE', domain: 'beispiel.de' },
    meta: {
      analyzedAt: new Date().toISOString(),
      pageType: 'Landing Page',
      language: 'de',
      market: 'Deutschland',
      modules: ['SEO', 'AEO', 'GEO'],
      providersUsed: [],
      skipped: [{ module: 'DataForSEO-Daten', reason: 'Im Test keine Zugangsdaten hinterlegt' }],
    },
    scores: {
      seo: strong.modules[0].score,
      aeo: strong.modules[1].score,
      geo: strong.modules[2].score,
      serp: null,
      overall: Math.round((strong.modules.reduce((a, m) => a + m.score, 0) / 3) * 10) / 10,
    },
    modules: strong.modules,
    priorities: sortFindings(strong.modules.flatMap((m) => m.findings)),
    executiveSummary: null,
  }

  const markdown = buildDeterministicReport(result)
  check('Bericht erzeugt', markdown.length > 800, `${markdown.length} Zeichen`)
  check('Bewertungstabelle enthalten', markdown.includes('## Gesamtbewertung'))
  check('Fehlende Daten werden ausgewiesen', markdown.includes('Nicht ausgeführt'))
  check('Kritische Befunde stehen vor langfristigen', (() => {
    const order = result.priorities.map((f) => f.severity)
    const lastCritical = order.lastIndexOf('critical')
    const firstLongterm = order.indexOf('longterm')
    return lastCritical === -1 || firstLongterm === -1 || lastCritical < firstLongterm
  })())

  console.log(`\n${failures === 0 ? '✓ Alle Prüfungen bestanden.' : `✗ ${failures} Prüfung(en) fehlgeschlagen.`}\n`)
  process.exit(failures === 0 ? 0 : 1)
}

// Optionaler Lauf gegen eine echte Seite.
/** Einen Rohdatensatz bauen, wie ihn DataForSEO liefert. */
function kw(
  keyword: string,
  search_volume: number,
  cpc: number,
  keyword_difficulty: number | null,
  main_intent: string,
  competition_level: string,
) {
  return {
    keyword,
    keyword_info: { search_volume, cpc, competition_level },
    keyword_properties: keyword_difficulty === null ? {} : { keyword_difficulty },
    search_intent_info: { main_intent },
  }
}

const liveUrl = process.argv[2]
if (liveUrl) {
  void (async () => {
    console.log(`\nLive-Abruf: ${liveUrl}`)
    const response = await fetch(liveUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SEO-Master/1.0)' },
      signal: AbortSignal.timeout(45_000),
    })
    const html = await response.text()
    const page = analyzePage('live', html, liveUrl)
    console.log(`  HTTP ${response.status} · ${page.signals.wordCount} Wörter · ${page.signals.schemaTypes.length} Schema-Typen`)
    for (const module of page.modules) {
      console.log(`  ${module.module}: ${module.score.toFixed(1)}/10 (${module.label}), ${module.findings.length} Befunde`)
    }
    console.log()
    main()
  })()
} else {
  main()
}
