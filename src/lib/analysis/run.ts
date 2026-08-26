import { db } from '@/lib/db'
import { resolveSecret } from '@/lib/connectors/credentials'
import { DataForSeoClient } from '@/lib/connectors/dataforseo'
import { FirecrawlClient } from '@/lib/connectors/firecrawl'
import { ApifyClient, detectPlatform, DEFAULT_ACTORS, actorInput, normalizeProfile } from '@/lib/connectors/apify'
import { PageSpeedClient } from '@/lib/connectors/pagespeed'
import { extractSignals, type PageSignals } from './extract'
import { analyzeSeo } from './seo'
import { analyzeAeo } from './aeo'
import { analyzeGeo, parseRobots } from './geo'
import { analyzeSerp, extractPeopleAlsoAsk } from './serp'
import { analyzeCompetitors, belastbareWettbewerber, type CompetitorProfile } from './competitors'
import { analyzeSocial } from './social'
import { waehleSeiten, seitenErgebnis, type SeitenErgebnis } from './seiten'
import { wiederkehrendeBefunde } from './wiederkehrend'
import { tragenderBegriff, wortfolge } from './begriffe'
import { beurteile, messbare, begriffsBefund, VOLUMEN_SCHWELLE, type BegriffsUrteil } from './keyword-pruefung'
import { generateReport, sortFindings } from './report'
import type { AnalysisResult, ModuleResult } from './types'
import type { Provider } from '@prisma/client'

export type ModuleKey = 'SEO' | 'AEO' | 'GEO' | 'SERP' | 'COMPETITORS'

/**
 * Grundgebühr je Lauf, in Credits (1 Credit = 1 US-Cent).
 *
 * Deckt die Anbieter ab, die keine Kosten je Aufruf zurückmelden: der
 * Seitenabruf über Firecrawl läuft im Monatstarif, die Berichtserstellung
 * kostet je nach Umfang wenige Cent.
 */
const GRUNDGEBUEHR = 3
const GRUNDGEBUEHR_MIT_BERICHT = 8

type StepUpdate = (step: string, progress: number) => Promise<void>

/**
 * Ein vollständiger Analyselauf.
 *
 * Aufbau in vier Phasen, entsprechend dem etablierten Analyse-Workflow:
 *   1. Seite laden und Kontext verstehen
 *   2. Daten bei den Anbietern erheben
 *   3. Je Baustein bewerten
 *   4. Bericht formulieren
 *
 * Grundsatz: Ein Ausfall bei einem Anbieter beendet nicht den ganzen Lauf.
 * Der betroffene Baustein entfällt und wird im Bericht als fehlend benannt,
 * statt eine Bewertung auf Basis fehlender Daten vorzutäuschen.
 */
