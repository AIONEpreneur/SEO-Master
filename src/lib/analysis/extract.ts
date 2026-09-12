import * as cheerio from 'cheerio'
import type { Weiterleitung } from './abruf'

/**
 * Aus dem HTML einer Seite die Signale ziehen, die alle drei Frameworks
 * (SEO, AEO, GEO) auswerten. Einmal parsen, mehrfach nutzen.
 */

export type PageSignals = {
  url: string
  /**
   * Die Adresse, die am Ende wirklich ausgeliefert wurde.
   *
   * Alles, was über "diese Seite" geurteilt wird — allen voran das
   * Canonical —, muss sich hierauf beziehen, nie auf `url`. Wer
   * `beispiel.de/seite` anfragt und auf `beispiel.de/seite/` landet, bekäme
   * sonst ein Urteil über eine Adresse, die es so nicht mehr gibt.
   */
  finalUrl: string | null
  /** Angefragt, ausgeliefert, und was dazwischen lag. Die einzige Quelle dafür. */
  weiterleitung: Weiterleitung | null
  /**
   * Wie viele Überschriften in eingebetteten Inhalten standen und deshalb
   * nicht gezählt wurden. Null ist der Normalfall.
   */
  ueberschriftenAusRahmen: number
  /**
   * Wurde die Struktur aus einer aufbereiteten Fassung gelesen statt aus dem
   * HTML des Servers? Dann sind Aussagen über Überschriften nicht belastbar —
   * aufbereitete Fassungen ziehen Fremdinhalt ins Dokument hinein.
   */
  strukturAusZweiterHand: boolean
  /** Fremde Adressen, aus denen die Seite Inhalt einbettet. */
  fremdeHosts: string[]
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

  images: {
    total: number
    /** Bilder mit beschreibendem Alt-Text. */
    withAlt: number
    /** Bilder mit alt="" – korrekt gekennzeichnet als schmückend, kein Mangel. */
    decorative: number
    /** Bilder ganz ohne alt-Attribut – nur das ist ein Mangel. */
    withoutAlt: number
    /** Dateinamen der Bilder ohne alt, damit der Befund nachprüfbar ist. */
    missingAltSources: string[]
    /** Die beschreibenden Alt-Texte selbst — dort steht oft, wer zu sehen ist. */
    altTexte: string[]
    lazy: number
  }
  links: { internal: number; external: number; genericAnchors: number; externalDomains: string[] }

  schemaTypes: string[]
  schemaRaw: unknown[]

  /** Fragen im Text – Grundlage der AEO-Bewertung. */
  questionHeadings: string[]
  /**
   * Zu jeder Frage-Überschrift die Länge der Antwort, die ihr folgt.
   *
   * Gezählt wird am Dokument, nicht am Fliesstext: Die Antwort steht oft in
   * einem eigenen Kasten statt in einem Absatz direkt daneben. Wer nur den
   * nächsten Absatz ansieht, übersieht genau diese Form — und meldet ein
   * Fehlen, wo eine gute Kurzantwort steht.
   */
  frageAntworten: Array<{ frage: string; worte: number; imKasten: boolean }>
  faqBlocks: Array<{ question: string; answer: string }>
  lists: { ordered: number; unordered: number; itemsTotal: number }
  tables: number

  /** Zitierbarkeit (GEO): konkrete Zahlen, Definitionen, Quellen. */
  statistics: string[]
  definitions: string[]
  citationsToAuthority: number

  hasAuthorInfo: boolean
  authorNames: string[]
  /**
   * Namen aus einem eigenständigen Person-Schema — auch wenn sie nicht unter
   * `author` hängen. Eine Seite, die sich ausführlich vorstellt, trägt die
   * Person oft als eigenen Knoten und nirgends als Autorin.
   */
  personenImSchema: string[]
  /** Einer dieser Namen steht im sichtbaren Text. */
  autorImText: boolean
  /** Einer dieser Namen steht in einem Bild-Alt-Text. */
  autorInAltText: boolean
  publishedDate: string | null
  modifiedDate: string | null
  /**
   * Ein Datum, das sichtbar auf der Seite steht (ISO, nur der Tag).
   *
   * Getrennt von publishedDate und modifiedDate, die aus Schema und
   * Meta-Angaben stammen. Erst der Vergleich beider zeigt, ob die Seite ihren
   * Leserinnen etwas anderes sagt als den Suchmaschinen.
   */
  sichtbaresDatum: string | null
  /** Die Textstelle, aus der es stammt — damit der Befund nachprüfbar ist. */
  sichtbaresDatumFundstelle: string | null
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

/**
 * Sichtbaren Text aus gerendertem HTML gewinnen – ohne eingebettete Frames.
 *
 * Der Anlass: Als "gerenderter Text" diente bisher Firecrawls Markdown, und
 * das liest eingebettete Frames mit – Newsletter-Formulare, Buchungs-Widgets,
 * Video-Einbettungen. Deren Text ist aber nicht der Inhalt der Seite: Er
 * steht in einem eigenen Dokument eines fremden Anbieters. Die Folge waren
 * Fehlalarme mit höchster Priorität ("Inhalt entsteht erst durch JavaScript"),
 * weil das rohe HTML gegen einen Text verglichen wurde, der zu grossen Teilen
 * aus dem Frame stammte.
 *
 * Hier wird der gerenderte Text deshalb genauso gewonnen wie der rohe:
 * gleiche Bereinigung, Frames ausgeschlossen. Nur so misst der Vergleich
 * die JavaScript-Abhängigkeit der Seite selbst.
 */
/**
 * Was nicht zum Dokument gehört.
 *
 * `iframe` allein reichte nicht. Eingebettet wird auch über `object`,
 * `embed` und `frame`, und `template` trägt Inhalt, den der Browser gar
 * nicht anzeigt. Alles davon ist fremder oder nicht sichtbarer Inhalt und
 * darf weder in den Textumfang noch — vor allem — in die Überschriften
 * eingehen: Ein Buchungs-Widget bringt eigene h2 mit, und die Seite bekam
 * dafür bisher gute Noten für eine Gliederung, die ihr nicht gehört.
 */
const EINGEBETTET = 'iframe, frame, frameset, object, embed, template, portal'
const TECHNISCH = 'script, style, noscript, svg'

export function gerenderterText(html: string): string {
  const $ = cheerio.load(html)
  $(`${TECHNISCH}, ${EINGEBETTET}`).remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}

export function extractSignals(input: {
  url: string
  html: string
  /** Markdown aus Firecrawl: gerenderter Text, inklusive JavaScript-Inhalten. */
  renderedText?: string | null
  statusCode?: number | null
  finalUrl?: string | null
  weiterleitung?: Weiterleitung | null
  strukturAusZweiterHand?: boolean
}): PageSignals {
  const $ = cheerio.load(input.html)
  const url = input.url

  // Strukturierte Daten zuerst lesen – sie stecken in <script>-Knoten, die
  // gleich darauf entfernt werden.
  const { schemaTypes, schemaRaw } = extractSchema($)

  /*
    Erst zählen, was in eingebetteten Inhalten steckt — dann entfernen.

    Die Zahl wird gebraucht: Eine Seite, deren einzige h1 aus einem
    fremden Rahmen kam, hat keine h1. Das gehört im Bericht gesagt, sonst
    liest sich der Befund "keine h1 gefunden" wie ein Messfehler, und die
    Betreiberin sucht auf ihrer Seite nach etwas, das dort nie stand.
  */
  const ueberschriftenAusRahmen = $(EINGEBETTET).find('h1, h2, h3').length

  /*
    Aus welchen fremden Adressen bettet die Seite ein?

    Das entscheidet später, ob eine Empfehlung überhaupt ausführbar ist. Wer
    ein Buchungssystem von einem fremden Host einbindet, kann dessen Inhalt
    nicht umschreiben und ihn schon gar nicht "direkt in die Seite
    übernehmen" — eine Massnahme, die niemand ausführen kann, gehört nicht
    in eine Prioritätenliste.
  */
  const eigenerHost = safeUrl(input.finalUrl ?? url)?.hostname.replace(/^www\./, '').toLowerCase()
  const fremdeHosts = [
    ...new Set(
      $('iframe[src], frame[src], object[data], embed[src]')
        .map((_, el) => $(el).attr('src') ?? $(el).attr('data') ?? '')
        .get()
        .map((quelle) => safeUrl(quelle.startsWith('//') ? `https:${quelle}` : quelle)?.hostname)
        .filter((host): host is string => Boolean(host))
        .map((host) => host.replace(/^www\./, '').toLowerCase())
        .filter((host) => host !== eigenerHost),
    ),
  ]

  $(`${TECHNISCH}, ${EINGEBETTET}`).remove()

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
  const frageAntworten = extractFrageAntworten($, questionHeadings)

  // Eine Seite, die sich ausführlich vorstellt, trägt die Person oft als
  // eigenen Schema-Knoten und nirgends als `author`. Steht dieser Name auch
  // sichtbar auf der Seite — im Text oder in einem Bild-Alt-Text —, dann ist
  // die Autorschaft erkennbar, und ein Befund "fehlt" wäre schlicht falsch.
  const personenImSchema = extractPersonen(schemaRaw)
  const altText = imageStats.altTexte.join(' ')
  const autorImText = personenImSchema.some((n) => nameKommtVor(n, workingText))
  const autorInAltText = personenImSchema.some((n) => nameKommtVor(n, altText))
  const erkannteAutoren = [
    ...new Set([
      ...authorNames,
      ...(autorImText || autorInAltText ? personenImSchema : []),
    ]),
  ].slice(0, 5)

  const sichtbar = extractSichtbaresDatum($)

  const footerHtml = ($('footer').html() ?? '') + ($('body').html()?.slice(-6000) ?? '')
  const lowerAll = (bodyText + ' ' + footerHtml).toLowerCase()

  return {
    url,
    finalUrl: input.finalUrl ?? null,
    weiterleitung: input.weiterleitung ?? null,
    ueberschriftenAusRahmen,
    strukturAusZweiterHand: input.strukturAusZweiterHand ?? false,
    fremdeHosts,
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
    frageAntworten,
    faqBlocks,
    lists: analyzeLists($),
    tables: $('table').length,

    statistics: extractStatistics(workingText),
    definitions: extractDefinitions(workingText),
    citationsToAuthority: linkStats.externalDomains.filter((d) =>
      AUTHORITY_DOMAINS.some((a) => d.includes(a)),
    ).length,

    hasAuthorInfo: erkannteAutoren.length > 0,
    authorNames: erkannteAutoren,
    personenImSchema,
    autorImText,
    autorInAltText,
    publishedDate: dates.published,
    modifiedDate: dates.modified,
    sichtbaresDatum: sichtbar.datum,
    sichtbaresDatumFundstelle: sichtbar.fundstelle,
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

/**
 * Bilder zählen – mit dem Unterschied, auf den es ankommt.
 *
 * Ein leeres alt="" ist kein Versäumnis, sondern die vorgeschriebene
 * Kennzeichnung für ein rein schmückendes Bild: Screenreader überspringen es
 * dann, statt einen Dateinamen vorzulesen. Wer das als Mangel meldet,
 * verlangt eine Verschlechterung.
 *
 * Ein Mangel ist nur das ganz fehlende alt-Attribut. Und weil eine Behauptung
 * über fremde Bilder nachprüfbar sein muss, werden die betroffenen Quellen
 * mitgeführt – der Bericht nennt sie dann beim Namen.
 */
function analyzeImages($: cheerio.CheerioAPI) {
  const imgs = $('img')
  let withAlt = 0
  let decorative = 0
  let lazy = 0
  const missingAltSources: string[] = []
  const altTexte: string[] = []

  imgs.each((_, el) => {
    const alt = $(el).attr('alt')
    if (alt === undefined) {
      const quelle = $(el).attr('src') ?? $(el).attr('data-src') ?? ''
      missingAltSources.push(quelle.split('/').pop() || quelle || '(ohne src)')
    } else if (alt.trim().length > 0) {
      withAlt++
      altTexte.push(alt.replace(/\s+/g, ' ').trim())
    } else {
      decorative++
    }
    if ($(el).attr('loading') === 'lazy' || $(el).attr('data-src')) lazy++
  })

  return {
    total: imgs.length,
    withAlt,
    decorative,
    withoutAlt: missingAltSources.length,
    missingAltSources: missingAltSources.slice(0, 8),
    altTexte: altTexte.slice(0, 40),
    lazy,
  }
}

function analyzeLists($: cheerio.CheerioAPI) {
  const ordered = $('ol').length
  const unordered = $('ul').length
  // Navigationslisten sind keine inhaltlichen Listen und würden das Ergebnis
  // schönen. Aber: <header> ist nur dann Seitenrahmen, wenn es direkt unter
  // <body> hängt. Ein <header> innerhalb einer Section ist eine gewöhnliche
  // Abschnittseinleitung – die frühere Pauschale schluckte dort ganze
  // Inhaltslisten, und der Bericht zählte vier Punkte, wo sieben standen.
  const itemsTotal = $('ol li, ul li')
    .filter((_, el) => {
      if ($(el).closest('nav').length > 0) return false
      const rahmen = $(el).parents('header, footer').filter((_, r) => $(r).parent().is('body')).length
      return rahmen === 0
    })
    .length
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
    // Häufig steht im selben Element noch "Von …" und ein Datum. Nur den
    // Namensteil übernehmen, sonst landet die halbe Zeile als Autorenname
    // im Bericht.
    const name = value
      .split(/[·|•]|\s+[–—]\s+/)[0]
      .replace(/^(von|by|geschrieben von|autor(in)?:?)\s+/i, '')
      .trim()
    if (name && name.length >= 3 && name.length < 60) names.add(name)
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

/** Namen aus eigenständigen Person-Knoten im Schema — unabhängig von `author`. */
/**
 * Was folgt auf eine Frage-Überschrift?
 *
 * Der alte Weg zählte Absätze passender Länge irgendwo im Fliesstext — ohne
 * zu wissen, ob sie zu einer Frage gehören, und ohne die Absatzgrenzen, die
 * beim Plattmachen des Textes längst verloren gegangen waren.
 *
 * Hier wird stattdessen am Dokument entlanggegangen: von der Überschrift zu
 * den nachfolgenden Geschwistern. Ist das erste davon ein Kasten (div,
 * section, blockquote, aside …), zählt sein Inhalt — genau die Form, die der
 * alte Weg übersah. Weiter als bis zur nächsten Überschrift wird nie
 * gelesen, sonst würde die Antwort der nächsten Frage mitgezählt.
 */
function extractFrageAntworten(
  $: cheerio.CheerioAPI,
  fragen: string[],
): PageSignals['frageAntworten'] {
  if (fragen.length === 0) return []

  const gesucht = new Set(fragen.map((f) => f.replace(/\s+/g, ' ').trim()))
  const ergebnis: PageSignals['frageAntworten'] = []

  $('h2, h3').each((_, el) => {
    const frage = $(el).text().replace(/\s+/g, ' ').trim()
    if (!gesucht.has(frage)) return

    let worte = 0
    let imKasten = false

    let knoten = $(el).next()
    // Ein paar Geschwister weit: Zwischen Überschrift und Antwort stehen
    // gern eine Trennlinie, ein Bild oder ein leerer Absatz.
    for (let i = 0; i < 4 && knoten.length > 0; i++) {
      const tag = (knoten.prop('tagName') ?? '').toLowerCase()
      if (/^h[1-6]$/.test(tag)) break

      const inhalt = knoten.text().replace(/\s+/g, ' ').trim()
      if (inhalt.length > 0) {
        worte = inhalt.split(/\s+/).filter(Boolean).length
        imKasten = tag !== 'p'
        break
      }
      knoten = knoten.next()
    }

    // Steht die Frage selbst in einem Kasten, hat sie keine Geschwister —
    // dann trägt der umschliessende Kasten die Antwort.
    if (worte === 0) {
      const eltern = $(el).parent()
      const drin = eltern.text().replace(/\s+/g, ' ').trim().replace(frage, '').trim()
      if (drin.length > 0) {
        worte = drin.split(/\s+/).filter(Boolean).length
        imKasten = true
      }
    }

    ergebnis.push({ frage, worte, imKasten })
  })

  return ergebnis.slice(0, 30)
}

/** Namen aus eigenständigen Person-Knoten im Schema — unabhängig von `author`. */
function extractPersonen(schemaRaw: unknown[]): string[] {
  const namen = new Set<string>()

  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, any>
    const typen = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']]
    if (typen.some((t) => typeof t === 'string' && /^person$/i.test(t))) {
      const name = typeof obj.name === 'string' ? obj.name.trim() : ''
      if (name.length >= 3 && name.length < 60) namen.add(name)
    }
    Object.values(obj).forEach(walk)
  }
  schemaRaw.forEach(walk)

  return [...namen].slice(0, 5)
}

/**
 * Steht der Name irgendwo im Text?
 *
 * Verlangt wird der vollständige Name, nicht einzelne Bestandteile: „Anna"
 * allein kommt auf jeder zweiten Seite vor und wäre kein Nachweis. Zwischen
 * den Namensteilen darf beliebiger Leerraum stehen, damit ein Zeilenumbruch
 * im Quelltext den Fund nicht verhindert.
 */
function nameKommtVor(name: string, wo: string): boolean {
  const teile = name.split(/\s+/).filter((t) => t.length >= 2)
  if (teile.length === 0) return false
  const muster = teile.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
  return new RegExp(muster, 'i').test(wo)
}

/**
 * Monatsnamen ausgeschrieben — die häufigste Form auf deutschen Seiten.
 *
 * „24. August 2026" ist für Leserinnen gedacht und taucht in keinem
 * Schema-Feld auf. Genau deshalb kann sie von der maschinenlesbaren Angabe
 * abweichen, ohne dass es jemandem auffällt.
 */
const MONATE: Record<string, number> = {
  januar: 1, jänner: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
}

/**
 * Stellen, an denen ein Datum als Datum ausgezeichnet ist.
 *
 * Alles andere ist Fliesstext. In einem Beitrag über die Steuerreform steht
 * "seit dem 1. Januar 2025" — das ist kein Seitendatum, sondern ein Satz.
 * Es als Aktualisierungsdatum zu lesen und gegen das Schema zu stellen,
 * erzeugt einen Widerspruch, den es nicht gibt.
 */
const DATUMS_STELLEN = [
  'time[datetime]',
  'time',
  '[itemprop="dateModified"]',
  '[itemprop="datePublished"]',
  '[class*="datum" i]',
  '[class*="date" i]',
  '[class*="updated" i]',
  '[class*="modified" i]',
  '[class*="published" i]',
].join(', ')

/**
 * Das sichtbare Datum der Seite — nur aus ausgezeichneten Stellen.
 *
 * Früher wurde um jeden Treffer von "aktualisiert" ein Fenster von 80
 * Zeichen aus dem Fliesstext geschnitten und darin nach einem Datum
 * gesucht. Das war der Fehler: Ein Satz wie "zuletzt aktualisiert habe ich
 * meine Preise im Mai 2024" ist Inhalt, keine Auszeichnung. Wer daraus ein
 * Seitendatum macht, meldet anschliessend einen Widerspruch zum Schema,
 * den die Betreiberin auf ihrer Seite vergeblich sucht.
 *
 * Gelesen wird deshalb nur, was der Seitenbau als Datum gekennzeichnet hat:
 * ein <time>-Element, ein itemprop, oder ein Element, dessen Klasse es als
 * Datumsangabe benennt. Findet sich dort nichts, gibt es kein sichtbares
 * Datum — und dann wird auch nichts verglichen.
 */
function extractSichtbaresDatum($: cheerio.CheerioAPI): {
  datum: string | null
  fundstelle: string | null
} {
  let gefunden: { datum: string; fundstelle: string } | null = null

  $(DATUMS_STELLEN).each((_, el) => {
    if (gefunden) return
    const knoten = $(el)
    // Das Attribut ist verlässlicher als der Text: <time datetime="2026-08-24">
    // trägt oft nur "vor drei Wochen" als sichtbaren Inhalt.
    const attribut = knoten.attr('datetime') ?? knoten.attr('content')
    const roh = knoten.text().replace(/\s+/g, ' ').trim().slice(0, 70)
    const datum = (attribut ? leseDatum(attribut) : null) ?? leseDatum(roh)
    if (datum) gefunden = { datum, fundstelle: roh || (attribut ?? '') }
  })

  return gefunden ?? { datum: null, fundstelle: null }
}

/** Ein deutsches Datum aus einem kurzen Textstück lesen. */
export function leseDatum(stelle: string): string | null {
  const ausgeschrieben = stelle.match(
    /(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})/,
  )
  if (ausgeschrieben) {
    const monat = MONATE[ausgeschrieben[2].toLowerCase()]
    if (monat) return alsTag(Number(ausgeschrieben[1]), monat, Number(ausgeschrieben[3]))
  }

  const numerisch = stelle.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (numerisch) {
    return alsTag(Number(numerisch[1]), Number(numerisch[2]), Number(numerisch[3]))
  }

  const iso = stelle.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  return null
}

function alsTag(tag: number, monat: number, jahr: number): string | null {
  if (tag < 1 || tag > 31 || monat < 1 || monat > 12 || jahr < 1990 || jahr > 2100) return null
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
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
