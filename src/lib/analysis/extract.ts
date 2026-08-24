import * as cheerio from 'cheerio'

/**
 * Aus dem HTML einer Seite die Signale ziehen, die alle drei Frameworks
 * (SEO, AEO, GEO) auswerten. Einmal parsen, mehrfach nutzen.
 */

export type PageSignals = {
  url: string
  finalUrl: string | null
  statusCode: number | null
  isHttps: boolean
  urlSlug: string
  urlDepth: number

  title: string | null
  titleLength: number
  metaDescription: string | null
  metaDescriptionLength: number
  canonical: string | null
  robotsMeta: string | null
  viewport: string | null
  lang: string | null
  hreflang: string[]

  h1: string[]
  h2: string[]
  h3: string[]
  headingOrderOk: boolean

  wordCount: number
  text: string
  first100Words: string

  images: { total: number; withAlt: number; lazy: number }
  links: { internal: number; external: number; genericAnchors: number; externalDomains: string[] }

  schemaTypes: string[]
  schemaRaw: unknown[]

  /** Fragen im Text – Grundlage der AEO-Bewertung. */
  questionHeadings: string[]
  faqBlocks: Array<{ question: string; answer: string }>
  lists: { ordered: number; unordered: number; itemsTotal: number }
  tables: number

  /** Zitierbarkeit (GEO): konkrete Zahlen, Definitionen, Quellen. */
  statistics: string[]
  definitions: string[]
  citationsToAuthority: number

  hasAuthorInfo: boolean
  authorNames: string[]
  publishedDate: string | null
  modifiedDate: string | null
  hasImprint: boolean
  hasPrivacyPolicy: boolean
  hasContact: boolean

  /** Anteil des Textes, der ohne JavaScript sichtbar ist. */
  jsDependency: 'gering' | 'mittel' | 'hoch' | 'unbekannt'
}

const GENERIC_ANCHORS = [
  'hier', 'klick hier', 'mehr', 'mehr erfahren', 'weiterlesen', 'link',
  'click here', 'read more', 'learn more', 'here',
]

const QUESTION_WORDS = /^(was|wie|warum|wann|wer|welche[rsn]?|wo|wieso|woher|wofür|kann|ist|sind|gibt|braucht|lohnt|what|how|why|when|who|which|where|can|is|are|does|do)\b/i

const AUTHORITY_DOMAINS = [
  'wikipedia.org', 'gov', '.edu', 'statista.com', 'destatis.de', 'bmwk.de',
  'ec.europa.eu', 'who.int', 'nature.com', 'harvard.edu', 'oecd.org',
]

export function extractSignals(input: {
  url: string
  html: string
  /** Markdown aus Firecrawl: gerenderter Text, inklusive JavaScript-Inhalten. */
  renderedText?: string | null
  statusCode?: number | null
  finalUrl?: string | null
}): PageSignals {
  const $ = cheerio.load(input.html)
  const url = input.url

  // Strukturierte Daten zuerst lesen – sie stecken in <script>-Knoten, die
  // gleich darauf entfernt werden.
  const { schemaTypes, schemaRaw } = extractSchema($)

  // Rein technische Knoten entfernen, damit sie den Textumfang nicht verfälschen.
  $('script, style, noscript, svg, iframe').remove()

  const title = text($('head title').first()) ?? null
  const metaDescription = attr($, 'meta[name="description"]', 'content')
  const canonical = attr($, 'link[rel="canonical"]', 'href')
  const robotsMeta = attr($, 'meta[name="robots"]', 'content')
  const viewport = attr($, 'meta[name="viewport"]', 'content')
  const lang = $('html').attr('lang')?.trim() ?? null

  const hreflang = $('link[rel="alternate"][hreflang]')
    .map((_, el) => $(el).attr('hreflang') ?? '')
    .get()
    .filter(Boolean)

  const h1 = headings($, 'h1')
  const h2 = headings($, 'h2')
  const h3 = headings($, 'h3')

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const renderedText = input.renderedText?.replace(/\s+/g, ' ').trim() ?? null
  // Der ausführlichere der beiden Texte ist die belastbarere Grundlage.
  const workingText = renderedText && renderedText.length > bodyText.length ? renderedText : bodyText
  const words = workingText.split(/\s+/).filter(Boolean)

  const faqBlocks = extractFaq($, schemaRaw)

  const parsedUrl = safeUrl(url)
  const pathSegments = parsedUrl?.pathname.split('/').filter(Boolean) ?? []

  const linkStats = analyzeLinks($, parsedUrl?.hostname ?? null)
  const imageStats = analyzeImages($)

  const questionHeadings = [...h2, ...h3].filter(
    (h) => h.includes('?') || QUESTION_WORDS.test(h.trim()),
  )

  const authorNames = extractAuthors($, schemaRaw)
  const dates = extractDates($, schemaRaw)

  const footerHtml = ($('footer').html() ?? '') + ($('body').html()?.slice(-6000) ?? '')
  const lowerAll = (bodyText + ' ' + footerHtml).toLowerCase()

  return {
    url,
    finalUrl: input.finalUrl ?? null,
    statusCode: input.statusCode ?? null,
    isHttps: parsedUrl?.protocol === 'https:',
    urlSlug: pathSegments[pathSegments.length - 1] ?? '',
    urlDepth: pathSegments.length,

    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonical,
    robotsMeta,
    viewport,
    lang,
    hreflang,

    h1,
    h2,
    h3,
    headingOrderOk: h1.length === 1 && (h2.length > 0 || words.length < 300),

    wordCount: words.length,
    text: workingText.slice(0, 40_000),
    first100Words: words.slice(0, 100).join(' '),

    images: imageStats,
    links: linkStats,

    schemaTypes,
    schemaRaw,

    questionHeadings,
    faqBlocks,
    lists: analyzeLists($),
    tables: $('table').length,

    statistics: extractStatistics(workingText),
    definitions: extractDefinitions(workingText),
    citationsToAuthority: linkStats.externalDomains.filter((d) =>
      AUTHORITY_DOMAINS.some((a) => d.includes(a)),
    ).length,

    hasAuthorInfo: authorNames.length > 0,
    authorNames,
    publishedDate: dates.published,
    modifiedDate: dates.modified,
    hasImprint: /impressum|imprint|legal notice/.test(lowerAll),
    hasPrivacyPolicy: /datenschutz|privacy policy|privacy-policy/.test(lowerAll),
    hasContact: /kontakt|contact/.test(lowerAll),

    jsDependency: judgeJsDependency(bodyText.length, renderedText?.length ?? null),
  }
}