export async function runAnalysis(params: {
  analysisId: string
  organizationId: string
  targetUrl: string
  targetKind: 'WEBSITE' | 'SOCIAL_PROFILE'
  modules: ModuleKey[]
  locationCode: number
  languageCode: string
  seedKeywords?: string[]
  competitorDomains?: string[]
  /** Höchstzahl gelesener Seiten; 1 = nur die eingegebene Adresse. */
  pageLimit?: number
  onStep?: StepUpdate
}): Promise<{ result: AnalysisResult; report: { markdown: string; summary: string }; raw: Record<string, unknown> }> {
  const { analysisId, organizationId, targetUrl, targetKind, modules, locationCode, languageCode } = params
  const step: StepUpdate = params.onStep ?? (async () => {})

  const skipped: AnalysisResult['meta']['skipped'] = []
  const providersUsed = new Set<string>()
  const raw: Record<string, unknown> = {}
  const moduleResults: ModuleResult[] = []

  const domain = safeDomain(targetUrl)

  // --- Zugangsdaten auflösen -----------------------------------------------
  const [dfsSecret, fcSecret, apifySecret, anthropicSecret, psiSecret] = await Promise.all([
    resolveSecret<{ login: string; password: string }>(organizationId, 'DATAFORSEO'),
    resolveSecret<{ apiKey: string }>(organizationId, 'FIRECRAWL'),
    resolveSecret<{ apiKey: string }>(organizationId, 'APIFY'),
    resolveSecret<{ apiKey: string }>(organizationId, 'ANTHROPIC'),
    resolveSecret<{ apiKey: string }>(organizationId, 'PAGESPEED'),
  ])

  const dfs = dfsSecret ? new DataForSeoClient(dfsSecret) : null
  const firecrawl = fcSecret ? new FirecrawlClient(fcSecret) : null
  const apify = apifySecret ? new ApifyClient(apifySecret) : null
  const pagespeed = new PageSpeedClient(psiSecret?.apiKey)

  // =========================================================================
  // Social-Profil: eigener, kürzerer Weg
  // =========================================================================
  if (targetKind === 'SOCIAL_PROFILE') {
    await step('Social-Profil wird abgerufen', 20)
    const platform = detectPlatform(targetUrl)

    if (!platform) {
      throw new Error(`Plattform aus der URL nicht erkennbar: ${targetUrl}`)
    }
    if (!apify) {
      throw new Error('Für Social-Profile werden Apify-Zugangsdaten benötigt. Im Datentresor hinterlegen.')
    }

    const items = await apify.runActor<Record<string, unknown>>(
      DEFAULT_ACTORS[platform],
      actorInput(platform, targetUrl),
    )
    providersUsed.add('Apify')
    raw.apify = items.slice(0, 3)

    if (items.length === 0) {
      throw new Error('Der Actor hat keine Daten geliefert. Profil öffentlich erreichbar?')
    }

    await step('Profil wird bewertet', 60)
    const profile = normalizeProfile(platform, items[0])
    moduleResults.push(analyzeSocial({ profile }))

    const result = assemble({
      targetUrl, targetKind, domain, modules: ['SOCIAL'], moduleResults, skipped,
      providersUsed, languageCode, locationCode,
      keyword: { value: null, source: 'keines' },
    })

    await step('Bericht wird erstellt', 85)
    const report = await generateReport(result, anthropicSecret?.apiKey ?? null)
    if (anthropicSecret) providersUsed.add('Anthropic')
    result.executiveSummary = report.summary

    return { result, report, raw }
  }

  // =========================================================================
  // Website
  // =========================================================================

  // --- Phase 1: Seite laden -------------------------------------------------
  await step('Seite wird geladen', 10)

  let signals: PageSignals
  let robots: { content: string | null; blocksAiCrawlers: string[] } | null = null

  {
    let html: string | null = null
    let renderedText: string | null = null
    let statusCode: number | null = null
    let firecrawlMeta: Record<string, unknown> | null = null

    if (firecrawl) {
      try {
        const scraped = await firecrawl.scrape(targetUrl)
        providersUsed.add('Firecrawl')
        // Nur das rohe HTML enthält verlässlich den <head>. Fehlt es, ist
        // die aufbereitete Fassung unbrauchbar für die Kopfbereich-Prüfung –
        // dann lieber direkt abrufen als Fehlendes zu melden, das da ist.
        html = scraped?.rawHtml ?? null
        if (!html && scraped?.html && /<head[\s>]/i.test(scraped.html)) {
          html = scraped.html
        }
        renderedText = scraped?.markdown ?? null
        statusCode = scraped?.metadata?.statusCode ?? null
        firecrawlMeta = scraped?.metadata ?? null
        raw.firecrawl = { metadata: scraped?.metadata, markdownLength: scraped?.markdown?.length }
      } catch (error) {
        skipped.push({ module: 'Firecrawl-Abruf', reason: message(error) })
      }
    }

    if (!html) {
      // Direkter Abruf als Rückfallebene. Zeigt nur das ausgelieferte HTML –
      // genau das, was auch ein einfacher KI-Crawler sieht.
      const response = await fetch(targetUrl, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; SEO-Master/1.0; +Sichtbarkeitsanalyse)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      })
      statusCode = response.status
      html = await response.text()
      if (!firecrawl) {
        skipped.push({
          module: 'JavaScript-Rendering',
          reason: 'Keine Firecrawl-Zugangsdaten – gemessen wurde nur das ausgelieferte HTML',
        })
      }
    }

    // Ein Fehlerstatus oder eine praktisch leere Antwort darf nicht als
    // Analyseergebnis durchgehen: eine 403-Seite bekäme sonst eine schlechte
    // Bewertung, obwohl über die eigentliche Seite nichts ausgesagt wurde.
    if (statusCode !== null && statusCode >= 400) {
      throw new Error(
        `Die Seite antwortete mit HTTP ${statusCode}. Analysiert werden kann nur, was auch erreichbar ist – ` +
          'URL prüfen, und ob der Zugriff durch Zugangsschutz, Geoblocking oder eine Firewall unterbunden wird.',
      )
    }

    // Ohne <head> im Dokument wären Title, Description und strukturierte Daten
    // gar nicht auffindbar – die Analyse würde sie als fehlend melden, obwohl
    // sie vorhanden sind. Dann lieber ein zweiter, direkter Abruf.
    if (!/<head[\s>]/i.test(html)) {
      skipped.push({
        module: 'Seitenabruf',
        reason: 'Die erste Fassung enthielt keinen Kopfbereich – es wurde direkt nachgeladen',
      })
      try {
        const response = await fetch(targetUrl, {
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; SEO-Master/1.0; +Sichtbarkeitsanalyse)' },
          redirect: 'follow',
          signal: AbortSignal.timeout(45_000),
        })
        const nachgeladen = await response.text()
        if (/<head[\s>]/i.test(nachgeladen)) {
          html = nachgeladen
          statusCode = response.status
          skipped.pop()
        }
      } catch {
        // Bleibt es beim ersten Abruf, wird der Mangel unten benannt.
      }
    }

    signals = extractSignals({ url: targetUrl, html, renderedText, statusCode })

    // Letzte Rückfallebene: Firecrawl liefert Title und Description getrennt
    // mit. Sie zu verwenden ist allemal besser, als sie als fehlend zu melden.
    if (!signals.title && typeof firecrawlMeta?.title === 'string') {
      signals.title = firecrawlMeta.title
      signals.titleLength = firecrawlMeta.title.length
    }
    if (!signals.metaDescription && typeof firecrawlMeta?.description === 'string') {
      signals.metaDescription = firecrawlMeta.description
      signals.metaDescriptionLength = firecrawlMeta.description.length
    }

    if (signals.wordCount < 20 && signals.h1.length === 0 && !signals.title) {
      throw new Error(
        'Die Seite lieferte praktisch keinen auswertbaren Inhalt. Das deutet auf eine Weiterleitung, eine ' +
          'Zustimmungsabfrage oder eine Bot-Sperre hin. Mit hinterlegten Firecrawl-Zugangsdaten gelingt der Abruf ' +
          'in solchen Fällen meist.',
      )
    }

    raw.signals = { ...signals, text: signals.text.slice(0, 2000) }
  }

  // robots.txt: entscheidet darüber, ob KI-Crawler überhaupt lesen dürfen.
  await step('robots.txt wird geprüft', 18)
  try {
    const response = await fetch(new URL('/robots.txt', targetUrl).toString(), {
      signal: AbortSignal.timeout(15_000),
    })
    robots = parseRobots(response.ok ? await response.text() : null)
  } catch {
    robots = parseRobots(null)
  }

  // Hauptkeyword bestimmen: bevorzugt vorgegeben, sonst aus der Seite
  // abgeleitet.
  const primaryKeyword = params.seedKeywords?.[0] ?? deriveKeyword(signals)
  const keywordsToCheck = (params.seedKeywords?.length ? params.seedKeywords : [primaryKeyword])
    .filter((k): k is string => Boolean(k))
    .slice(0, 5)

  // Ein selbst abgeleitetes Keyword ist eine Vermutung, kein Auftrag. Wo es
  // fehlt, wird das ausgewiesen statt ersatzweise etwas Beliebiges gemessen.
  const keywordQuelle: 'vorgegeben' | 'abgeleitet' | 'keines' =
    params.seedKeywords?.length ? 'vorgegeben' : primaryKeyword ? 'abgeleitet' : 'keines'
  if (!primaryKeyword) {
    skipped.push({
      module: 'Hauptkeyword',
      reason:
        'Aus der Seite liess sich kein aussagekräftiger Suchbegriff ableiten. Für Platzierungen und LLM-Sichtbarkeit bitte beim Start eigene Keywords angeben.',
    })
  }

  // --- Phase 2: Daten erheben ----------------------------------------------
  await step('Messdaten werden erhoben', 30)

  let psiResult = null
  let backlinks = null
  let domainRank = null
  let rankedKeywords = null
  let llmMentions = null
  let onPageChecks: Record<string, boolean> | null = null
  let begriffsUrteile: BegriffsUrteil[] = []
  let begriffsAlternativen: Array<{ begriff: string; volumen: number }> = []
  const serps: Array<{ keyword: string; result: any }> = []

  // Die Erhebungen sind voneinander unabhängig und laufen deshalb parallel.
  const collectors: Promise<void>[] = []

  collectors.push(
    (async () => {
      try {
        psiResult = await pagespeed.analyze(targetUrl, 'mobile')
        providersUsed.add('PageSpeed Insights')
        raw.pagespeed = psiResult
      } catch (error) {
        skipped.push({ module: 'Geschwindigkeitsmessung', reason: message(error) })
      }
    })(),
  )

  if (dfs && domain) {
    collectors.push(
      (async () => {
        try {
          backlinks = await dfs.backlinksSummary(domain)
          raw.backlinks = backlinks
          providersUsed.add('DataForSEO')
        } catch (error) {
          skipped.push({ module: 'Backlink-Profil', reason: message(error) })
        }
      })(),
    )

    collectors.push(
      (async () => {
        try {
          // Liefert fertige technische Prüfpunkte zur geprüften Adresse.
          const seite = await dfs.instantPage(targetUrl)
          onPageChecks = seite?.items?.[0]?.checks ?? null
          raw.onPage = seite
          providersUsed.add('DataForSEO')
        } catch (error) {
          skipped.push({ module: 'Technische Prüfpunkte', reason: message(error) })
        }
      })(),
    )

    collectors.push(
      (async () => {
        try {
          domainRank = await dfs.domainRankOverview({ target: domain, locationCode, languageCode })
          raw.domainRank = domainRank
          providersUsed.add('DataForSEO')
        } catch (error) {
          skipped.push({ module: 'Domain-Kennzahlen', reason: message(error) })
        }
      })(),
    )

    if (modules.includes('SERP')) {
      // Vorprüfung: Wird überhaupt gesucht, was hier geprüft werden soll?
      //
      // Sie läuft vor allen Platzierungsabfragen und nicht nebenher, weil ihr
      // Ergebnis darüber entscheidet, welche Begriffe abgefragt werden. Für
      // einen Begriff ohne Nachfrage ist die Platzierung nicht nur
      // uninteressant, sondern irreführend – und die Abfrage kostet zusätzlich
      // Geld.
      await step('Suchbegriffe werden geprüft', 26)
      try {
        const volumina = await dfs.searchVolume({
          keywords: keywordsToCheck,
          locationCode,
          languageCode,
        })
        const karte = new Map(
          volumina.map((v) => [wortfolge(v.keyword ?? ''), v.search_volume ?? null] as const),
        )
        begriffsUrteile = beurteile(keywordsToCheck, karte)
        raw.begriffsUrteile = begriffsUrteile
        providersUsed.add('DataForSEO')

        // Nur wenn tatsächlich etwas untauglich war, nach Alternativen suchen.
        // Sonst wäre es ein Aufruf für einen Hinweis, den niemand braucht.
        const untauglich = begriffsUrteile.filter((u) => u.urteil !== 'messbar')
        if (untauglich.length > 0) {
          const ausgangspunkt =
            begriffsUrteile.find((u) => u.urteil === 'messbar')?.begriff ??
            tragenderBegriff(signals.h1[0]) ??
            tragenderBegriff(signals.title)

          if (ausgangspunkt) {
            try {
              const vorschlaege = await dfs.keywordSuggestions({
                keyword: ausgangspunkt,
                locationCode,
                languageCode,
                limit: 40,
              })
              begriffsAlternativen = (vorschlaege?.items ?? [])
                .map((i) => ({
                  begriff: i.keyword ?? '',
                  volumen: i.keyword_info?.search_volume ?? 0,
                }))
                .filter((a) => a.begriff && a.volumen >= VOLUMEN_SCHWELLE * 5)
                .sort((a, b) => b.volumen - a.volumen)
                .slice(0, 8)
            } catch {
              // Ohne Alternativen bleibt der Hinweis trotzdem richtig.
            }
          }
        }
      } catch (error) {
        skipped.push({ module: 'Suchvolumen-Prüfung', reason: message(error) })
        begriffsUrteile = beurteile(keywordsToCheck, null)
      }

      collectors.push(
        (async () => {
          try {
            rankedKeywords = await dfs.rankedKeywords({ target: domain, locationCode, languageCode, limit: 200 })
            raw.rankedKeywords = { total: rankedKeywords?.total_count, sample: rankedKeywords?.items?.slice(0, 20) }
            providersUsed.add('DataForSEO')
          } catch (error) {
            skipped.push({ module: 'Ranking-Übersicht', reason: message(error) })
          }
        })(),
      )

      // Suchergebnisse nacheinander abrufen, um das Anfragelimit nicht zu reissen.
      collectors.push(
        (async () => {
          for (const keyword of messbare(begriffsUrteile)) {
            try {
              const result = await dfs.serpOrganic({ keyword, locationCode, languageCode, depth: 20 })
              serps.push({ keyword, result })
              providersUsed.add('DataForSEO')
            } catch (error) {
              skipped.push({ module: `Suchergebnis "${keyword}"`, reason: message(error) })
            }
          }
          raw.serps = serps.map((s) => ({ keyword: s.keyword, itemsCount: s.result?.items?.length }))
        })(),
      )
    }

    if (modules.includes('GEO') && primaryKeyword) {
      collectors.push(
        (async () => {
          try {
            llmMentions = await dfs.llmMentionsTopDomains({ keyword: primaryKeyword, locationCode, languageCode, limit: 20 })
            raw.llmMentions = llmMentions
            providersUsed.add('DataForSEO')
          } catch (error) {
            // Die AI-Optimization-Endpunkte sind nicht in jedem Tarif enthalten.
            skipped.push({ module: 'LLM-Sichtbarkeit', reason: message(error) })
          }
        })(),
      )
    }
  } else if (!dfs) {
    skipped.push({
      module: 'DataForSEO-Daten',
      reason: 'Keine Zugangsdaten hinterlegt – Rankings, Backlinks und Wettbewerb entfallen',
    })
  }

  await Promise.all(collectors)

  // --- Phase 2b: Weitere Seiten der Website --------------------------------
  //
  // Läuft nach den Markt-Erhebungen, denn die gelten je Domain und werden
  // nicht je Seite wiederholt. Jede Unterseite bekommt dieselbe
  // Seitenbewertung wie die Hauptseite (SEO/AEO/GEO-Struktur) – nur eben
  // ohne die Domain-Daten, die schon erhoben sind.
  const seitenLimit = Math.max(1, params.pageLimit ?? 1)
  let seiten: SeitenErgebnis[] = []
  const nichtLadbar: string[] = []

  if (seitenLimit > 1 && firecrawl) {
    await step('Weitere Seiten werden gelesen', 55)
    try {
      const gefunden = await firecrawl.map(targetUrl, 200)
      const adressen = waehleSeiten({ startUrl: targetUrl, gefunden, limit: seitenLimit })
      raw.seitenauswahl = { gefunden: gefunden.length, gewaehlt: adressen.length, nichtLadbar }

      // Gebündelt zu vieren: schnell genug, ohne die Zielseite zu fluten.
      for (let i = 0; i < adressen.length; i += 4) {
        const gruppe = adressen.slice(i, i + 4)
        const ergebnisse = await Promise.all(
          gruppe.map(async (adresse): Promise<SeitenErgebnis | null> => {
            try {
              const geladen = await firecrawl.scrape(adresse)
              const seitenHtml = geladen?.rawHtml ?? geladen?.html
              if (!seitenHtml) return null
              const s = extractSignals({ url: adresse, html: seitenHtml, renderedText: geladen?.markdown ?? null })
              return seitenErgebnis({
                url: adresse,
                signals: s,
                seo: analyzeSeo({ signals: s }),
                aeo: analyzeAeo({ signals: s, serp: null, peopleAlsoAsk: [] }),
                geo: analyzeGeo({ signals: s, backlinks: null, llmMentions: null, robotsTxt: robots }),
              })
            } catch {
              return null
            }
          }),
        )
        // Ein blosser Zähler ("3 Seiten liessen sich nicht laden") ist nicht
        // verwertbar – erst der Name macht den Hinweis prüfbar.
        ergebnisse.forEach((e, i) => {
          if (e === null) nichtLadbar.push(gruppe[i])
        })
        seiten.push(...ergebnisse.filter((e): e is SeitenErgebnis => e !== null))
        await step('Weitere Seiten werden gelesen', 55 + Math.round(((i + 4) / adressen.length) * 4))
      }

      // Schwächste zuerst: Dort liegt die Arbeit.
      seiten.sort((a, b) => a.schnitt - b.schnitt)
    } catch (error) {
      skipped.push({ module: 'Website-Umfang', reason: message(error) })
    }
  } else if (seitenLimit > 1 && !firecrawl) {
    skipped.push({
      module: 'Website-Umfang',
      reason: 'Ohne Firecrawl-Zugangsdaten wird nur die eingegebene Seite gelesen.',
    })
  }

  // --- Phase 3: Bewerten ----------------------------------------------------
  await step('Bewertung läuft', 60)

  const paa = serps.flatMap((s) => extractPeopleAlsoAsk(s.result))

  if (modules.includes('SEO')) {
    moduleResults.push(
      analyzeSeo({ signals, pagespeed: psiResult, backlinks, domainRank, primaryKeyword, onPageChecks }),
    )
  }
  if (modules.includes('AEO')) {
    moduleResults.push(analyzeAeo({ signals, serp: serps[0]?.result ?? null, peopleAlsoAsk: [...new Set(paa)] }))
  }
  if (modules.includes('GEO')) {
    moduleResults.push(analyzeGeo({ signals, backlinks, llmMentions, robotsTxt: robots }))
  }
  if (modules.includes('SERP')) {
    if (!dfs || !domain) {
      skipped.push({ module: 'SERP', reason: 'Ohne DataForSEO-Zugangsdaten nicht möglich' })
    } else {
      moduleResults.push(
        analyzeSerp({ domain, serps, rankedKeywords, domainRank, begriffsUrteile, begriffsAlternativen }),
      )
    }
  }

  // --- Wettbewerb -----------------------------------------------------------
  if (modules.includes('COMPETITORS')) {
    if (!dfs || !domain) {
      skipped.push({ module: 'COMPETITORS', reason: 'Ohne DataForSEO-Zugangsdaten nicht möglich' })
    } else {
      await step('Wettbewerb wird verglichen', 75)
      try {
        const competitors = await dfs.competitorsDomain({ target: domain, locationCode, languageCode, limit: 10 })
        providersUsed.add('DataForSEO')
        raw.competitors = competitors

        // Automatisch gefundene Wettbewerber müssen genügend Keywords teilen –
        // eine einzige Überschneidung macht keine Wettbewerberin. Von Hand
        // vorgegebene Domains gelten dagegen ungefiltert: Wer eine Domain
        // eintippt, hat entschieden.
        // Die Zuweisung geschieht in einer Sammel-Closure – TypeScript sieht
        // hier sonst nur den Startwert null.
        const eigeneKeywords =
          (domainRank as import('@/lib/connectors/dataforseo').DomainRankResult | null)?.items?.[0]?.metrics
            ?.organic?.count ?? 0
        const { belastbar, aussortiert } = belastbareWettbewerber(competitors?.items ?? [], eigeneKeywords)
        if (aussortiert.length > 0) {
          raw.wettbewerberAussortiert = aussortiert.map((c) => ({
            domain: c.domain,
            gemeinsameKeywords: c.intersections ?? 0,
          }))
        }
        const gefiltert = competitors ? { ...competitors, items: belastbar } : null

        // Vorgegebene Wettbewerber haben Vorrang vor automatisch gefundenen.
        const rivalDomains = (
          params.competitorDomains?.length
            ? params.competitorDomains
            : belastbar.map((c) => c.domain).filter(Boolean)
        )
          .map((d) => String(d).replace(/^www\./, ''))
          .filter((d) => d && d !== domain)
          .slice(0, 3)

        // Keyword-Lücken je Wettbewerber und deren Backlink-Profil.
        const gaps = await Promise.all(
          rivalDomains.map(async (competitor) => {
            try {
              const result = await dfs.domainIntersection({
                target1: domain,
                target2: competitor,
                locationCode,
                languageCode,
                limit: 50,
              })
              return { competitor, result }
            } catch (error) {
              skipped.push({ module: `Keyword-Lücken ${competitor}`, reason: message(error) })
              return { competitor, result: null }
            }
          }),
        )

        const profiles: CompetitorProfile[] = await Promise.all(
          (competitors?.items ?? []).slice(0, 6).map(async (c) => {
            const d = (c.domain ?? '').replace(/^www\./, '')
            let refDomains: number | null = null
            try {
              const summary = await dfs.backlinksSummary(d)
              refDomains = summary?.referring_main_domains ?? summary?.referring_domains ?? null
            } catch {
              // Ohne Backlink-Daten bleibt der Vergleich unvollständig, aber nutzbar.
            }
            return {
              domain: d,
              keywordsTop100: c.full_domain_metrics?.organic?.count ?? null,
              estimatedTraffic: Math.round(c.full_domain_metrics?.organic?.etv ?? 0),
              referringDomains: refDomains,
              avgPosition: c.avg_position ?? null,
              sharedKeywords: c.intersections ?? null,
            }
          }),
        )

        moduleResults.push(
          analyzeCompetitors({
            domain,
            own: { domainRank, backlinks },
            competitors: gefiltert,
            gaps,
            competitorProfiles: profiles,
          }),
        )
      } catch (error) {
        skipped.push({ module: 'COMPETITORS', reason: message(error) })
      }
    }
  }

  // --- Phase 4: Bericht -----------------------------------------------------
  await step('Bericht wird erstellt', 88)

  const result = assemble({
    targetUrl,
    targetKind,
    domain,
    modules,
    moduleResults,
    skipped,
    providersUsed,
    languageCode,
    locationCode,
    pageType: guessPageType(signals),
    pageLanguage: signals.lang,
    keyword: { value: primaryKeyword, source: keywordQuelle },
  })

  if (seiten.length > 0) {
    result.pages = seiten
    // Dieselbe Musterlogik wie auf der Übersicht – nur über Seiten statt
    // über Läufe: Was auf vielen Seiten auftritt, ist ein Website-Problem
    // mit einer Ursache, kein Einzelfall.
    result.seitenMuster = wiederkehrendeBefunde(
      seiten.map((seite) => ({ modules: [{ findings: seite.befunde }] })),
      { mindestens: 2, hoechstens: 6 },
    )
    result.meta.scope = {
      pages: 1 + seiten.length,
      note:
        `${1 + seiten.length} Seiten derselben Domain. Die Bausteine im Detail beziehen sich auf die ` +
        `eingegebene Seite; jede weitere Seite wurde nach denselben Regeln bewertet (ohne Markt-Daten, ` +
        `die je Domain einmal erhoben werden).` +
        (nichtLadbar.length > 0
          ? ` Nicht ladbar: ${nichtLadbar.slice(0, 5).join(', ')}${nichtLadbar.length > 5 ? ` und ${nichtLadbar.length - 5} weitere` : ''}.`
          : ''),
    }
    if (nichtLadbar.length > 0) {
      skipped.push({
        module: 'Seitenabruf',
        reason: `Nicht ladbar: ${nichtLadbar.slice(0, 5).join(', ')}${nichtLadbar.length > 5 ? ` und ${nichtLadbar.length - 5} weitere` : ''}`,
      })
    }
  }

  const report = await generateReport(result, anthropicSecret?.apiKey ?? null)
  if (anthropicSecret) providersUsed.add('Anthropic')
  result.executiveSummary = report.summary
  result.meta.providersUsed = [...providersUsed]

  // Verbrauch festhalten und vom Guthaben abziehen.
  //
  // Ein Credit entspricht einem US-Cent. Neben den tatsächlichen
  // DataForSEO-Kosten fällt eine Grundgebühr an; sie deckt die Anbieter ab,
  // die keine Kosten je Aufruf ausweisen (Berichtstext, Seitenabruf).
  const dfsCent = dfs && dfs.totalCost > 0 ? Math.ceil(dfs.totalCost * 100) : 0
  const grundgebuehr = anthropicSecret ? GRUNDGEBUEHR_MIT_BERICHT : GRUNDGEBUEHR
  // Jede Unterseite ist ein zusätzlicher Firecrawl-Abruf; der pauschale Cent
  // je Seite hält die Website-Analyse im Guthaben sichtbar, statt sie als
  // kostenlos erscheinen zu lassen.
  const seitenCent = seiten.length
  const gesamtCent = dfsCent + grundgebuehr + seitenCent

  if (seitenCent > 0) {
    await db.usageRecord.create({
      data: {
        organizationId,
        provider: 'FIRECRAWL' as Provider,
        operation: 'unterseiten',
        units: seiten.length,
        costCredits: seitenCent,
        analysisId,
      },
    })
  }

  if (dfsCent > 0) {
    await db.usageRecord.create({
      data: {
        organizationId,
        provider: 'DATAFORSEO' as Provider,
        operation: 'analysis',
        units: 1,
        costCredits: dfsCent,
        analysisId,
      },
    })
  }
  if (grundgebuehr > 0) {
    await db.usageRecord.create({
      data: {
        organizationId,
        provider: 'ANTHROPIC' as Provider,
        operation: 'report',
        units: 1,
        costCredits: grundgebuehr,
        analysisId,
      },
    })
  }

  // Vom Guthaben abziehen, ausser im internen Betrieb. Ohne diesen Schritt
  // bliebe die Prüfung beim Starten wirkungslos: Das Guthaben sänke nie,
  // und die Kostenbremse griffe nie.
  const organisation = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  })
  if (organisation && organisation.plan !== 'INTERNAL' && gesamtCent > 0) {
    await db.organization.update({
      where: { id: organizationId },
      data: { credits: { decrement: gesamtCent } },
    })
  }

  await db.analysis.update({
    where: { id: analysisId },
    data: { creditsUsed: gesamtCent },
  })

  return { result, report, raw }
}

