import type { PageSignals } from './extract'
import type { Criterion, Finding, ModuleResult } from './types'
import { weightedScore, scoreLabel, statusFor } from './types'
import type { PageSpeedResult } from '@/lib/connectors/pagespeed'
import type { BacklinksSummaryResult, DomainRankResult } from '@/lib/connectors/dataforseo'
import type { OpenSeoDomainOverview } from '@/lib/connectors/openseo'
import { deckungsgrad, enthaeltBegriff, teileMarke } from './begriffe'
import { beurteileKanonisch, kanonischeNote, kanonischerHinweis, kanonischerBefund } from './kanonisch'
import { leseChecks, checkBefunde, checkNote } from './onpage-checks'

/**
 * SEO-Bewertung nach dem Framework:
 *   Technik 30 % · On-Page 40 % · E-E-A-T 20 % · Off-Page 10 %
 */
export function analyzeSeo(input: {
  signals: PageSignals
  pagespeed?: PageSpeedResult | null
  backlinks?: BacklinksSummaryResult | null
  domainRank?: DomainRankResult | null
  primaryKeyword?: string | null
  /** `checks`-Objekt aus der OnPage-API; fehlt, wenn der Abruf nicht lief. */
  onPageChecks?: Record<string, boolean> | null
  /**
   * Domain-Übersicht aus OpenSEO (docs/OPENSEO-INTEGRATION.md). Zweite
   * Datenquelle unter demselben Raster: springt beim Backlink-Kriterium ein,
   * wenn der direkte DataForSEO-Abruf ausfiel.
   */
  openSeo?: OpenSeoDomainOverview | null
}): ModuleResult {
  const { signals: s, pagespeed, backlinks, domainRank, openSeo } = input
  const findings: Finding[] = []
  const keyword = input.primaryKeyword?.trim() || null

  // --- Technisches SEO ------------------------------------------------------
  const technical: Criterion[] = []

  // Title
  {
    const len = s.titleLength
    let score = 0
    let detail: string
    if (!s.title) {
      score = 0
      detail = 'Kein Title-Tag vorhanden.'
      findings.push({
        id: 'seo-title-missing',
        severity: 'critical',
        title: 'Title-Tag fehlt',
        why: 'Ohne Title hat Google kein Ranking-Signal und erfindet einen eigenen Titel aus dem Seiteninhalt.',
        action: 'Title-Tag mit dem Muster `[Hauptkeyword] — [Nutzen] | [Marke]` ergänzen, 50–60 Zeichen.',
        effort: 'gering',
        impact: 'hoch',
      })
    } else if (len < 30) {
      score = 4
      detail = `${len} Zeichen – zu kurz, verschenkt Platz für Keywords.`
      findings.push({
        id: 'seo-title-short',
        severity: 'quickwin',
        title: `Title mit ${len} Zeichen zu kurz`,
        why: 'Kurze Titles nutzen den verfügbaren Platz im Suchergebnis nicht aus.',
        action: `Title auf 50–60 Zeichen erweitern. Aktuell: "${s.title}"`,
        effort: 'gering',
        impact: 'mittel',
        evidence: s.title,
      })
    } else if (len > 65) {
      // Google kürzt von hinten. Steht hinten der Markenname, geht die
      // Aussage nicht verloren – dann ist die Gesamtlänge kein Mangel.
      const { kern, marke } = teileMarke(s.title)
      if (marke && kern.length <= 60) {
        score = keyword && deckungsgrad(s.title, keyword) >= 0.67 ? 9 : 7
        detail = `${len} Zeichen, ohne den Markenzusatz "${marke}" nur ${kern.length} – abgeschnitten wird der Name, nicht die Aussage.`
      } else {
        score = 5
        detail = marke
          ? `${len} Zeichen, auch ohne den Markenzusatz noch ${kern.length} – die Aussage selbst wird abgeschnitten.`
          : `${len} Zeichen – wird in der Suche abgeschnitten.`
        findings.push({
          id: 'seo-title-long',
          severity: 'quickwin',
          title: `Title mit ${marke ? `${kern.length} Zeichen Aussage` : `${len} Zeichen`} zu lang`,
          why: marke
            ? `Google kürzt ab etwa 60 Zeichen von hinten. Der Markenzusatz "${marke}" darf dabei wegfallen – hier reicht aber schon die Aussage selbst über die Grenze hinaus.`
            : 'Google kürzt ab etwa 60 Zeichen; der hintere Teil wird nicht gelesen.',
          action: `Die Aussage auf 50–60 Zeichen kürzen und das Hauptkeyword nach vorne ziehen${marke ? ' – der Markenzusatz kann bleiben' : ''}. Aktuell: "${s.title}"`,
          effort: 'gering',
          impact: 'mittel',
          evidence: s.title,
        })
      }
    } else {
      score = keyword && deckungsgrad(s.title, keyword) >= 0.67 ? 9 : 7
      detail = `${len} Zeichen, im optimalen Bereich.`
    }
    technical.push({ key: 'title', label: 'Title-Tag', score, weight: 3, detail, status: statusFor(score) })
  }

  // Meta Description
  {
    const len = s.metaDescriptionLength
    let score: number
    let detail: string
    if (!s.metaDescription) {
      score = 2
      detail = 'Keine Meta Description – Google generiert einen eigenen Textausschnitt.'
      findings.push({
        id: 'seo-metadesc-missing',
        severity: 'quickwin',
        title: 'Meta Description fehlt',
        why: 'Google baut sich sonst selbst einen Textausschnitt zusammen – meist ohne Nutzenversprechen und ohne Handlungsaufforderung.',
        action: 'Meta Description mit 140–160 Zeichen ergänzen: konkreter Nutzen + Handlungsaufforderung.',
        effort: 'gering',
        impact: 'mittel',
      })
    } else if (len < 100 || len > 170) {
      score = 5
      detail = `${len} Zeichen – ausserhalb des optimalen Bereichs (140–160).`
      findings.push({
        id: 'seo-metadesc-length',
        severity: 'quickwin',
        title: `Meta Description mit ${len} Zeichen ${len < 100 ? 'zu kurz' : 'zu lang'}`,
        why: len < 100 ? 'Verschenkter Platz im Suchergebnis.' : 'Wird abgeschnitten, die Handlungsaufforderung geht verloren.',
        action: 'Auf 140–160 Zeichen anpassen.',
        effort: 'gering',
        impact: 'gering',
        evidence: s.metaDescription,
      })
    } else {
      score = 8
      detail = `${len} Zeichen, gute Länge.`
    }
    technical.push({ key: 'metaDescription', label: 'Meta Description', score, weight: 2, detail, status: statusFor(score) })
  }

  // H1
  {
    let score: number
    let detail: string
    if (s.h1.length === 0) {
      score = 1
      detail = 'Kein H1 vorhanden.'
      findings.push({
        id: 'seo-h1-missing',
        severity: 'critical',
        title: 'H1-Überschrift fehlt',
        why: 'Das H1 ist das stärkste inhaltliche Strukturmerkmal der Seite. Fehlt es, muss Google das Thema erraten.',
        action: 'Genau ein H1 setzen, das das Hauptkeyword enthält und den Title ergänzt statt ihn zu wiederholen.',
        effort: 'gering',
        impact: 'hoch',
      })
    } else if (s.h1.length > 1) {
      score = 4
      detail = `${s.h1.length} H1-Überschriften – die Hierarchie ist unklar.`
      findings.push({
        id: 'seo-h1-multiple',
        severity: 'quickwin',
        title: `${s.h1.length} H1-Überschriften auf einer Seite`,
        why: 'Mehrere H1 verwässern das thematische Hauptsignal.',
        action: `Auf ein H1 reduzieren, die übrigen zu H2 machen. Gefunden: ${s.h1.slice(0, 3).map((h) => `"${h}"`).join(', ')}`,
        effort: 'gering',
        impact: 'mittel',
      })
    } else {
      const sameAsTitle = s.title && s.h1[0].toLowerCase().trim() === s.title.toLowerCase().trim()
      score = sameAsTitle ? 6 : keyword && deckungsgrad(s.h1[0] ?? null, keyword) >= 0.67 ? 9 : 7
      detail = sameAsTitle
        ? 'Genau ein H1, aber wortgleich mit dem Title – ungenutztes Potenzial.'
        : `Genau ein H1: "${s.h1[0].slice(0, 80)}"`
    }
    technical.push({ key: 'h1', label: 'H1-Überschrift', score, weight: 3, detail, status: statusFor(score) })
  }

  // Überschriftenhierarchie
  {
    const score = s.h2.length === 0 ? (s.wordCount < 300 ? 5 : 2) : s.h2.length >= 3 ? 8 : 6
    const detail = `${s.h2.length} H2, ${s.h3.length} H3.`
    if (s.h2.length === 0 && s.wordCount >= 300) {
      findings.push({
        id: 'seo-headings-flat',
        severity: 'quickwin',
        title: 'Keine Zwischenüberschriften',
        why: 'Ein Textblock ohne H2 ist für Leserinnen und für Suchmaschinen gleichermassen schwer zu erfassen.',
        action: 'Den Text in 3–6 thematische Abschnitte gliedern und je ein H2 setzen – idealerweise als W-Frage formuliert.',
        effort: 'mittel',
        impact: 'mittel',
      })
    }
    technical.push({ key: 'headings', label: 'Überschriftenstruktur', score, weight: 2, detail, status: statusFor(score) })
  }

  // URL
  {
    const slugWords = s.urlSlug.split('-').filter(Boolean).length
    let score = s.isHttps ? 7 : 3
    if (s.urlDepth > 4) score -= 2
    if (slugWords > 6) score -= 1
    // Der Slug trennt mit Bindestrichen; die Wortfolge ebnet das ein, sodass
    // "online-business" und "online business" hier zusammenfinden.
    if (keyword && enthaeltBegriff(s.urlSlug, keyword)) score += 2
    score = clamp(score)
    const detail = `${s.isHttps ? 'HTTPS' : 'KEIN HTTPS'}, Tiefe ${s.urlDepth}, Slug "${s.urlSlug || '/'}".`
    if (!s.isHttps) {
      findings.push({
        id: 'seo-no-https',
        severity: 'critical',
        title: 'Seite läuft ohne HTTPS',
        why: 'HTTPS ist Ranking-Faktor und Vertrauenssignal; Browser markieren die Seite zusätzlich als unsicher.',
        action: 'SSL-Zertifikat einrichten (bei Hostinger kostenlos über Let\'s Encrypt) und alles per 301 auf HTTPS umleiten.',
        effort: 'gering',
        impact: 'hoch',
      })
    }
    technical.push({ key: 'url', label: 'URL-Struktur', score, weight: 1, detail, status: statusFor(score) })
  }

  // Canonical
  {
    const urteil = beurteileKanonisch({ canonical: s.canonical, url: s.url, finalUrl: s.finalUrl })
    const befund = kanonischerBefund(urteil)
    if (befund) findings.push(befund)
    const score = kanonischeNote(urteil)
    technical.push({
      key: 'canonical',
      label: 'Canonical-Tag',
      score,
      weight: 2,
      detail: kanonischerHinweis(urteil),
      status: statusFor(score),
    })
  }

  // Technische Mängel aus der OnPage-API
  {
    if (input.onPageChecks) {
      const maengel = leseChecks(input.onPageChecks)
      findings.push(...checkBefunde(maengel))
      const score = checkNote(maengel)
      technical.push({
        key: 'onpage-checks',
        label: 'Technische Prüfpunkte',
        score,
        weight: 2,
        detail:
          maengel.length === 0
            ? 'Keiner der geprüften technischen Punkte ist auffällig.'
            : `${maengel.length} auffällige${maengel.length === 1 ? 'r Punkt' : ' Punkte'}: ${maengel.map((m) => m.title).join(', ')}.`,
        status: statusFor(score),
      })
    } else {
      technical.push({
        key: 'onpage-checks',
        label: 'Technische Prüfpunkte',
        score: 0,
        weight: 2,
        detail: 'Nicht geprüft: Die technische Abfrage bei DataForSEO lief nicht.',
        status: 'unknown',
      })
    }
  }

  // Strukturierte Daten
  {
    const types = s.schemaTypes
    const hasContentSchema = types.some((t) => /Article|BlogPosting|WebPage|Product|Service/i.test(t))
    const hasEntitySchema = types.some((t) => /Organization|Person|LocalBusiness/i.test(t))
    let score = 1
    if (types.length > 0) score = 4
    if (hasContentSchema) score += 2
    if (hasEntitySchema) score += 2
    if (types.some((t) => /FAQPage|HowTo/i.test(t))) score += 2
    score = clamp(score)
    const detail = types.length ? `Gefunden: ${types.slice(0, 8).join(', ')}` : 'Keine strukturierten Daten gefunden.'
    if (types.length === 0) {
      findings.push({
        id: 'seo-schema-missing',
        severity: 'critical',
        title: 'Keine strukturierten Daten (Schema.org)',
        why: 'Ohne Schema versteht Google die Seite nur über den Fliesstext – Rich Results und Snippet-Platzierungen fallen damit weg.',
        action: 'JSON-LD ergänzen: Organization oder Person für die Marke, dazu Article/WebPage für den Inhalt und FAQPage für den Fragenbereich.',
        effort: 'mittel',
        impact: 'hoch',
      })
    } else if (!hasEntitySchema) {
      findings.push({
        id: 'seo-schema-entity',
        severity: 'quickwin',
        title: 'Kein Organization- oder Person-Schema',
        why: 'Damit fehlt Suchmaschinen und KI-Systemen die eindeutige Zuordnung, wer hinter der Seite steht.',
        action: 'JSON-LD mit `Person` oder `Organization` ergänzen – inklusive `sameAs`-Verweisen auf die Social-Profile.',
        effort: 'gering',
        impact: 'mittel',
      })
    }
    technical.push({ key: 'schema', label: 'Strukturierte Daten', score, weight: 3, detail, status: statusFor(score) })
  }

  // Mobil & Geschwindigkeit
  {
    const perf = pagespeed?.scores.performance ?? null
    let score: number
    let detail: string
    if (perf === null) {
      score = s.viewport ? 6 : 3
      detail = s.viewport ? 'Viewport gesetzt; keine Geschwindigkeitsmessung verfügbar.' : 'Kein Viewport-Tag – die Seite ist vermutlich nicht mobil optimiert.'
    } else {
      score = clamp(Math.round(perf / 10))
      const lcp = pagespeed?.lab.lcp ? `${(pagespeed.lab.lcp / 1000).toFixed(1)} s` : 'n/a'
      detail = `PageSpeed ${perf}/100 (mobil), LCP ${lcp}.`
      if (perf < 50) {
        findings.push({
          id: 'seo-performance',
          severity: 'critical',
          title: `Ladegeschwindigkeit kritisch (${perf}/100)`,
          why: 'Langsame Seiten verlieren Nutzerinnen vor dem ersten Kontakt und ranken schlechter.',
          action: pagespeed?.opportunities.length
            ? `Grösste Hebel laut Messung: ${pagespeed.opportunities.slice(0, 3).map((o) => o.title).join(', ')}.`
            : 'Bilder in WebP konvertieren, Lazy Loading aktivieren, nicht benötigtes JavaScript entfernen.',
          effort: 'mittel',
          impact: 'hoch',
        })
      }
    }
    technical.push({ key: 'performance', label: 'Geschwindigkeit & Mobil', score, weight: 2, detail, status: statusFor(score) })
  }

  // Bilder
  {
    const { total, withAlt, decorative, withoutAlt, missingAltSources } = s.images
    // alt="" ist die korrekte Kennzeichnung eines schmückenden Bildes und
    // zählt deshalb als versorgt, nicht als Lücke.
    const versorgt = withAlt + decorative
    const ratio = total === 0 ? 1 : versorgt / total
    const score = total === 0 ? 5 : clamp(Math.round(ratio * 10))
    const detail =
      total === 0
        ? 'Keine Bilder auf der Seite.'
        : `${withAlt} von ${total} Bildern mit Alt-Text` +
          (decorative > 0 ? `, ${decorative} als schmückend gekennzeichnet (alt="")` : '') +
          (withoutAlt > 0 ? `, ${withoutAlt} ohne alt-Attribut` : '') +
          '.'
    if (withoutAlt > 0) {
      const benannt = missingAltSources.join(', ')
      findings.push({
        id: 'seo-alt-texts',
        severity: 'quickwin',
        title: `${withoutAlt} ${withoutAlt === 1 ? 'Bild' : 'Bilder'} ohne alt-Attribut`,
        why: 'Alt-Texte sind Ranking-Signal, Grundlage der Bildersuche und Voraussetzung für Barrierefreiheit. Gemeint sind nur Bilder ganz ohne alt-Attribut – ein leeres alt="" ist die korrekte Kennzeichnung für ein schmückendes Bild und steht hier nicht zur Debatte.',
        action: `Diese${withoutAlt === 1 ? 's Bild' : ' Bilder'} beschreiben: ${benannt || 'siehe Quelltext'}. Trägt das Bild keine Aussage, stattdessen alt="" setzen – das ist ausdrücklich richtig.`,
        effort: 'gering',
        impact: 'mittel',
        evidence: benannt || undefined,
      })
    }
    technical.push({ key: 'images', label: 'Bild-Optimierung', score, weight: 1, detail, status: statusFor(score) })
  }

  const technicalScore = weightedScore(technical)

  // --- On-Page: Inhalt & Keywords ------------------------------------------
  const onpage: Criterion[] = []

  {
    let score: number
    let detail: string
    if (s.wordCount < 300) {
      score = 2
      detail = `${s.wordCount} Wörter – zu wenig für eine belastbare thematische Abdeckung.`
      findings.push({
        id: 'seo-thin-content',
        severity: 'critical',
        title: `Dünner Inhalt (${s.wordCount} Wörter)`,
        why: 'Unter etwa 300 Wörtern fehlt Google die Grundlage, das Thema einzuordnen; die Seite konkurriert mit deutlich ausführlicheren Ergebnissen.',
        action: 'Inhalt auf mindestens 800–1200 Wörter ausbauen: Hintergrund, Beispiele, Fragen und Antworten ergänzen.',
        effort: 'hoch',
        impact: 'hoch',
      })
    } else if (s.wordCount < 800) {
      score = 5
      detail = `${s.wordCount} Wörter – solide, aber ausbaufähig.`
    } else {
      score = s.wordCount > 3000 ? 8 : 8
      detail = `${s.wordCount} Wörter – ausreichende Tiefe.`
    }
    onpage.push({ key: 'depth', label: 'Inhaltliche Tiefe', score, weight: 3, detail, status: statusFor(score) })
  }

  {
    // Keyword-Platzierung an den vier entscheidenden Stellen.
    if (!keyword) {
      onpage.push({
        key: 'keyword',
        label: 'Keyword-Platzierung',
        score: 0,
        weight: 3,
        detail: 'Kein Hauptkeyword bestimmbar.',
        status: 'unknown',
      })
    } else {
      // Gemessen wird die inhaltliche Deckung, nicht die wörtliche Übereinstimmung.
      //
      // Zwei Fehlbefunde derselben Art führten hierher: "Online-Business" galt
      // nicht als "online business", und "Solopreneurinnen" nicht als
      // "Solopreneure". Beide Male meldete der Bericht ein fehlendes
      // Hauptkeyword an Stellen, an denen es wörtlich stand – und machte
      // daraus eine Sofortmassnahme.
      //
      // Zwei Drittel der tragenden Wörter genügen. Wer "KI-Beratung für
      // Solopreneurinnen ab 40" schreibt, hat "ki-beratung solopreneure"
      // untergebracht, auch wenn keine Zeichenkette übereinstimmt.
      const gedeckt = (text: string | null) => deckungsgrad(text, keyword) >= 0.67
      const spots = {
        Title: gedeckt(s.title),
        H1: gedeckt(s.h1[0] ?? null),
        'erste 100 Wörter': gedeckt(s.first100Words),
        'Meta Description': gedeckt(s.metaDescription),
      }
      const hits = Object.values(spots).filter(Boolean).length
      const score = clamp(hits * 2.5)
      const missing = Object.entries(spots).filter(([, v]) => !v).map(([k]) => k)
      const detail = `"${keyword}" an ${hits} von 4 Schlüsselstellen.${missing.length ? ` Fehlt in: ${missing.join(', ')}.` : ''}`
      if (hits < 3) {
        findings.push({
          id: 'seo-keyword-placement',
          severity: 'quickwin',
          title: `Hauptkeyword fehlt an ${missing.length} Schlüsselstellen`,
          why: 'Title, H1, Einleitung und Meta Description sind die Stellen, an denen Google den thematischen Fokus abliest.',
          action: `"${keyword}" natürlich einbauen in: ${missing.join(', ')}.`,
          effort: 'gering',
          impact: 'hoch',
        })
      }
      onpage.push({ key: 'keyword', label: 'Keyword-Platzierung', score, weight: 3, detail, status: statusFor(score) })
    }
  }

  {
    // Lesbarkeit über Satzlänge und Strukturelemente.
    const sentences = s.text.split(/(?<=[.!?])\s+/).filter((x) => x.length > 10)
    const avgLen = sentences.length ? sentences.reduce((a, b) => a + b.split(/\s+/).length, 0) / sentences.length : 0
    let score = 5
    if (avgLen > 0 && avgLen <= 18) score = 8
    else if (avgLen <= 24) score = 6
    else if (avgLen > 24) score = 3
    if (s.lists.itemsTotal > 5) score = clamp(score + 1)
    const detail = `Ø ${avgLen.toFixed(1)} Wörter pro Satz, ${s.lists.itemsTotal} Listenpunkte, ${s.tables} Tabellen.`
    if (avgLen > 24) {
      findings.push({
        id: 'seo-readability',
        severity: 'quickwin',
        title: `Sätze zu lang (Ø ${avgLen.toFixed(0)} Wörter)`,
        why: 'Lange Sätze senken die Verweildauer – und Verweildauer ist ein indirektes Ranking-Signal.',
        action: 'Sätze auf durchschnittlich 15–18 Wörter kürzen, Absätze auf maximal 3–4 Sätze, Kernaussagen fett hervorheben.',
        effort: 'mittel',
        impact: 'mittel',
      })
    }
    onpage.push({ key: 'readability', label: 'Lesbarkeit', score, weight: 2, detail, status: statusFor(score) })
  }

  {
    const { internal, external, genericAnchors } = s.links
    let score = 3
    if (internal >= 3) score = 6
    if (internal >= 8) score = 8
    if (external >= 2) score = clamp(score + 1)
    if (genericAnchors > 3) score = clamp(score - 2)
    const detail = `${internal} interne, ${external} externe Links${genericAnchors ? `, ${genericAnchors} nichtssagende Ankertexte` : ''}.`
    if (internal < 3) {
      findings.push({
        id: 'seo-internal-links',
        severity: 'quickwin',
        title: `Nur ${internal} interne Links`,
        why: 'Interne Links verteilen Autorität auf der eigenen Seite und zeigen Google die thematischen Zusammenhänge.',
        action: 'Mindestens 5–8 Links zu thematisch passenden eigenen Seiten setzen, mit beschreibenden Ankertexten.',
        effort: 'gering',
        impact: 'mittel',
      })
    }
    onpage.push({ key: 'links', label: 'Interne Verlinkung', score, weight: 2, detail, status: statusFor(score) })
  }

  const onpageScore = weightedScore(onpage)

  // --- E-E-A-T --------------------------------------------------------------
  const eeat: Criterion[] = []
  {
    const signalsPresent = [
      s.hasAuthorInfo,
      Boolean(s.modifiedDate || s.publishedDate),
      s.citationsToAuthority > 0,
      s.hasImprint,
      s.hasPrivacyPolicy,
    ]
    const hits = signalsPresent.filter(Boolean).length
    const score = clamp(hits * 2)
    const missing: string[] = []
    if (!s.hasAuthorInfo) missing.push('Autorenangabe')
    if (!s.modifiedDate && !s.publishedDate) missing.push('Datum')
    if (s.citationsToAuthority === 0) missing.push('Quellenverweise')
    if (!s.hasImprint) missing.push('Impressum')
    if (!s.hasPrivacyPolicy) missing.push('Datenschutzerklärung')

    if (!s.hasImprint || !s.hasPrivacyPolicy) {
      findings.push({
        id: 'seo-legal-missing',
        severity: 'critical',
        title: `${!s.hasImprint ? 'Impressum' : 'Datenschutzerklärung'} nicht auffindbar`,
        why: 'In Deutschland rechtlich verpflichtend und zugleich ein Vertrauenssignal, das Google direkt auswertet.',
        action: 'Impressum und Datenschutzerklärung im Footer jeder Seite verlinken.',
        effort: 'gering',
        impact: 'hoch',
      })
    }
    if (!s.hasAuthorInfo) {
      // Der Bericht darf sich nicht selbst widersprechen: Steht das
      // Person-Schema bereits im Quelltext, wäre "Person-Schema ergänzen"
      // eine Massnahme gegen einen Zustand, den die Analyse zwei Abschnitte
      // vorher als erfüllt ausgewiesen hat. Fehlt dann nur noch der sichtbare
      // Teil – und genau das steht dann da.
      const personSchemaVorhanden = s.schemaTypes.some((t) => /Person/i.test(t))
      findings.push({
        id: 'seo-author-missing',
        severity: 'quickwin',
        title: personSchemaVorhanden
          ? 'Autorenangabe nur im Quelltext, nicht auf der Seite'
          : 'Keine Autorenangabe',
        why: personSchemaVorhanden
          ? 'Das Person-Schema ist ausgezeichnet, für Leserinnen aber unsichtbar. Das "Experience"-Signal aus E-E-A-T entsteht erst, wenn erkennbar ist, wer hinter dem Text steht.'
          : 'Ohne erkennbare Autorin fehlt das "Experience"- und "Expertise"-Signal aus E-E-A-T vollständig.',
        action: personSchemaVorhanden
          ? 'Sichtbare Autorenbox ergänzen: Name, Foto, zwei Sätze zur Erfahrung, Verweis auf die Über-mich-Seite. Das bestehende `Person`-Schema bleibt unverändert.'
          : 'Autorenbox mit Name, Foto, Kurzbiografie und Verweis auf die Über-mich-Seite ergänzen – zusätzlich als `Person`-Schema auszeichnen.',
        effort: 'gering',
        impact: 'hoch',
      })
    }
    eeat.push({
      key: 'trust',
      label: 'E-E-A-T-Signale',
      score,
      weight: 3,
      detail: `${hits} von 5 Vertrauenssignalen vorhanden.${missing.length ? ` Fehlt: ${missing.join(', ')}.` : ''}`,
      status: statusFor(score),
    })
  }

  {
    const freshness = s.modifiedDate ?? s.publishedDate
    let score = 3
    let detail = 'Kein Datum sichtbar.'
    if (freshness) {
      const age = Date.now() - new Date(freshness).getTime()
      const months = age / (1000 * 60 * 60 * 24 * 30)
      score = months < 6 ? 9 : months < 12 ? 7 : months < 24 ? 5 : 3
      detail = `Zuletzt ${new Date(freshness).toLocaleDateString('de-DE')} (vor ${Math.round(months)} Monaten).`
      if (months > 18) {
        findings.push({
          id: 'seo-stale',
          severity: 'longterm',
          title: `Inhalt seit ${Math.round(months)} Monaten unverändert`,
          why: 'Aktualität ist sowohl für Google als auch für KI-Systeme ein Auswahlkriterium.',
          action: 'Inhalt überarbeiten, aktuelle Zahlen ergänzen und das Änderungsdatum sichtbar ausweisen.',
          effort: 'mittel',
          impact: 'mittel',
        })
      }
    }
    eeat.push({ key: 'freshness', label: 'Aktualität', score, weight: 2, detail, status: statusFor(score) })
  }

  const eeatScore = weightedScore(eeat)

  // --- Off-Page -------------------------------------------------------------
  const offpage: Criterion[] = []
  {
    const openSeoBacklinks =
      openSeo && (openSeo.referringDomains != null || openSeo.backlinks != null) ? openSeo : null

    if (!backlinks && openSeoBacklinks) {
      // Rückfallebene OpenSEO: dieselben Schwellwerte wie beim direkten
      // Abruf. Einen Spam-Score liefert die Übersicht nicht – der wird dann
      // auch nicht bewertet, statt ihn mit null zu erfinden.
      const domains = openSeoBacklinks.referringDomains ?? 0
      const score = domains === 0 ? 1 : domains < 10 ? 3 : domains < 50 ? 5 : domains < 200 ? 7 : 9
      if (domains < 20) {
        findings.push({
          id: 'seo-backlinks-weak',
          severity: 'longterm',
          title: `Schwaches Backlink-Profil (${domains} verweisende Domains)`,
          why: 'Verweisende Domains sind weiterhin der stärkste Off-Page-Faktor – und zugleich der wichtigste Hebel für Sichtbarkeit in KI-Antworten.',
          action: 'Gezielt Erwähnungen aufbauen: Gastbeiträge, Podcast-Auftritte, Branchenverzeichnisse, Kooperationen mit thematisch passenden Seiten.',
          effort: 'hoch',
          impact: 'hoch',
        })
      }
      offpage.push({
        key: 'backlinks',
        label: 'Backlink-Profil',
        score,
        weight: 2,
        detail: `${openSeoBacklinks.backlinks ?? 0} Backlinks von ${domains} Domains (Quelle: OpenSEO, ohne Spam-Score).`,
        status: statusFor(score),
      })
    } else if (!backlinks) {
      offpage.push({
        key: 'backlinks',
        label: 'Backlink-Profil',
        score: 0,
        weight: 2,
        detail: 'Keine Backlink-Daten abgerufen.',
        status: 'unknown',
      })
    } else {
      const domains = backlinks.referring_main_domains ?? backlinks.referring_domains ?? 0
      const spam = backlinks.backlinks_spam_score ?? 0
      let score = domains === 0 ? 1 : domains < 10 ? 3 : domains < 50 ? 5 : domains < 200 ? 7 : 9

      // Der Spam-Score ist ein Mittelwert über alle verweisenden Domains.
      // Bei wenigen Verweisen genügen drei Scraper-Seiten, um ihn über 40 zu
      // treiben – ohne dass irgendetwas zu tun wäre. Solche Netzwerke greifen
      // jede aktive Domain automatisch ab, und Google entwertet sie seit
      // Jahren, statt dafür abzustrafen.
      //
      // Deshalb: Punktabzug erst, wenn genug Domains für einen belastbaren
      // Mittelwert vorliegen. Sonst schickt die Bewertung Leute in stundenlange
      // Disavow-Arbeit ohne jeden Effekt.
      const spamBelastbar = domains >= 30
      if (spam > 40 && spamBelastbar) score = clamp(score - 3)

      let detail = `${backlinks.backlinks ?? 0} Backlinks von ${domains} Domains, Spam-Score ${spam}.`
      if (spam > 40 && !spamBelastbar) {
        detail += ` Bei nur ${domains} Domains ist dieser Wert nicht belastbar und bleibt ohne Einfluss auf die Bewertung.`
      }

      if (spam > 40) {
        findings.push({
          id: 'seo-spam-score',
          severity: 'longterm',
          title: spamBelastbar
            ? `Erhöhter Spam-Anteil im Verweisprofil (${spam})`
            : `Spam-Score ${spam} – bei ${domains} Domains ohne Aussagekraft`,
          why: spamBelastbar
            ? 'Über eine grössere Zahl verweisender Domains gemittelt deutet ein Wert über 40 auf einen nennenswerten Anteil minderwertiger Quellen hin.'
            : 'Der Wert ist ein Mittelwert. Bei so wenigen verweisenden Domains genügen einzelne automatisch erzeugte Verlinkungen, um ihn nach oben zu ziehen. Solche Netzwerke greifen jede aktive Domain von selbst ab; Google entwertet sie, statt dafür abzustrafen.',
          action: spamBelastbar
            ? 'Verweisende Domains einzeln durchsehen. Nur was erkennbar aus einem Linknetzwerk stammt und in Masse auftritt, gehört in eine Disavow-Datei – im Zweifel nichts tun.'
            : 'Nichts unternehmen. Kein Disavow, keine Meldung. Der Wert sinkt von selbst, sobald echte Verweise dazukommen.',
          effort: 'gering',
          impact: spamBelastbar ? 'mittel' : 'gering',
        })
      }
      if (domains < 20) {
        findings.push({
          id: 'seo-backlinks-weak',
          severity: 'longterm',
          title: `Schwaches Backlink-Profil (${domains} verweisende Domains)`,
          why: 'Verweisende Domains sind weiterhin der stärkste Off-Page-Faktor – und zugleich der wichtigste Hebel für Sichtbarkeit in KI-Antworten.',
          action: 'Gezielt Erwähnungen aufbauen: Gastbeiträge, Podcast-Auftritte, Branchenverzeichnisse, Kooperationen mit thematisch passenden Seiten.',
          effort: 'hoch',
          impact: 'hoch',
        })
      }
      offpage.push({ key: 'backlinks', label: 'Backlink-Profil', score, weight: 2, detail, status: statusFor(score) })
    }
  }

  {
    const organic = domainRank?.items?.[0]?.metrics?.organic
    if (!organic) {
      offpage.push({
        key: 'visibility',
        label: 'Organische Sichtbarkeit',
        score: 0,
        weight: 2,
        detail: 'Keine Sichtbarkeitsdaten abgerufen.',
        status: 'unknown',
      })
    } else {
      const total = organic.count ?? 0
      const top10 = (organic.pos_1 ?? 0) + (organic.pos_2_3 ?? 0) + (organic.pos_4_10 ?? 0)
      const score = top10 === 0 ? 1 : top10 < 5 ? 3 : top10 < 25 ? 5 : top10 < 100 ? 7 : 9
      offpage.push({
        key: 'visibility',
        label: 'Organische Sichtbarkeit',
        score,
        weight: 2,
        detail: `${total} Keywords in den Top 100, davon ${top10} in den Top 10. Geschätzter Traffic: ${Math.round(organic.etv ?? 0)}/Monat.`,
        status: statusFor(score),
      })
    }
  }

  const offpageScore = weightedScore(offpage)

  // --- Gesamtwert nach Framework-Gewichtung ---------------------------------
  const all: Criterion[] = [
    { key: 'technical', label: 'Technisches SEO', score: technicalScore, weight: 30, detail: '', status: statusFor(technicalScore) },
    { key: 'onpage', label: 'On-Page & Keywords', score: onpageScore, weight: 40, detail: '', status: statusFor(onpageScore) },
    { key: 'eeat', label: 'E-E-A-T & Trust', score: eeatScore, weight: 20, detail: '', status: statusFor(eeatScore) },
    { key: 'offpage', label: 'Off-Page', score: offpageScore, weight: 10, detail: '', status: offpage.every((c) => c.status === 'unknown') ? 'unknown' : statusFor(offpageScore) },
  ]
  const score = weightedScore(all)

  return {
    module: 'SEO',
    score,
    label: scoreLabel(score),
    criteria: [...technical, ...onpage, ...eeat, ...offpage],
    findings,
    data: {
      groupScores: {
        technisch: technicalScore,
        onpage: onpageScore,
        eeat: eeatScore,
        offpage: offpageScore,
      },
      pagespeed: pagespeed ?? null,
      backlinks: backlinks ?? null,
      openSeo: openSeo ?? null,
    },
  }
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n * 10) / 10))