// --- Hilfsfunktionen --------------------------------------------------------

function text(el: cheerio.Cheerio<any>): string | null {
  const value = el.text().replace(/\s+/g, ' ').trim()
  return value || null
}

function attr($: cheerio.CheerioAPI, selector: string, name: string): string | null {
  const value = $(selector).first().attr(name)?.trim()
  return value || null
}

function headings($: cheerio.CheerioAPI, tag: string): string[] {
  return $(tag)
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean)
}

function safeUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function extractSchema($: cheerio.CheerioAPI) {
  const raw: unknown[] = []
  const types = new Set<string>()

  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).contents().text()
    if (!content.trim()) return
    try {
      const parsed = JSON.parse(content)
      raw.push(parsed)
      collectTypes(parsed, types)
    } catch {
      // Fehlerhaftes JSON-LD ist selbst ein Befund, aber kein Grund abzubrechen.
    }
  })

  $('[itemtype]').each((_, el) => {
    const itemtype = $(el).attr('itemtype')
    if (itemtype) types.add(itemtype.split('/').pop() ?? itemtype)
  })

  return { schemaTypes: [...types], schemaRaw: raw }
}

function collectTypes(node: unknown, into: Set<string>) {
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, into))
    return
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    const t = obj['@type']
    if (typeof t === 'string') into.add(t)
    if (Array.isArray(t)) t.forEach((v) => typeof v === 'string' && into.add(v))
    Object.values(obj).forEach((v) => collectTypes(v, into))
  }
}

function extractFaq($: cheerio.CheerioAPI, schemaRaw: unknown[]) {
  const blocks: Array<{ question: string; answer: string }> = []

  // Bevorzugt aus dem Schema – dort ist die Zuordnung eindeutig.
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, any>
    if (obj['@type'] === 'Question' && obj.name) {
      blocks.push({
        question: String(obj.name),
        answer: String(obj.acceptedAnswer?.text ?? '').replace(/<[^>]+>/g, '').trim(),
      })
    }
    Object.values(obj).forEach(walk)
  }
  schemaRaw.forEach(walk)

  if (blocks.length === 0) {
    // Ersatzweise sichtbare Aufklapp-Elemente auswerten.
    $('details').each((_, el) => {
      const q = $(el).find('summary').first().text().trim()
      const a = $(el).clone().find('summary').remove().end().text().replace(/\s+/g, ' ').trim()
      if (q) blocks.push({ question: q, answer: a })
    })
  }

  return blocks.slice(0, 30)
}