// ---------------------------------------------------------------------------

function assemble(input: {
  targetUrl: string
  targetKind: 'WEBSITE' | 'SOCIAL_PROFILE'
  domain: string | null
  modules: string[]
  moduleResults: ModuleResult[]
  skipped: AnalysisResult['meta']['skipped']
  providersUsed: Set<string>
  languageCode: string
  locationCode: number
  pageType?: string | null
  pageLanguage?: string | null
  keyword?: { value: string | null; source: 'vorgegeben' | 'abgeleitet' | 'keines' }
}): AnalysisResult {
  const find = (m: string) => input.moduleResults.find((r) => r.module === m)?.score ?? null

  const seo = find('SEO')
  const aeo = find('AEO')
  const geo = find('GEO')
  const serp = find('SERP')

  const present = input.moduleResults.map((m) => m.score)
  const overall = present.length ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10 : null

  return {
    target: { url: input.targetUrl, kind: input.targetKind, domain: input.domain },
    meta: {
      analyzedAt: new Date().toISOString(),
      pageType: input.pageType ?? null,
      language: input.pageLanguage ?? input.languageCode,
      market: marketName(input.locationCode),
      modules: input.modules,
      providersUsed: [...input.providersUsed],
      skipped: input.skipped,
      // Der Lauf liest genau die angegebene Adresse. Das gehört in den Kopf
      // des Ergebnisses, damit ein Befund über eine Verkaufsseite nicht als
      // Urteil über die ganze Website gelesen wird.
      scope: {
        pages: 1,
        note:
          input.targetKind === 'SOCIAL_PROFILE'
            ? 'Ein Profil. Einzelne Beiträge wurden nicht bewertet.'
            : 'Eine Seite. Andere Seiten der Domain wurden nicht gelesen und sind in keinem Befund berücksichtigt.',
      },
      keyword: input.keyword ?? { value: null, source: 'keines' },
    },
    scores: { seo, aeo, geo, serp, overall },
    modules: input.moduleResults,
    priorities: sortFindings(input.moduleResults.flatMap((m) => m.findings)),
    executiveSummary: null,
  }
}

