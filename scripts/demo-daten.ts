/**
 * Befüllt eine leere Installation mit einem Beispieldurchlauf.
 *
 * Nutzt die echte Analyse-Engine über die Fixtures aus scripts/fixtures/,
 * damit die Oberfläche mit echten Auswertungsergebnissen zu sehen ist statt
 * mit erfundenen Zahlen. Nur für Vorführung und Entwicklung gedacht.
 *
 * Aufruf:  npx tsx --env-file-if-exists=.env scripts/demo-daten.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { extractSignals } from '../src/lib/analysis/extract'
import { analyzeSeo } from '../src/lib/analysis/seo'
import { analyzeAeo } from '../src/lib/analysis/aeo'
import { analyzeGeo, parseRobots } from '../src/lib/analysis/geo'
import { analyzeSerp } from '../src/lib/analysis/serp'
import { buildDeterministicReport, sortFindings } from '../src/lib/analysis/report'
import type { AnalysisResult } from '../src/lib/analysis/types'

const db = new PrismaClient()

function runEngine(url: string, fixture: string, opts: { keyword: string; serpFile?: string }) {
  const html = readFileSync(join(__dirname, 'fixtures', fixture), 'utf8')
  const signals = extractSignals({ url, html, statusCode: 200 })
  const robots = parseRobots('User-agent: *\nAllow: /\nSitemap: /sitemap.xml')

  const modules = [
    analyzeSeo({ signals, primaryKeyword: opts.keyword }),
    analyzeAeo({ signals }),
    analyzeGeo({ signals, robotsTxt: robots }),
  ]

  // Wenn echte Ranking-Daten vorliegen, das SERP-Modul damit füttern.
  if (opts.serpFile) {
    const raw = readFileSync(opts.serpFile, 'utf8')
    const parsed = JSON.parse(raw.slice(raw.indexOf('{')))
    const domain = new URL(url).hostname.replace(/^www\./, '')
    modules.push(analyzeSerp({ domain, serps: [], rankedKeywords: parsed, domainRank: null }))
  }

  const scores = Object.fromEntries(modules.map((m) => [m.module.toLowerCase(), m.score]))
  const overall = Math.round((modules.reduce((a, m) => a + m.score, 0) / modules.length) * 10) / 10

  const result: AnalysisResult = {
    target: { url, kind: 'WEBSITE', domain: new URL(url).hostname.replace(/^www\./, '') },
    meta: {
      analyzedAt: new Date().toISOString(),
      pageType: signals.wordCount > 600 ? 'Ausführliche Inhaltsseite' : 'Landing Page',
      language: signals.lang,
      market: 'Deutschland',
      modules: modules.map((m) => m.module),
      providersUsed: opts.serpFile ? ['DataForSEO'] : [],
      skipped: opts.serpFile
        ? [{ module: 'Wettbewerbsvergleich', reason: 'In diesem Durchlauf nicht angefordert' }]
        : [{ module: 'DataForSEO-Daten', reason: 'Keine Zugangsdaten hinterlegt' }],
      scope: { pages: 1, note: 'Eine Seite. Andere Seiten der Domain wurden nicht gelesen.' },
      keyword: { value: 'ki beratung', source: 'abgeleitet' },
    },
    scores: {
      seo: scores.seo ?? null,
      aeo: scores.aeo ?? null,
      geo: scores.geo ?? null,
      serp: scores.serp ?? null,
      overall,
    },
    modules,
    priorities: sortFindings(modules.flatMap((m) => m.findings)),
    executiveSummary: null,
  }

  const markdown = buildDeterministicReport(result)
  const critical = result.priorities.filter((f) => f.severity === 'critical').length
  const quick = result.priorities.filter((f) => f.severity === 'quickwin').length
  result.executiveSummary =
    `Gesamtbewertung ${overall}/10. ${critical} Punkte müssen sofort angefasst werden, ` +
    `${quick} weitere sind mit geringem Aufwand zu heben. ` +
    `Der grösste Hebel: ${result.priorities[0]?.title ?? 'keine Befunde'}.`

  return { result, markdown }
}

async function main() {
  const org = await db.organization.findFirstOrThrow()
  const user = await db.user.findFirstOrThrow()

  await db.analysis.deleteMany({ where: { organizationId: org.id } })
  await db.project.deleteMany({ where: { organizationId: org.id } })

  const project = await db.project.create({
    data: {
      organizationId: org.id,
      name: 'Beispiel Consulting',
      url: 'https://beispiel.de',
      domain: 'beispiel.de',
      locationCode: 2276,
      languageCode: 'de',
      description: 'Hauptwebsite — monatliche Prüfung',
      competitors: {
        create: [
          { domain: 'wettbewerber-a.de', url: 'https://wettbewerber-a.de', isAuto: false },
          { domain: 'wettbewerber-b.de', url: 'https://wettbewerber-b.de', isAuto: true },
        ],
      },
    },
  })

  const serpFile = process.env.SERP_FILE

  const runs = [
    {
      url: 'https://beispiel.de/ki-beratung',
      fixture: 'gut.html',
      keyword: 'ki-beratung',
      daysAgo: 0,
      serpFile,
    },
    { url: 'https://beispiel.de/', fixture: 'schwach.html', keyword: 'beratung', daysAgo: 3 },
    { url: 'https://beispiel.de/leistungen', fixture: 'gut.html', keyword: 'automatisierung', daysAgo: 9 },
  ]

  for (const run of runs) {
    const { result, markdown } = runEngine(run.url, run.fixture, {
      keyword: run.keyword,
      serpFile: run.serpFile,
    })
    const when = new Date(Date.now() - run.daysAgo * 86400000)

    const analysis = await db.analysis.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        createdById: user.id,
        targetUrl: run.url,
        targetKind: 'WEBSITE',
        modules: result.modules.map((m) => m.module),
        status: 'COMPLETED',
        progress: 100,
        currentStep: 'Abgeschlossen',
        scoreSeo: result.scores.seo,
        scoreAeo: result.scores.aeo,
        scoreGeo: result.scores.geo,
        scoreSerp: result.scores.serp,
        scoreOverall: result.scores.overall,
        result: result as never,
        createdAt: when,
        startedAt: when,
        finishedAt: new Date(when.getTime() + 92_000),
        reports: {
          create: {
            title: `Sichtbarkeitsanalyse ${result.target.domain}`,
            markdown,
            summary: result.executiveSummary,
            createdAt: when,
          },
        },
      },
    })
    console.log(`${run.url} → ${result.scores.overall}/10 (${analysis.id})`)
  }

  // Ein laufender Auftrag, damit die Fortschrittsanzeige zu sehen ist.
  await db.analysis.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      createdById: user.id,
      targetUrl: 'https://beispiel.de/blog/ki-automatisierung',
      targetKind: 'WEBSITE',
      modules: ['SEO', 'AEO', 'GEO', 'SERP'],
      status: 'RUNNING',
      progress: 60,
      currentStep: 'Bewertung läuft',
      startedAt: new Date(Date.now() - 70_000),
    },
  })

  await db.usageRecord.createMany({
    data: [
      { organizationId: org.id, provider: 'DATAFORSEO', operation: 'analysis', units: 1, costCredits: 18 },
      { organizationId: org.id, provider: 'DATAFORSEO', operation: 'analysis', units: 1, costCredits: 24 },
      { organizationId: org.id, provider: 'ANTHROPIC', operation: 'report', units: 1, costCredits: 5 },
      { organizationId: org.id, provider: 'PAGESPEED', operation: 'lighthouse', units: 3, costCredits: 0 },
    ],
  })

  console.log('Beispieldaten angelegt.')
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
