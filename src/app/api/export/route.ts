import JSZip from 'jszip'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/**
 * Vollstaendiger Export des eigenen Arbeitsbereichs.
 *
 * Zwei Gruende, warum es das gibt:
 *  - Wer fuer die Anwendung bezahlt, muss seine Historie mitnehmen koennen,
 *    ohne auf jemanden angewiesen zu sein.
 *  - Die DSGVO verlangt Datenuebertragbarkeit in einem gaengigen Format.
 *
 * Die Berichte liegen im Zip nach Projekt sortiert - so entsteht beim
 * Entpacken die Ordnerstruktur, die man ohnehin anlegen wuerde. Daneben eine
 * Uebersicht als CSV fuer die Tabellenkalkulation und die vollstaendigen
 * Messdaten als JSON, damit nichts nur in Prosa vorliegt.
 */

export const dynamic = 'force-dynamic'
/** Ein Export kann gross werden; das Sammeln braucht laenger als der Standard. */
export const maxDuration = 120

/** Mehr als das in einem Zug waere fuer den Arbeitsspeicher zu viel. */
const HOECHSTZAHL = 500

export async function GET() {
  const session = await getSession()
  if (!session) return new Response('Nicht angemeldet', { status: 401 })

  const analysen = await db.analysis.findMany({
    where: { organizationId: session.organizationId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: HOECHSTZAHL,
    select: {
      id: true,
      targetUrl: true,
      targetKind: true,
      modules: true,
      createdAt: true,
      scoreSeo: true,
      scoreAeo: true,
      scoreGeo: true,
      scoreSerp: true,
      scoreOverall: true,
      creditsUsed: true,
      result: true,
      project: { select: { name: true } },
      reports: { select: { markdown: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  const zip = new JSZip()
  const wurzel = zip.folder('Sichtbarkeitsanalysen')
  if (!wurzel) return new Response('Export fehlgeschlagen', { status: 500 })

  const vergeben = new Set<string>()

  for (const analyse of analysen) {
    const ordner = dateiname(analyse.project?.name ?? 'Ohne Projekt')
    const datum = analyse.createdAt.toISOString().slice(0, 10)
    const basis = `${datum}-${dateiname(domainVon(analyse.targetUrl))}`

    // Zwei Laeufe derselben Seite am selben Tag duerfen sich nicht ueberschreiben.
    let name = basis
    let zaehler = 2
    while (vergeben.has(`${ordner}/${name}`)) name = `${basis}-${zaehler++}`
    vergeben.add(`${ordner}/${name}`)

    const bericht = analyse.reports[0]?.markdown
    if (bericht) wurzel.file(`${ordner}/${name}.md`, bericht)
    if (analyse.result) {
      wurzel.file(`${ordner}/${name}.json`, JSON.stringify(analyse.result, null, 2))
    }
  }

  wurzel.file('uebersicht.csv', csvVon(analysen))
  wurzel.file('LIESMICH.txt', liesmich(session.organizationName, analysen.length))

  const inhalt = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const stempel = new Date().toISOString().slice(0, 10)
  return new Response(inhalt as unknown as BodyInit, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="seo-master-export-${stempel}.zip"`,
      'content-length': String(inhalt.byteLength),
      'cache-control': 'no-store',
    },
  })
}

type Zeile = {
  createdAt: Date
  targetUrl: string
  project: { name: string } | null
  modules: string[]
  scoreOverall: number | null
  scoreSeo: number | null
  scoreAeo: number | null
  scoreGeo: number | null
  scoreSerp: number | null
}

export function csvVon(analysen: Zeile[]): string {
  const kopf = ['Datum', 'Projekt', 'Adresse', 'Bausteine', 'Gesamt', 'SEO', 'AEO', 'GEO', 'SERP']
  const zeilen = analysen.map((a) =>
    [
      a.createdAt.toISOString().slice(0, 10),
      a.project?.name ?? '',
      a.targetUrl,
      a.modules.join(' '),
      note(a.scoreOverall),
      note(a.scoreSeo),
      note(a.scoreAeo),
      note(a.scoreGeo),
      note(a.scoreSerp),
    ]
      .map(feld)
      .join(';'),
  )
  // Semikolon und BOM, damit Excel im deutschsprachigen Raum die Spalten
  // sofort richtig trennt und Umlaute nicht zerfallen.
  return `﻿${[kopf.map(feld).join(';'), ...zeilen].join('\r\n')}\r\n`
}

function feld(wert: string): string {
  return /[";\r\n]/.test(wert) ? `"${wert.replace(/"/g, '""')}"` : wert
}

/** Deutsches Dezimalkomma, damit die Tabellenkalkulation rechnen kann. */
function note(wert: number | null): string {
  return wert === null ? '' : wert.toFixed(1).replace('.', ',')
}

function domainVon(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'analyse'
  }
}

/** Fuer Dateisysteme entschaerfen - auch fuer Windows. */
export function dateiname(text: string): string {
  const sauber = text
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 60)
  return sauber || 'ohne-namen'
}

function liesmich(arbeitsbereich: string, anzahl: number): string {
  return [
    `Export aus SEO-Master - ${arbeitsbereich}`,
    `Erstellt am ${new Date().toLocaleDateString('de-DE')}`,
    '',
    `Enthalten sind ${anzahl} abgeschlossene Analysen, nach Projekt sortiert.`,
    '',
    'Je Analyse zwei Dateien:',
    '  .md    der Bericht zum Lesen und Weitergeben',
    '  .json  saemtliche Messwerte, fuer die Weiterverarbeitung',
    '',
    'uebersicht.csv listet alle Laeufe mit ihren Bewertungen und laesst sich',
    'direkt in Excel oder Numbers oeffnen.',
    '',
    anzahl >= HOECHSTZAHL
      ? `Hinweis: Ein Export umfasst hoechstens ${HOECHSTZAHL} Analysen. Aeltere Laeufe`
        + ' bleiben in der Anwendung erhalten und lassen sich einzeln herunterladen.'
      : 'Dieser Export ist vollstaendig.',
    '',
  ].join('\n')
}