function analyzeLinks($: cheerio.CheerioAPI, host: string | null) {
  let internal = 0
  let external = 0
  let genericAnchors = 0
  const externalDomains = new Set<string>()

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

    const anchor = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase()
    if (anchor && GENERIC_ANCHORS.includes(anchor)) genericAnchors++

    if (href.startsWith('/') || (host && href.includes(host))) {
      internal++
    } else if (/^https?:\/\//.test(href)) {
      external++
      try {
        externalDomains.add(new URL(href).hostname.replace(/^www\./, ''))
      } catch {
        // ungültige URL ignorieren
      }
    } else {
      internal++
    }
  })

  return { internal, external, genericAnchors, externalDomains: [...externalDomains] }
}

function analyzeImages($: cheerio.CheerioAPI) {
  const imgs = $('img')
  let withAlt = 0
  let lazy = 0
  imgs.each((_, el) => {
    const alt = $(el).attr('alt')
    if (alt && alt.trim().length > 2) withAlt++
    if ($(el).attr('loading') === 'lazy' || $(el).attr('data-src')) lazy++
  })
  return { total: imgs.length, withAlt, lazy }
}

function analyzeLists($: cheerio.CheerioAPI) {
  const ordered = $('ol').length
  const unordered = $('ul').length
  // Navigationslisten sind keine inhaltlichen Listen und würden das Ergebnis schönen.
  const itemsTotal = $('ol li, ul li').filter((_, el) => $(el).closest('nav, header, footer').length === 0).length
  return { ordered, unordered, itemsTotal }
}

/** Sätze mit belastbaren Zahlen – das, was eine KI gerne zitiert. */
function extractStatistics(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  return sentences
    .filter((s) => /\d+([.,]\d+)?\s*(%|Prozent|Millionen|Milliarden|Mrd|Mio|€|Euro|USD|\$|x|mal)/i.test(s))
    .filter((s) => s.length > 25 && s.length < 320)
    .slice(0, 15)
    .map((s) => s.trim())
}

/** Definitionssätze im Muster "X ist/bezeichnet/bedeutet Y". */
function extractDefinitions(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  return sentences
    .filter((s) => /\b(ist|sind|bezeichnet|bedeutet|beschreibt|meint|is|are|refers to|means)\b/i.test(s))
    .filter((s) => s.length > 40 && s.length < 300)
    .filter((s) => /^[A-ZÄÖÜ]/.test(s.trim()))
    .slice(0, 15)
    .map((s) => s.trim())
}

function extractAuthors($: cheerio.CheerioAPI, schemaRaw: unknown[]): string[] {
  const names = new Set<string>()

  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, any>
    if (obj.author) {
      const a = obj.author
      if (typeof a === 'string') names.add(a)
      else if (a?.name) names.add(String(a.name))
      else if (Array.isArray(a)) a.forEach((x) => x?.name && names.add(String(x.name)))
    }
    Object.values(obj).forEach(walk)
  }
  schemaRaw.forEach(walk)

  const metaAuthor = $('meta[name="author"]').attr('content')?.trim()
  if (metaAuthor) names.add(metaAuthor)

  $('[rel="author"], .author, .author-name, [itemprop="author"]').each((_, el) => {
    const value = $(el).text().replace(/\s+/g, ' ').trim()
    if (value && value.length < 80) names.add(value)
  })

  return [...names].slice(0, 5)
}

function extractDates($: cheerio.CheerioAPI, schemaRaw: unknown[]) {
  let published: string | null = null
  let modified: string | null = null

  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, any>
    if (!published && typeof obj.datePublished === 'string') published = obj.datePublished
    if (!modified && typeof obj.dateModified === 'string') modified = obj.dateModified
    Object.values(obj).forEach(walk)
  }
  schemaRaw.forEach(walk)

  published ??= $('meta[property="article:published_time"]').attr('content') ?? null
  modified ??= $('meta[property="article:modified_time"]').attr('content') ?? null
  published ??= $('time[datetime]').first().attr('datetime') ?? null

  return { published, modified }
}

/**
 * Wie stark hängt der Inhalt an JavaScript? Grosse Differenz zwischen rohem
 * HTML und gerendertem Text bedeutet: einfache Crawler – und damit viele
 * KI-Systeme – sehen die Seite praktisch leer.
 */
function judgeJsDependency(rawLength: number, renderedLength: number | null): PageSignals['jsDependency'] {
  if (renderedLength === null) return 'unbekannt'
  if (rawLength < 200) return 'hoch'
  const ratio = rawLength / Math.max(renderedLength, 1)
  if (ratio > 0.8) return 'gering'
  if (ratio > 0.45) return 'mittel'
  return 'hoch'
}
