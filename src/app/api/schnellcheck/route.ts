import { headers } from 'next/headers'
import { zulaessigeAdresse, zaehleUndPruefe } from '@/lib/schnellcheck'
import { extractSignals } from '@/lib/analysis/extract'
import { analyzeSeo } from '@/lib/analysis/seo'
import { analyzeAeo } from '@/lib/analysis/aeo'
import { analyzeGeo } from '@/lib/analysis/geo'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Schnell-Check ohne Konto.
 *
 * Bewusst ohne die bezahlten Anbieter: Der Abruf läuft direkt vom Server und
 * kostet nichts – nur die Seitenhälfte der Analyse (SEO/AEO/GEO-Struktur),
 * keine Platzierungen, kein Wettbewerb. Genau die Grenze, an der der
 * vollständige Zugang beginnt.
 */
export async function POST(request: Request) {
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unbekannt'

  const limit = await zaehleUndPruefe(ip)
  if (!limit.ok) return Response.json({ error: limit.grund }, { status: 429 })

  let eingabe: string
  try {
    const body = (await request.json()) as { url?: string }
    eingabe = String(body.url ?? '').trim().slice(0, 500)
  } catch {
    return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const adresse = zulaessigeAdresse(eingabe)
  if (!adresse.ok) return Response.json({ error: adresse.grund }, { status: 400 })

  // Weiterleitungen von Hand verfolgen, damit jede Zwischenstation erneut
  // durch die Adressprüfung geht – sonst leitete eine harmlose Adresse
  // einfach ins eigene Netz weiter.
  let url = adresse.url
  let antwort: globalThis.Response | null = null
  for (let schritt = 0; schritt < 4; schritt++) {
    antwort = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SEO-Master-Schnellcheck/1.0)' },
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null)
    if (!antwort) return Response.json({ error: 'Die Seite antwortet nicht.' }, { status: 502 })

    if (antwort.status >= 300 && antwort.status < 400) {
      const ziel = antwort.headers.get('location')
      if (!ziel) break
      const naechste = zulaessigeAdresse(new URL(ziel, url).toString())
      if (!naechste.ok) return Response.json({ error: 'Die Seite leitet auf eine Adresse um, die sich hier nicht prüfen lässt.' }, { status: 400 })
      url = naechste.url
      continue
    }
    break
  }
  if (!antwort || !antwort.ok) {
    return Response.json({ error: `Die Seite antwortet mit Fehler ${antwort?.status ?? '–'}.` }, { status: 502 })
  }

  const html = (await antwort.text()).slice(0, 2_000_000)
  const signals = extractSignals({ url: url.toString(), html, finalUrl: url.toString() })

  const module = [
    analyzeSeo({ signals }),
    analyzeAeo({ signals, serp: null, peopleAlsoAsk: [] }),
    analyzeGeo({ signals, backlinks: null, llmMentions: null, robotsTxt: null }),
  ]

  // Drei Werte und drei Baustellen – genug, um zu zeigen, dass die Messung
  // echt ist, und wenig genug, dass der vollständige Bericht etwas wert bleibt.
  const befunde = module
    .flatMap((m) => m.findings)
    .filter((f) => f.severity === 'critical' || f.severity === 'quickwin')
    .slice(0, 3)
    .map((f) => f.title)

  return Response.json({
    url: url.toString(),
    scores: Object.fromEntries(module.map((m) => [m.module, Math.round(m.score * 10) / 10])),
    befunde,
    hinweis:
      'Geprüft wurde der ausgelieferte Quelltext dieser einen Seite. Platzierungen, Wettbewerb und den vollständigen Bericht gibt es im Zugang.',
  })
}