/**
 * Hauptkeyword aus der Seite ableiten, wenn keines vorgegeben ist.
 *
 * Der H1 ist das verlässlichste Signal, danach der Title. Entscheidend ist,
 * was danach passiert: Füllwörter fallen weg und die Kette wird auf drei
 * Wörter begrenzt.
 *
 * Ohne diesen Schritt entstanden aus Überschriften wie "Dein Online-Business —
 * ohne alles allein rauszufinden" Suchbegriffe wie "dein online business ohne"
 * oder – nach Kürzung – Einzelwörter wie "Business". Nach solchen Begriffen
 * sucht niemand; die Platzierungsprüfung mass damit an der Sache vorbei und
 * vergab eine schlechte Note für ein Ergebnis, das nichts bedeutet.
 */
function deriveKeyword(signals: PageSignals): string | null {
  const ausUeberschrift = tragenderBegriff(signals.h1[0])
  if (ausUeberschrift && ausUeberschrift.includes(' ')) return ausUeberschrift

  const ausTitle = tragenderBegriff(signals.title)
  if (ausTitle && ausTitle.includes(' ')) return ausTitle

  // Ein einzelnes Wort ist als Suchanfrage fast immer zu allgemein
  // ("Business", "Beratung"). Dann lieber kein abgeleitetes Keyword als eine
  // Messung, die an der Sache vorbeigeht.
  return null
}

