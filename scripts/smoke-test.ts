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
import { analyzeSerp, extractPeopleAlsoAsk } from '../src/lib/analysis/serp'
import { analyzeSocial } from '../src/lib/analysis/social'
import {
  fuehreZusammen, fasseZusammen, leseVerlauf, lohnendeBegriffe, vergleichsform,
} from '../src/lib/keywords/research'
import { deckungsgrad, enthaeltBegriff, grundform, teileMarke, tragenderBegriff, wortfolge } from '../src/lib/analysis/begriffe'
import { beurteile, begriffsBefund, istZuAllgemein, messbare } from '../src/lib/analysis/keyword-pruefung'
import { beurteileKanonisch, kanonischerBefund, kanonischeNote } from '../src/lib/analysis/kanonisch'
import { bezeichnung, wiederkehrendeBefunde } from '../src/lib/analysis/wiederkehrend'
import { VERWENDETE_ANBIETER } from '../src/lib/connectors/credentials'
import { leseChecks, checkBefunde, checkNote } from '../src/lib/analysis/onpage-checks'
import { istAllgemeinePlattform } from '../src/lib/analysis/geo'
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

  // Zweite Stufe desselben Problems: Firecrawl darf ohne Angabe eine
  // gespeicherte Fassung der Seite ausliefern. Der Bericht bewertet dann einen
  // alten Stand, ohne dass irgendwo ein Fehler auftaucht. maxAge: 0 erzwingt
  // den frischen Abruf – die Prüfung hält das fest.
  check(
    'Der Seitenabruf erzwingt eine frische Fassung',
    /maxAge:\s*0\b/.test(firecrawlQuelltext),
    'ohne maxAge: 0 kann Firecrawl den Stand von vorgestern liefern',
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

  // --- Begriffsvergleich ----------------------------------------------------
  //
  // Die teuerste Fehlerklasse dieses Werkzeugs: Ein Messfehler wird zur
  // Sofortmassnahme. Auf einer echten Seite meldete die Analyse, das
  // Hauptkeyword fehle in Title, H1 und Meta Description – es stand an allen
  // drei Stellen, nur mit Bindestrich geschrieben.
  section('Bindestrich und Wortgrenze')

  const title = 'Online-Business für Frauen aufbauen — ShEO Club | 47 €/Monat'
  check('Bindestrich zählt als Worttrenner', enthaeltBegriff(title, 'online business'))
  check('Auch umgekehrt geschrieben', enthaeltBegriff('online business aufbauen', 'Online-Business'))
  check('Satzzeichen stören nicht', enthaeltBegriff('Was ist Online-Business? Gute Frage.', 'online business'))
  check(
    'Kein Treffer mitten im Wort',
    !enthaeltBegriff('Zurück zur Startseite', 'art'),
    '"art" steckt in "Startseite"',
  )
  check('Leerer Begriff trifft nie', !enthaeltBegriff(title, '   '))
  check('Umlaute bleiben erhalten', wortfolge('Für Anfänger') === 'für anfänger')

  section('Hauptkeyword aus der Überschrift')

  check(
    'Füllwörter fallen weg',
    tragenderBegriff('Dein Online-Business — ohne alles allein rauszufinden') === 'online business',
    tragenderBegriff('Dein Online-Business — ohne alles allein rauszufinden') ?? 'null',
  )
  check(
    'Markenzusatz wird abgeschnitten',
    tragenderBegriff('KI-Beratung für Solopreneure | Kirsten Biema') === 'ki beratung solopreneure',
    tragenderBegriff('KI-Beratung für Solopreneure | Kirsten Biema') ?? 'null',
  )
  check('Nur Füllwörter ergeben nichts', tragenderBegriff('Das ist alles') === null)

  // Für Themenlücken zählt der Deckungsgrad, nicht die exakte Wortfolge.
  const seite = 'KI-Beratung für Solopreneure. Was kostet KI-Beratung?'
  check('Andere Wortform zählt als abgedeckt', deckungsgrad(seite, 'ki beratung kosten') === 1)
  check('Fremdes Thema nicht', deckungsgrad(seite, 'ki tools für steuerberater') < 0.5)
  check('Füllwörter zählen nicht mit', deckungsgrad(seite, 'die kosten der beratung') === 1)
  check(
    'Kurze Fachwörter überleben',
    tragenderBegriff('KI-Beratung für Solopreneure') === 'ki beratung solopreneure',
    tragenderBegriff('KI-Beratung für Solopreneure') ?? 'null',
  )
  check(
    'Kurze Füllwörter nicht',
    tragenderBegriff('Sichtbarkeit im Netz') === 'sichtbarkeit netz',
    tragenderBegriff('Sichtbarkeit im Netz') ?? 'null',
  )

  section('Allgemeine Plattformen sind keine Wettbewerber um Zitierfähigkeit')

  check('Instagram fällt raus', istAllgemeinePlattform('www.instagram.com'))
  check('Promi-Magazin fällt raus', istAllgemeinePlattform('bunte.de'))
  check('Subdomain fällt mit raus', istAllgemeinePlattform('de.wikipedia.org'))
  check('Fachdomain bleibt', !istAllgemeinePlattform('kirstenbiema.com'))

  // --- Widersprüche im Bericht ----------------------------------------------
  //
  // Der Bericht darf nicht empfehlen, was er zwei Abschnitte vorher als
  // vorhanden ausgewiesen hat.
  section('Bericht widerspricht sich nicht')

  const mitPersonSchema = analyzeSeo({
    signals: { ...weak.signals, schemaTypes: ['WebSite', 'Person', 'FAQPage'], hasAuthorInfo: false },
  })
  const autorBefund = mitPersonSchema.findings.find((f) => f.id === 'seo-author-missing')
  check('Autorenbefund erscheint', Boolean(autorBefund))
  check(
    'Bei vorhandenem Person-Schema wird es nicht erneut gefordert',
    !/`Person`-Schema auszeichnen/.test(autorBefund?.action ?? ''),
    autorBefund?.title,
  )

  const ohnePersonSchema = analyzeSeo({
    signals: { ...weak.signals, schemaTypes: ['WebSite'], hasAuthorInfo: false },
  })
  check(
    'Ohne Person-Schema wird es sehr wohl gefordert',
    /`Person`-Schema auszeichnen/.test(
      ohnePersonSchema.findings.find((f) => f.id === 'seo-author-missing')?.action ?? '',
    ),
  )

  // --- Spam-Score -----------------------------------------------------------
  //
  // Ein Mittelwert über 16 Domains ist kein Befund. Wer ihn als solchen
  // ausweist, schickt Leute in stundenlange Disavow-Arbeit ohne Effekt.
  section('Spam-Score wird eingeordnet, nicht alarmiert')

  const wenigDomains = analyzeSeo({
    signals: weak.signals,
    backlinks: { backlinks: 18, referring_main_domains: 16, backlinks_spam_score: 44 },
  })
  const spamKlein = wenigDomains.findings.find((f) => f.id === 'seo-spam-score')
  check('Befund erscheint', Boolean(spamKlein))
  check('Er rät ausdrücklich zum Nichtstun', /Nichts unternehmen/.test(spamKlein?.action ?? ''), spamKlein?.action?.slice(0, 40))
  check('Er ist nicht dringlich', spamKlein?.severity === 'longterm')

  const vieleDomains = analyzeSeo({
    signals: weak.signals,
    backlinks: { backlinks: 900, referring_main_domains: 140, backlinks_spam_score: 44 },
  })
  const spamGross = vieleDomains.findings.find((f) => f.id === 'seo-spam-score')
  check('Bei vielen Domains wird geprüft statt beruhigt', /durchsehen/.test(spamGross?.action ?? ''))

  const backlinkWert = (r: typeof wenigDomains) =>
    r.criteria.find((c) => c.key === 'backlinks')?.score ?? -1
  check(
    'Bei wenigen Domains kostet der Spam-Score keine Punkte',
    backlinkWert(wenigDomains) === backlinkWert(
      analyzeSeo({
        signals: weak.signals,
        backlinks: { backlinks: 18, referring_main_domains: 16, backlinks_spam_score: 2 },
      }),
    ),
  )


  // --- Umgebungsvariablen erreichen die Container ---------------------------
  //
  // Die Compose-Dateien reichen die Variablen einzeln durch. Wer eine neue
  // in env.ts aufnimmt und hier vergisst, bekommt keinen Fehler: Die
  // Anwendung startet, die Variable ist im Container schlicht leer, und das
  // Merkmal fehlt ohne jede Meldung. Genau das ist mit den Google-Variablen
  // passiert – der Anmelde-Knopf blieb unsichtbar, obwohl die Werte in der
  // .env standen.
  section('Jede Anbieter-Variable erreicht Web und Worker')

  const envQuelle = readFileSync(join(dir, '..', '..', 'src', 'lib', 'env.ts'), 'utf8')

  // Variablen, die im Container aus der Compose-Datei selbst kommen und
  // deshalb nicht aus der .env durchgereicht werden müssen.
  const AUS_COMPOSE = new Set(['NODE_ENV', 'DATABASE_URL', 'REDIS_URL', 'ALLOW_PUBLIC_SIGNUP'])

  // Variablen, die nur die Weboberfläche braucht. Der Worker führt Analysen
  // aus und hat mit Registrierungen nichts zu tun.
  const NUR_WEB = new Set(['ALLOWED_SIGNUP_EMAILS'])

  const erwartet = [...envQuelle.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):\s*z\./gm)]
    .map((m) => m[1])
    .filter((name) => !AUS_COMPOSE.has(name))

  check('Variablen im Schema gefunden', erwartet.length >= 10, `${erwartet.length} Stück`)

  for (const datei of ['docker-compose.prod.yml', 'docker-compose.vps.yml']) {
    const compose = readFileSync(join(dir, '..', '..', datei), 'utf8')
    // Je Dienst den Block ab "environment:" bis zur nächsten Einrückungsebene.
    const bloecke = [...compose.matchAll(/^  (web|worker):$([\s\S]*?)(?=^  \w|\Z)/gm)]
    check(`${datei}: web und worker gefunden`, bloecke.length === 2, `${bloecke.length}`)

    for (const [, dienst, block] of bloecke) {
      const noetig = dienst === 'worker' ? erwartet.filter((n) => !NUR_WEB.has(n)) : erwartet
      const fehlend = noetig.filter((name) => !block.includes(`${name}:`))
      check(
        `${datei} · ${dienst} reicht alle Variablen durch`,
        fehlend.length === 0,
        fehlend.length ? `fehlt: ${fehlend.join(', ')}` : `${noetig.length} geprüft`,
      )
    }
  }

  // --- Wortformen -----------------------------------------------------------
  //
  // Zweiter Fehlbefund derselben Art: Title und H1 lauteten wörtlich
  // "KI-Beratung für Solopreneurinnen ab 40", geprüft wurde gegen
  // "ki-beratung solopreneure" – und der Bericht meldete, das Hauptkeyword
  // fehle an beiden Stellen.
  section('Weibliche und gebeugte Formen gelten als dasselbe Wort')

  check('Solopreneurinnen und Solopreneure', grundform('Solopreneurinnen') === grundform('Solopreneure'),
    `${grundform('Solopreneurinnen')} / ${grundform('Solopreneure')}`)
  check('Beraterin und Berater', grundform('Beraterin') === grundform('Berater'))
  check('Beratung bleibt Beratung', grundform('Beratung') === 'beratung', grundform('Beratung'))
  check('Beratungen wird zu Beratung', grundform('Beratungen') === 'beratung', grundform('Beratungen'))
  check('Umlaute werden aufgelöst', grundform('Übersicht') === 'ubersicht', grundform('Übersicht'))
  check('Kurze Wörter bleiben unangetastet', grundform('ki') === 'ki')

  const echterTitle = 'KI-Beratung für Solopreneurinnen ab 40'
  check(
    'Das Hauptkeyword gilt als platziert',
    deckungsgrad(echterTitle, 'ki-beratung solopreneure') === 1,
    `${deckungsgrad(echterTitle, 'ki-beratung solopreneure')}`,
  )
  check(
    'Ein fremdes Thema aber nicht',
    deckungsgrad(echterTitle, 'buchhaltung für handwerker') < 0.4,
  )
  check(
    'Kurze Wörter finden nicht wahllos',
    deckungsgrad('Kinder in der Kiste', 'ki beratung') < 0.6,
    '"ki" darf nicht in "Kinder" treffen',
  )

  // --- Suchvolumen vor Bewertung --------------------------------------------
  //
  // Der teuerste Fehler, den dieses Werkzeug machen kann: eine Note, die aus
  // der Eingabe folgt statt aus einer Messung. Ein SERP-Wert von 1,8 sah aus
  // wie ein Urteil über die Website – tatsächlich hatten vier von fünf
  // eingegebenen Begriffen kein messbares Suchvolumen.
  section('Begriffe ohne Nachfrage erzeugen keine Note')

  check('Einzelnes Kurzwort gilt als zu allgemein', istZuAllgemein('KI'))
  check('Auch in anderer Schreibweise', istZuAllgemein(' ai '))
  check('Zwei Wörter nicht', !istZuAllgemein('ki beratung'))
  check('Längeres Einzelwort nicht', !istZuAllgemein('solopreneur'))

  const volumen = new Map<string, number | null>([
    ['ki beratung', 2400],
    ['ki beratung solopreneure', null],
    ['solopreneure', 720],
    ['nischenwort', 4],
  ])
  const urteile = beurteile(
    ['KI-Beratung', 'KI-Beratung Solopreneure', 'Solopreneure', 'KI', 'Nischenwort'],
    volumen,
  )

  check('Gesuchter Begriff gilt als messbar', urteile[0].urteil === 'messbar', `${urteile[0].volumen}`)
  check('Begriff ohne Volumen wird aussortiert', urteile[1].urteil === 'ohne-volumen')
  check('Kurzwort wird als zu allgemein aussortiert', urteile[3].urteil === 'zu-allgemein')
  check('Vier Suchen im Monat zählen nicht als Nachfrage', urteile[4].urteil === 'ohne-volumen', 'Schwelle liegt bei 10')
  check(
    'Nur messbare Begriffe werden abgefragt',
    messbare(urteile).length === 2,
    `${messbare(urteile).join(', ')}`,
  )
  check(
    'Grossschreibung stört die Zuordnung nicht',
    urteile[2].volumen === 720,
    'die Eingabe kam als "Solopreneure", das Volumen als "solopreneure"',
  )

  const befund = begriffsBefund(urteile, [
    { begriff: 'notebooklm kosten', volumen: 1600 },
    { begriff: 'ki agent erstellen', volumen: 1900 },
  ])
  check('Ein Befund über die Eingabe entsteht', Boolean(befund))
  check('Er ist kein Mangel, sondern ein Hebel', befund?.severity === 'quickwin')
  check('Er nennt Alternativen mit Volumen', /notebooklm kosten/.test(befund?.why ?? ''))
  check(
    'Er erklärt Positionierungswörter',
    /Positionierungswörter/.test(befund?.action ?? ''),
    'sie gehören auf die Seite, taugen aber nicht als Messgrösse',
  )

  const alleUntauglich = beurteile(['KI', 'AI'], new Map())
  const ohneAlternativen = begriffsBefund(alleUntauglich, [])
  check(
    'Ohne Alternativen bleibt der Hinweis ehrlich',
    /kein Suchmarkt/.test(ohneAlternativen?.why ?? ''),
  )
  check(
    'Sind alle untauglich, sagt der Titel das',
    /Keiner der geprüften Begriffe/.test(ohneAlternativen?.title ?? ''),
  )
  check('Nichts Messbares bleibt übrig', messbare(alleUntauglich).length === 0)

  // Die eigentliche Sperre: Aus untauglichen Begriffen darf keine Zahl werden.
  const serpOhneNachfrage = analyzeSerp({
    domain: 'beispiel.de',
    serps: [],
    begriffsUrteile: alleUntauglich,
    begriffsAlternativen: [],
  })
  const platzierungen = serpOhneNachfrage.criteria.find((c) => c.key === 'positions')
  check(
    'Platzierungen sind nicht bewertbar statt schlecht bewertet',
    platzierungen?.status === 'unknown',
    platzierungen?.detail?.slice(0, 60),
  )
  check(
    'Kein Sofortbefund "nirgends platziert"',
    !serpOhneNachfrage.findings.some((f) => f.id === 'serp-not-ranking'),
    'die Website steht hier nicht zur Debatte, die Eingabe schon',
  )
  check(
    'Stattdessen der Hinweis auf die Eingabe',
    serpOhneNachfrage.findings.some((f) => f.id === 'keyword-ohne-nachfrage'),
  )

  section('Markenzusatz im Title zählt nicht gegen die Aussage')

  // Der echte Title von kirstenbiema.com/blog/was-kostet-claude/: 75 Zeichen
  // gesamt, 59 ohne den Namen. Abgeschnitten wird der Name, nicht die Aussage.
  const claudeTitle = 'Was kostet Claude AI 2026? Preise in Euro, netto und brutto | Kirsten Biema'
  const geteilt = teileMarke(claudeTitle)
  check('Der Markenzusatz wird abgetrennt', geteilt.marke === 'Kirsten Biema')
  check('Die Aussage bleibt vollständig', geteilt.kern.length === 59, `${geteilt.kern.length} Zeichen`)
  check('Der Title misst insgesamt 75 Zeichen', claudeTitle.length === 75)

  const mitMarke = analyzeSeo({
    signals: { ...strong.signals, title: claudeTitle, titleLength: claudeTitle.length },
  })
  check(
    'Kein Befund "Title zu lang"',
    !mitMarke.findings.some((f) => f.id === 'seo-title-long'),
    'die Aussage steht bei Zeichen 1–59 und wird nicht abgeschnitten',
  )
  const titelWert = mitMarke.criteria.find((c) => c.key === 'title')
  check('Der Title wird trotzdem bewertet', (titelWert?.score ?? 0) >= 7, titelWert?.detail)
  check('Die Begründung nennt beide Längen', /75 Zeichen/.test(titelWert?.detail ?? '') && /59/.test(titelWert?.detail ?? ''))

  // Gegenprobe: Ist die Aussage selbst zu lang, bleibt der Befund.
  const langeAussage =
    'Was kostet Claude AI 2026 und welcher Tarif lohnt sich für Selbstständige wirklich | Kirsten Biema'
  const zuLang = analyzeSeo({ signals: { ...strong.signals, title: langeAussage, titleLength: langeAussage.length } })
  check(
    'Zu lange Aussage wird weiterhin gemeldet',
    zuLang.findings.some((f) => f.id === 'seo-title-long'),
  )
  check(
    'Der Befund sagt, dass der Markenzusatz bleiben darf',
    /Markenzusatz kann bleiben/.test(zuLang.findings.find((f) => f.id === 'seo-title-long')?.action ?? ''),
  )
  check(
    'Ein Gedankenstrich mitten im Satz gilt nicht als Marke',
    teileMarke('Preise vergleichen – Euro, netto und brutto im Überblick').marke === null,
    'sonst würde die halbe Aussage als Markenname gelten',
  )

  section('Leeres alt="" ist kein Mangel')

  const bildSeite = extractSignals({
    url: 'https://beispiel.de/artikel',
    html: `<html><head><title>Test</title></head><body>
      <img src="/img/header.png" alt="Preistabelle für Claude">
      <img src="/img/trenner.svg" alt="">
      <img src="/img/screenshot.png">
    </body></html>`,
  })
  check('Alle drei Bilder gezählt', bildSeite.images.total === 3)
  check('Eines mit beschreibendem Alt-Text', bildSeite.images.withAlt === 1)
  check(
    'Das leere alt="" gilt als schmückend, nicht als Lücke',
    bildSeite.images.decorative === 1,
    'alt="" ist die vorgeschriebene Kennzeichnung, kein Versäumnis',
  )
  check('Nur das fehlende Attribut ist ein Mangel', bildSeite.images.withoutAlt === 1)
  check(
    'Der Befund nennt die Datei',
    bildSeite.images.missingAltSources.includes('screenshot.png'),
    bildSeite.images.missingAltSources.join(', '),
  )

  const bildBefund = analyzeSeo({ signals: bildSeite }).findings.find((f) => f.id === 'seo-alt-texts')
  check('Genau ein Bild wird gemeldet', /^1 Bild ohne/.test(bildBefund?.title ?? ''), bildBefund?.title)
  check('Die Datei steht im Befund', /screenshot\.png/.test(bildBefund?.action ?? ''))
  check(
    'Der Befund erklärt, dass alt="" richtig sein kann',
    /ausdrücklich richtig/.test(bildBefund?.action ?? ''),
    'sonst wird eine korrekte Auszeichnung "repariert"',
  )

  const alleVersorgt = extractSignals({
    url: 'https://beispiel.de/a',
    html: '<html><head><title>T</title></head><body><img src="a.png" alt="Ein Bild"><img src="b.png" alt=""></body></html>',
  })
  check(
    'Sind alle Bilder versorgt, entsteht kein Befund',
    !analyzeSeo({ signals: alleVersorgt }).findings.some((f) => f.id === 'seo-alt-texts'),
  )
  check(
    'Kurzer Alt-Text zählt als Alt-Text',
    extractSignals({
      url: 'https://beispiel.de/a',
      html: '<html><head><title>T</title></head><body><img src="a.png" alt="KI"></body></html>',
    }).images.withAlt === 1,
    'die alte Regel verlangte mehr als zwei Zeichen',
  )

  section('AEO wird nicht hinter das Ranking gestellt')

  // Der Befund und die Regel im Berichtstext müssen dasselbe sagen. Vorher
  // riet der Befund, erst das SEO-Fundament zu bauen – während dem Bericht
  // ausdrücklich verboten war, genau das zu schreiben.
  const aeoOhneRanking = analyzeAeo({
    signals: strong.signals,
    serp: { keyword: 'ki beratung', items: [{ type: 'organic', rank_group: 1, domain: 'fremde-domain.de' }] },
    peopleAlsoAsk: [],
  })
  const rangBefund = aeoOhneRanking.findings.find((f) => f.id === 'aeo-no-ranking')
  check('Der Befund entsteht', Boolean(rangBefund), `AEO-Note ${aeoOhneRanking.score.toFixed(1)}`)
  check(
    'Er rät nicht mehr, erst das SEO-Fundament zu bauen',
    !/Erst das SEO-Fundament/.test(rangBefund?.action ?? ''),
  )
  check(
    'Er nennt den Weg über die Antwort als den kürzeren',
    /nicht auf Seite eins/.test(rangBefund?.why ?? ''),
    'KI-Übersichten zitieren auch jenseits der Top 10',
  )
  check(
    'Ohne SERP-Daten entsteht kein Befund',
    !analyzeAeo({ signals: strong.signals, serp: null, peopleAlsoAsk: [] }).findings.some(
      (f) => f.id === 'aeo-no-ranking',
    ),
    'eine fehlende Messung darf keine Behauptung erzeugen',
  )

  section('Canonical wird gegen die ausgelieferte Adresse geprüft')

  // Der Fall von erfolgreiches-onlinebusiness.de: ausgeliefert ohne www,
  // Canonical zeigt auf www. Beide Adressen antworten mit 200.
  const wwwFall = beurteileKanonisch({
    canonical: 'https://www.erfolgreiches-onlinebusiness.de/',
    url: 'https://erfolgreiches-onlinebusiness.de/',
  })
  check('www-Abweichung wird erkannt', wwwFall.art === 'anderer-host')
  check('Sie wird als www-Variante benannt', wwwFall.art === 'anderer-host' && wwwFall.nurWww)
  check(
    'Der Befund nennt beide Adressen',
    /www\.erfolgreiches-onlinebusiness\.de/.test(kanonischerBefund(wwwFall)?.why ?? '') &&
      /301/.test(kanonischerBefund(wwwFall)?.action ?? ''),
  )

  check(
    'Gleiche Adresse gilt als stimmig',
    beurteileKanonisch({ canonical: 'https://beispiel.de/seite', url: 'https://beispiel.de/seite' }).art ===
      'stimmig',
  )
  check(
    'Schrägstrich am Ende ist kein Unterschied',
    beurteileKanonisch({ canonical: 'https://beispiel.de/seite/', url: 'https://beispiel.de/seite' }).art ===
      'stimmig',
    'Google wertet beide Schreibweisen gleich',
  )
  check(
    'Relatives Canonical wird gegen die Seite aufgelöst',
    beurteileKanonisch({ canonical: '/seite', url: 'https://beispiel.de/seite' }).art === 'stimmig',
  )
  check(
    'Nach Weiterleitung zählt die Endadresse',
    beurteileKanonisch({
      canonical: 'https://beispiel.de/ziel',
      url: 'https://beispiel.de/start',
      finalUrl: 'https://beispiel.de/ziel',
    }).art === 'stimmig',
    'sonst würde jede Weiterleitung als Fehler gemeldet',
  )
  check(
    'Verweis auf eine andere Seite wird nicht als Fehler behauptet',
    /gewollt/.test(
      kanonischerBefund(beurteileKanonisch({ canonical: '/andere', url: 'https://beispiel.de/seite' }))?.why ?? '',
    ),
    'die Konsolidierung kann Absicht sein',
  )
  check('Fehlendes Canonical erzeugt einen Hinweis', beurteileKanonisch({ canonical: null, url: 'https://beispiel.de/' }).art === 'fehlt')
  check('Stimmiges Canonical erzeugt keinen Befund', kanonischerBefund({ art: 'stimmig', wert: 'x' }) === null)
  check(
    'Stimmig bekommt die volle Note, Host-Abweichung nicht',
    kanonischeNote({ art: 'stimmig', wert: 'x' }) === 10 && kanonischeNote(wwwFall) < 5,
  )

  section('Technische Prüfpunkte der OnPage-API')

  // Belegt an der echten Antwort für erfolgreiches-onlinebusiness.de:
  // beide Flags sind gesetzt und bedeuten "in Ordnung".
  check(
    'Flags, bei denen true gut ist, erzeugen keinen Mangel',
    leseChecks({ is_https: true, has_html_doctype: true }).length === 0,
    'sonst stünde ein fehlerfreier Zustand als Fehler im Bericht',
  )
  check('Unbekannte Flags werden übergangen', leseChecks({ irgendwas_neues: true }).length === 0)
  check('Nicht gesetzte Flags erzeugen nichts', leseChecks({ is_5xx_code: false }).length === 0)
  check('Fehlende Antwort erzeugt nichts', leseChecks(null).length === 0)

  const maengel = leseChecks({
    is_https: true,
    is_5xx_code: true,
    no_content_encoding: true,
    no_favicon: true,
    title_too_long: true,
  })
  check('Echte Mängel werden erkannt', maengel.length === 3, maengel.map((m) => m.schluessel).join(', '))
  check(
    'Was wir selbst messen, kommt nicht doppelt',
    !maengel.some((m) => m.schluessel === 'title_too_long'),
    'Title, H1, Description und Bild-Alt prüft die eigene Auswertung',
  )
  check('Ein Serverfehler gilt als kritisch', maengel.some((m) => m.schluessel === 'is_5xx_code' && m.severity === 'critical'))
  check('Ein fehlendes Favicon nicht', maengel.some((m) => m.schluessel === 'no_favicon' && m.severity !== 'critical'))
  check(
    'Schwere Mängel drücken die Note stärker',
    checkNote(leseChecks({ is_5xx_code: true })) < checkNote(leseChecks({ no_favicon: true })),
  )
  check('Ohne Mängel volle Note', checkNote([]) === 10)
  check(
    'Befunde tragen sprechende Kennungen',
    checkBefunde(maengel).every((f) => f.id.startsWith('onpage-') && !f.id.includes('_')),
  )
  check('Jeder Befund nennt eine Handlung', checkBefunde(maengel).every((f) => f.action.length > 20))

  // Ohne Abruf darf kein Wert entstehen – wie bei den Platzierungen.
  const ohneAbruf = analyzeSeo({ signals: strong.signals })
  const pruefpunkte = ohneAbruf.criteria.find((c) => c.key === 'onpage-checks')
  check(
    'Ohne Abruf sind die Prüfpunkte nicht bewertbar',
    pruefpunkte?.status === 'unknown',
    'eine fehlende Messung darf keine schlechte Note erzeugen',
  )

  section('Search Console taucht nirgends mehr auf')

  // Der Enum-Wert bleibt in der Datenbank bestehen, damit alte Zeilen lesbar
  // sind. Stand er aber in der Anbieterliste, meldete die Übersicht dauerhaft
  // einen fehlenden Anbieter, den man gar nicht mehr einrichten kann.
  check(
    'Die Anbieterliste kennt Search Console nicht mehr',
    !(VERWENDETE_ANBIETER as readonly string[]).includes('SEARCH_CONSOLE'),
    VERWENDETE_ANBIETER.join(', '),
  )
  check('Fünf Anbieter sind in Verwendung', VERWENDETE_ANBIETER.length === 5)

  const tresorQuelltext = readFileSync(
    join(dir, '..', '..', 'src', 'app', '(app)', 'settings', 'vault', 'manager.tsx'),
    'utf8',
  )
  check('Der Datentresor bietet Search Console nicht an', !/SEARCH_CONSOLE/.test(tresorQuelltext))

  section('Muster statt Durchschnitt')

  // Ein Durchschnitt über verschiedene Websites ist ohne Aussage. Gezählt wird
  // deshalb, welche Art Mangel wiederkehrt.
  check(
    'Messwerte im Titel weichen einem Auslassungszeichen',
    bezeichnung('Title mit 75 Zeichen zu lang') === 'Title mit … Zeichen zu lang',
    'sonst gälte die 75 für alle Läufe, in denen der Befund auftrat',
  )
  check(
    'Eine führende Anzahl fällt ganz weg',
    bezeichnung('3 Bilder ohne alt-Attribut') === 'Bilder ohne alt-Attribut',
  )
  check(
    'Titel ohne Zahlen bleiben unverändert',
    bezeichnung('Kein Canonical-Tag auf dieser Seite') === 'Kein Canonical-Tag auf dieser Seite',
  )

  const lauf = (befunde: Array<[string, string, string]>) => ({
    modules: [{ findings: befunde.map(([id, title, severity]) => ({ id, title, severity })) }],
  })

  const muster = wiederkehrendeBefunde([
    lauf([
      ['seo-alt-texts', '3 Bilder ohne alt-Attribut', 'quickwin'],
      ['seo-title-long', 'Title mit 75 Zeichen zu lang', 'quickwin'],
      ['seo-alt-texts', '3 Bilder ohne alt-Attribut', 'quickwin'],
    ]),
    lauf([
      ['seo-alt-texts', '1 Bild ohne alt-Attribut', 'quickwin'],
      ['seo-no-https', 'Seite läuft ohne HTTPS', 'critical'],
    ]),
    lauf([['seo-alt-texts', '7 Bilder ohne alt-Attribut', 'quickwin']]),
  ])

  check('Der häufigste Befund steht vorn', muster[0]?.id === 'seo-alt-texts', `${muster[0]?.laeufe} Läufe`)
  check(
    'Doppelt im selben Lauf zählt einmal',
    muster[0]?.laeufe === 3,
    'drei Läufe, nicht vier Vorkommen',
  )
  check(
    'Die Bezeichnung trägt keine Zahl aus einem einzelnen Lauf',
    muster[0]?.bezeichnung === 'Bilder ohne alt-Attribut',
  )
  check(
    'Einzelvorkommen bleiben draussen',
    !muster.some((m) => m.id === 'seo-no-https'),
    'ein einmaliger Befund ist kein Muster',
  )
  check('Ohne Läufe entsteht nichts', wiederkehrendeBefunde([]).length === 0)
  check('Kaputte Ergebnisse werfen nicht', wiederkehrendeBefunde([null, {}, { modules: 'x' }]).length === 0)
  check(
    'Die schwerere Einstufung gewinnt',
    wiederkehrendeBefunde([
      lauf([['seo-stale', 'Inhalt veraltet', 'longterm']]),
      lauf([['seo-stale', 'Inhalt veraltet', 'critical']]),
    ])[0]?.severity === 'critical',
  )

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
      scope: { pages: 1, note: 'Eine Seite. Andere Seiten der Domain wurden nicht gelesen.' },
      keyword: { value: 'ki beratung solopreneure', source: 'vorgegeben' as const },
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
  check(
    'Analyse-Umfang steht im Kopf des Berichts',
    /\*\*Analyse-Umfang:\*\* 1 Seite/.test(markdown),
    'sonst liest sich ein Befund über eine Seite wie ein Urteil über die Website',
  )
  check(
    'Herkunft des Hauptkeywords steht dabei',
    /\*\*Geprüftes Hauptkeyword:\*\*/.test(markdown),
  )
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