function guessPageType(signals: PageSignals): string {
  const types = signals.schemaTypes.join(' ').toLowerCase()
  if (types.includes('blogposting') || types.includes('article')) return 'Blogartikel'
  if (types.includes('product')) return 'Produktseite'
  if (types.includes('localbusiness')) return 'Lokale Unternehmensseite'
  if (signals.urlDepth === 0) return 'Startseite'
  if (signals.faqBlocks.length > 3) return 'FAQ-Seite'
  if (signals.wordCount > 1200) return 'Ausführliche Inhaltsseite'
  return 'Landing Page'
}

/** Ländercodes von DataForSEO für die verbreitetsten Märkte. */
const MARKETS: Record<number, string> = {
  2276: 'Deutschland',
  2040: 'Österreich',
  2756: 'Schweiz',
  2826: 'Vereinigtes Königreich',
  2840: 'USA',
}

function marketName(code: number): string {
  return MARKETS[code] ?? `Standort ${code}`
}

function safeDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function message(error: unknown): string {
  if (!(error instanceof Error)) return 'Unbekannter Fehler'
  // Den Anbieternamen in eckigen Klammern entfernen: er steht bereits in der
  // Zeile davor, und der Text soll lesbar bleiben, nicht technisch.
  const text = error.message.replace(/^\[[^\]]+\]\s*/, '')
  return text.length > 220 ? `${text.slice(0, 217)}…` : text
}
